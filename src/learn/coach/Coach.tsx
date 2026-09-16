import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../../lib/haptics'
import { formatNumber, type AppLanguage } from '../../lib/numbers'
import { GhostFinger } from './GhostFinger'
import { Spotlight } from './Spotlight'
import { createTourEventQueue } from './eventQueue'
import { subscribeTour } from './events'
import { toInlineStart } from './geometry'
import { findTourTarget, focusQuietly, useIsRtl, useLatest, useViewportSize } from './useSpotlight'
import type { DemoAction, LessonStep, TourCtx } from './types'

export interface CoachProps {
  steps: LessonStep[]
  ctx: TourCtx
  /** Called once the last step's expectation has been met. */
  onComplete: () => void
  /** Escape or «رد شدن». Carries the step the user was on so progress can be stored. */
  onExit: (atIndex: number) => void
  /** Where to resume. Out-of-range values are treated as the start. */
  initialIndex?: number
  /**
   * The step now on screen, announced whenever it changes.
   *
   * The coach owns the index, and a host that needs to know which step is showing would
   * otherwise have to re-derive it by running every `expect` a second time — a second judge,
   * disagreeing with the first the moment one of them is wrong. Mission 1 needs it: its
   * pinned-rate note is declared to appear from a named step, and without this the host can
   * only approximate that from whatever event happens to arrive near it.
   */
  onStep?: (id: string, index: number) => void
}

/** The brief's number: eight seconds of nothing happening and the step offers a hand. */
const IDLE_MS = 8000
/** Time the ghost finger is given to reach a control before it taps it. */
const DEMO_MOVE_MS = 550
/** Time the tap is left on screen afterwards, so the user sees what it did. */
const DEMO_HOLD_MS = 420
/** Time a smooth `scrollIntoView` is given before the finger is placed. */
const DEMO_SCROLL_MS = 320

interface DemoFrame {
  inlineStart: number
  top: number
  tap: number
  label: string
}

/**
 * The lesson runner.
 *
 * It advances on one thing only: a `TourEvent` for which the current step's `expect`
 * returns true. There is no timer that moves a step along, no "next" that skips the
 * exercise — D3 in the plan rules those out, and a tour that advances on its own is a
 * slideshow. What timers there are only decide when to *offer help*.
 */
export function Coach({ steps, ctx, onComplete, onExit, initialIndex = 0, onStep }: CoachProps) {
  const { t, i18n } = useTranslation()
  const lang: AppLanguage = i18n.language.startsWith('fa') ? 'fa' : 'en'
  const reducedMotion = useReducedMotion()
  const rtl = useIsRtl()
  const viewport = useViewportSize()

  const [index, setIndex] = useState(() => (initialIndex >= 0 && initialIndex < steps.length ? initialIndex : 0))
  const [ready, setReady] = useState(false)
  const [hinting, setHinting] = useState(false)
  const [demo, setDemo] = useState<DemoFrame | null>(null)

  const step = steps[index]
  const stepsRef = useLatest(steps)
  const onStepRef = useLatest(onStep)
  const ctxRef = useLatest(ctx)
  const indexRef = useLatest(index)
  const rtlRef = useLatest(rtl)
  const viewportRef = useLatest(viewport)
  const onCompleteRef = useLatest(onComplete)

  const label = useCallback(
    (key: string, fallback: string, vars?: Record<string, unknown>) =>
      t(key, { defaultValue: fallback, ...vars }),
    [t],
  )

  /* ---- idle ---- */

  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /* Called on every keystroke, so it must not re-render when there is nothing to change:
   * returning the previous value from the updater makes React bail out. */
  const resetIdle = useCallback(() => {
    setHinting((previous) => (previous ? false : previous))
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setHinting(true), IDLE_MS)
  }, [])

  useEffect(() => {
    if (!ready) return
    resetIdle()
    // Raw input counts as life too: a user reading and scrolling is not stuck.
    document.addEventListener('pointerdown', resetIdle, true)
    document.addEventListener('keydown', resetIdle, true)
    return () => {
      clearTimeout(idleTimer.current)
      document.removeEventListener('pointerdown', resetIdle, true)
      document.removeEventListener('keydown', resetIdle, true)
    }
  }, [ready, index, resetIdle])

  /* ---- the demo, cancelled by a token rather than by unwinding the loop ---- */

  const demoToken = useRef(0)
  const cancelDemo = useCallback(() => {
    demoToken.current += 1
    setDemo(null)
  }, [])

  const describe = useCallback(
    (action: DemoAction): string =>
      action.type === 'type'
        ? label('learn.demoType', 'Typing {{value}}', {
            /* Demo values are ASCII digit strings, and interpolating one raw put «۱۵۰۰۰۰» on a
             * Persian line as `150000` — Latin digits, no U+066C grouping, directly beneath the
             * step's own «۱۵۰٬۰۰۰». The parity script cannot see this: the key is in both
             * bundles, and it is the value that is wrong. The one non-numeric demo value is a
             * product name, which must pass through untouched. */
            value:
              action.value.trim() !== '' && Number.isFinite(Number(action.value))
                ? formatNumber(Number(action.value), lang, 0)
                : action.value,
          })
        : label('learn.demoTap', 'Tapping here'),
    [label, lang],
  )

  const playDemo = useCallback(async () => {
    const script = stepsRef.current[indexRef.current]?.demo
    if (!script) return
    const token = (demoToken.current += 1)
    let tap = 0
    for (const action of script.actions) {
      const element = findTourTarget(action.target)
      if (!element) continue
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
      await wait(reducedMotion ? 0 : DEMO_SCROLL_MS)
      if (token !== demoToken.current) return
      const box = element.getBoundingClientRect()
      tap += 1
      setDemo({
        // The finger is a point, so it converts with a zero-width span.
        inlineStart: toInlineStart(box.left + box.width / 2, 0, viewportRef.current.width, rtlRef.current),
        top: box.top + box.height / 2,
        tap,
        label: describe(action),
      })
      await wait(DEMO_MOVE_MS)
      if (token !== demoToken.current) return
      performDemoAction(action)
      vibrate()
      await wait(DEMO_HOLD_MS)
      if (token !== demoToken.current) return
    }
    setDemo(null)
  }, [describe, indexRef, reducedMotion, rtlRef, stepsRef, viewportRef])

  /* ---- step lifecycle ---- */

  // `before` may open a sheet or switch a tab; nothing is shown until it has settled.
  useEffect(() => {
    if (!step) return
    let cancelled = false
    setReady(false)
    const prepare = async () => {
      try {
        await step.before?.(ctxRef.current)
      } catch {
        /* A step whose setup failed still shows its tooltip: the user can read it, do the
         * thing by hand, and move on. Wedging the lesson would be the worse failure. */
      }
      if (!cancelled) setReady(true)
    }
    void prepare()
    return () => {
      cancelled = true
    }
  }, [step, ctxRef])

  useEffect(() => cancelDemo, [index, cancelDemo])

  /* Announce the step on screen. Keyed on the id rather than the index so a host that resumes
   * mid-lesson hears about the step it actually resumed on, not about an index it cannot map. */
  useEffect(() => {
    if (step !== undefined) onStepRef.current?.(step.id, index)
  }, [step, index, onStepRef])

  const advancedFor = useRef(-1)
  const advance = useCallback(() => {
    const from = indexRef.current
    // One burst of events must not skip two steps.
    if (advancedFor.current === from) return
    advancedFor.current = from
    cancelDemo()
    /* Focus goes back to the control the user just used, before the next step's tooltip
     * claims it, so a keyboard user is left where they were working. */
    const finished = stepsRef.current[from]
    if (finished) focusQuietly(findTourTarget(finished.target))
    if (from + 1 >= stepsRef.current.length) {
      onCompleteRef.current()
      return
    }
    setIndex(from + 1)
  }, [cancelDemo, indexRef, onCompleteRef, stepsRef])

  /*
   * One queue per step. The practice store is re-read before every `expect` — the plan's
   * refresh rule — which makes judging async even though the predicate is not, so events are
   * serialised through the queue rather than raced against each other. It closes itself the
   * moment a step passes, and again here when the step is torn down.
   */
  useEffect(() => {
    if (!ready || !step) return
    const queue = createTourEventQueue({
      refresh: () => ctxRef.current.refreshSandbox(),
      judge: (event) => step.expect(event, ctxRef.current.sandbox),
      onSatisfied: advance,
    })
    const unsubscribe = subscribeTour((event) => {
      // Idle is about the user, not about the judging, so it resets on arrival.
      resetIdle()
      queue.push(event)
    })
    return () => {
      unsubscribe()
      queue.close()
    }
  }, [ready, step, advance, resetIdle, ctxRef])

  if (!step) return null

  const counter = label('learn.stepOf', '{{current}} / {{total}}', {
    current: formatNumber(index + 1, lang, 0),
    total: formatNumber(steps.length, lang, 0),
  })
  const text = t(step.textKey)
  const hint = demo ? demo.label : hinting ? label('learn.stuck', 'Tap the highlighted part to carry on.') : null

  return (
    <Spotlight
      target={step.target}
      placement={step.placement ?? 'auto'}
      stepId={step.id}
      text={text}
      announcement={`${counter}. ${text}`}
      hint={hint}
      pulse={hinting}
      counter={counter}
      skipLabel={label('learn.skip', 'Skip')}
      onSkip={() => onExit(index)}
      actions={
        step.demo ? (
          <button
            type="button"
            onClick={() => {
              vibrate()
              void playDemo()
            }}
            className="rounded-full bg-[var(--accent-fill-strong)] px-3 py-1.5 text-[13px] font-semibold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {label('learn.showMe', 'Show me')}
          </button>
        ) : null
      }
    >
      {demo ? <GhostFinger inlineStart={demo.inlineStart} top={demo.top} tap={demo.tap} visible /> : null}
    </Spotlight>
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The control a tap on this target has to land on.
 *
 * Several `data-tour` names are on the card rather than on the button inside it — the settings
 * install row is a `<section>` around its button, a product row a `<li>` around its — and they
 * are on the card deliberately: the hole the step cuts is supposed to show the whole row, not a
 * word of it. `click()` on a wrapper does nothing at all, though, so the demo stood there tapping
 * a `<section>` until the step timed out. Typing has always descended to the `input` it found;
 * this is the same descent for a tap, and nothing more: a host that is itself a control, or that
 * holds no control at all, is returned untouched.
 */
function controlWithin(host: HTMLElement): HTMLElement {
  const INTERACTIVE =
    'button, a[href], input, select, textarea, summary, [role="button"], [role="radio"], [role="checkbox"], [role="tab"], [role="switch"], [role="link"]'
  if (host.matches(INTERACTIVE)) return host
  return host.querySelector<HTMLElement>(INTERACTIVE) ?? host
}

/**
 * Do what the demo says, for real.
 *
 * «نشانم بده» has to drive the actual controls: the components are what emit `TourEvent`s,
 * so a finger that only mimed would leave the step's `expect` waiting forever. A tap is a
 * tap; typing goes through the prototype's `value` setter because React holds the input's
 * value and a plain assignment is invisible to it.
 */
function performDemoAction(action: DemoAction): void {
  const host = findTourTarget(action.target)
  if (!host) return
  if (action.type === 'tap') {
    controlWithin(host).click()
    return
  }
  const field = host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement
    ? host
    : host.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  if (!field) return
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  field.focus({ preventScroll: true })
  setValue?.call(field, action.value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
  // Blurring is what commits a field, and `field:commit` is what most steps wait for.
  field.blur()
}
