import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { createDraftWriter, readDraft, type DraftState } from '../lib/drafts'
import { vibrate } from '../lib/haptics'
import {
  SEGMENTS,
  defaultModeOfSegment,
  emptyStates,
  ensureBehaviour,
  isModeId,
  perMode,
  runMode,
  segmentIndexOf,
  validateMode,
  visibleFields,
} from '../lib/modes/registry'
import type { ModeId, ModeState, ResultDisplay, ScheduleInfo, SegmentId, Translate } from '../lib/modes/types'
import type { BasketItem, HistoryEntry, SoodaDb } from '../lib/db'
import type { RatesFile } from '../lib/rates/schema'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import type { RoundingStep } from '../lib/rounding'
import { buildModeShareQuery, parseModeShareQuery } from '../lib/share'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconPercent, IconScale, IconTag, IconTagReverse, IconWallet } from './Icons'
import { ErrorBoundary } from './ErrorBoundary'
import { LensRow } from './LensRow'
import { ModeFields } from './ModeFields'
import type { ProductDraft } from './SaveProductSheet'
import { SegmentedControl } from './SegmentedControl'
import { emitTour } from '../learn/coach/events'
import { HelpButton, useLearn } from '../learn/ui/entry'

const ScheduleSheet = lazy(() => import('./ScheduleSheet').then((m) => ({ default: m.ScheduleSheet })))
// The result card only exists once the user has tapped Calculate, which is seconds
// after load and a deliberate act — so its refraction filter and real-profit block
// have no business in the bytes that decide first paint.
const ResultCard = lazy(() => import('./ResultCard').then((m) => ({ default: m.ResultCard })))
// Only ever mounted under a result that carries a cost, so it never costs a first-time user anything.
const CalcProductLink = lazy(() => import('./CalcProductLink').then((m) => ({ default: m.CalcProductLink })))

interface Snapshot {
  inputs: number[]
  results: number[]
  unit: Unit
}

/** Cash and instalment pricing share the profit segment; these are the two halves of its sub-control. */
type ProfitKind = 'cash' | 'installments'

interface CalculatorViewProps {
  lang: AppLanguage
  unit: Unit
  /** Onboarding is finished — safe to auto-run a shared link. */
  ready: boolean
  monthlyInflationPercent: number
  roundingStep: RoundingStep
  /** The lens's inflation chip is a shortcut into Settings, where the rate lives. */
  onOpenSettings: () => void
  onSaveProduct: (draft: ProductDraft) => void
  /** null while the rates file loads; only used to stamp the day's FX on a recorded cost. */
  rates: RatesFile | null
  /** A cost recorded from here changes the stale list and the badge. */
  onProductsChanged: () => void
  /** Persisted with the calculator draft so a service-worker reload lands where the user was. */
  tab: DraftState['tab']
  /**
   * The practice database while a lesson is running, `null` otherwise.
   *
   * The calculator is the surface being taught on, so it keeps working — but everything it
   * writes has to land in the demo store: the plan forbids a lesson touching the shopkeeper's
   * history, basket or draft, and lesson 7 then reads back the two calculations it just made.
   * The bound helpers in `lib/db` are tied to the real database and also mirror the basket count
   * into localStorage for the header badge, which is why practice writes the tables directly.
   */
  practiceDb?: SoodaDb | null
  /** A mode a lesson step asked for, applied once and then cleared through `onModeApplied`. */
  requestedMode?: string | null
  onModeApplied?: () => void
  /**
   * The lens month Mission 1 finished on, read once at the first render of the real calculator.
   *
   * Onboarding's done screen promises «the real calculator in the same mode», and the mode the
   * mission leaves it in is the lens on «۳ ماه» — the whole point of the minute. Everything else
   * it did stays behind: this is a month and nothing else, and it is ignored while a lesson is
   * running, so the demo calculator never inherits it either.
   */
  handBackLensMonths?: string | null
}

export function CalculatorView({
  lang,
  unit,
  ready,
  monthlyInflationPercent,
  roundingStep,
  onOpenSettings,
  onSaveProduct,
  rates,
  onProductsChanged,
  tab,
  practiceDb = null,
  requestedMode = null,
  onModeApplied,
  handBackLensMonths = null,
}: CalculatorViewProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const learn = useLearn()

  // A shared calculation link pre-fills and auto-computes; mode-only links
  // (?m=profit) from PWA shortcuts just open the right calculator. A link always
  // beats a restored draft — the user clicked it on purpose.
  const shared = useMemo(() => parseModeShareQuery(window.location.search), [])
  const practice = practiceDb !== null
  const restored = useMemo(() => (shared || practice ? null : readDraft()), [shared, practice])
  const sharedRan = useRef(false)

  const [mode, setMode] = useState<ModeId>(() => shared?.mode ?? asModeId(restored?.mode) ?? 'profit')
  const [prevSegment, setPrevSegment] = useState(() => segmentIndexOf(shared?.mode ?? asModeId(restored?.mode) ?? 'profit'))
  const [states, setStates] = useState<Record<ModeId, ModeState>>(() => {
    const initial = emptyStates()
    if (restored) {
      for (const key of Object.keys(initial) as ModeId[]) {
        const saved = restored.modes[key]
        if (saved) initial[key] = { ...initial[key], ...saved }
      }
    }
    /* Mission 1's «۳ ماه», the one thing that crosses the practice boundary. The mission runs on
     * the profit calculator, so that is the row it applies to; a shared link still wins, because
     * that one was clicked on purpose. `practice` guards the other direction: starting a lesson
     * remounts this too, and the demo shop must open on its own defaults. */
    if (handBackLensMonths !== null && !practice) {
      initial.profit = { ...initial.profit, months: handBackLensMonths }
    }
    if (shared) {
      const target = { ...initial[shared.mode] }
      for (const [key, value] of Object.entries(shared.values)) target[key] = String(value)
      initial[shared.mode] = target
    }
    return initial
  })
  const [errors, setErrors] = useState<Record<ModeId, Record<string, ValidationError>>>(() =>
    perMode<Record<string, ValidationError>>(() => ({})),
  )
  const [results, setResults] = useState<Record<ModeId, ResultDisplay | null>>(() =>
    perMode<ResultDisplay | null>(() => null),
  )
  // Raw numbers behind the latest result per mode, for add-to-basket.
  const lastComputed = useRef<Record<ModeId, Snapshot | null>>(perMode<Snapshot | null>(() => null))

  // The card is a lazy chunk. The first keystroke is seconds of typing ahead of the
  // first Calculate, which is ample time to fetch it — so the result never waits.
  const warmedResultCard = useRef(false)
  const warmResultCard = useCallback(() => {
    if (warmedResultCard.current) return
    warmedResultCard.current = true
    void import('./ResultCard')
  }, [])

  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const rtl = lang === 'fa'
  const segmentIndex = segmentIndexOf(mode)
  // Slide direction: +1 when moving toward the next segment, mirrored for RTL.
  const direction = (segmentIndex >= prevSegment ? 1 : -1) * (rtl ? -1 : 1)
  const isProfitSegment = segmentIndex === 0
  const isDiscountSegment = segmentIndex === 2
  const isInstallment = mode === 'installment' || mode === 'rinstallment'

  // Keep typed input across the reload a new service worker triggers.
  const draftWriter = useMemo(() => createDraftWriter(), [])
  useEffect(() => () => draftWriter.cancel(), [draftWriter])
  useEffect(() => {
    if (practice) return
    draftWriter.save({ modes: states, mode, tab })
  }, [states, mode, tab, draftWriter, practice])

  /* A step that needs a particular mode gets it here rather than by asking the user to find it.
   * Cleared straight away, so re-rendering for any other reason does not drag them back. */
  useEffect(() => {
    if (requestedMode === null) return
    if (isModeId(requestedMode)) {
      setPrevSegment(segmentIndexOf(mode))
      setMode(requestedMode)
    }
    onModeApplied?.()
    // `mode` is read, not depended on: re-running when the mode changes would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedMode, onModeApplied])

  const onSegmentChange = useCallback(
    (next: SegmentId) => {
      setPrevSegment(segmentIndexOf(mode))
      setMode(defaultModeOfSegment(next))
      emitTour({ type: 'segment:change', segment: next })
      // Keep the viewport anchored — prevents the page-jump feel on mobile.
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [mode, reducedMotion],
  )

  const setField = useCallback(
    (key: string, value: string) => {
      warmResultCard()
      setStates((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: value } }))
      setErrors((prev) => {
        if (!prev[mode][key]) return prev
        const next = { ...prev[mode] }
        delete next[key]
        return { ...prev, [mode]: next }
      })
      /*
       * The card on screen answered a question the fields no longer ask: editing anything after
       * Calculate left the previous figure showing, unchanged and with nothing marking it stale,
       * until Calculate was pressed again — and "Save to my products" / "Add to basket" both read
       * straight from it, so a shopkeeper could act on a number that no longer matched what was
       * in front of them. Clearing it here is the same thing an invalid input already does in
       * `calculate()`; the answer is either exactly what was asked for, or there is no answer
       * shown at all, never one quietly describing an input that has since changed.
       */
      setResults((prev) => (prev[mode] === null ? prev : { ...prev, [mode]: null }))
    },
    [mode, warmResultCard],
  )

  /** Instalment pricing starts from the price the profit tab just worked out. */
  const onProfitKindChange = useCallback(
    (kind: ProfitKind) => {
      if (kind === 'cash') {
        setMode('profit')
        emitTour({ type: 'mode:change', mode: 'profit' })
        return
      }
      // First time anyone prices an instalment deal, offer the one line that explains it.
      learn?.tip('installments')
      const lastProfit = lastComputed.current.profit
      setStates((prev) => {
        if ((prev.installment['cash'] ?? '') !== '' || !lastProfit) return prev
        const cash = String(lastProfit.results[0] ?? '')
        return {
          ...prev,
          installment: { ...prev.installment, cash },
          rinstallment: { ...prev.rinstallment, cash },
        }
      })
      setMode('installment')
      emitTour({ type: 'mode:change', mode: 'installment' })
    },
    [learn],
  )

  const translate = useCallback<Translate>((key, vars) => t(key, vars ?? {}), [t])
  const fmtMoney = useCallback((value: number) => formatAmountWithUnit(value, lang, unit), [lang, unit])
  const fmtNumber = useCallback((value: number) => formatNumber(value, lang), [lang])

  const calculate = useCallback(
    async (saveToHistory = true) => {
      vibrate()
      emitTour({ type: 'action', name: 'calculate' })
      const state = states[mode]
      // Instalment maths is a separate chunk; load it before validating so the
      // cross-field rules (down payment, whole instalment count) actually run.
      const behaviour = await ensureBehaviour(mode)
      const { values, errors: fieldErrors, ok } = validateMode(mode, state)
      if (!ok) {
        setErrors((prev) => ({ ...prev, [mode]: fieldErrors }))
        setResults((prev) => ({ ...prev, [mode]: null }))
        return
      }
      setErrors((prev) => ({ ...prev, [mode]: {} }))

      const now = Date.now()
      const { display, snapshot } = runMode(
        behaviour,
        values,
        { monthlyInflationPercent, roundingStep, now, state },
        {
          t: translate,
          lang,
          unit,
          fmtMoney,
          fmtNumber,
          roundingStep,
          key: `${mode}:${Object.values(values).join(':')}:${now}`,
        },
      )

      setResults((prev) => ({ ...prev, [mode]: display }))
      lastComputed.current[mode] = { ...snapshot, unit }
      emitTour({ type: 'result:shown', mode })
      if (!saveToHistory) return
      const row = { mode, inputs: snapshot.inputs, results: snapshot.results, unit, createdAt: now }
      if (practiceDb !== null) {
        // The demo store's own history: lesson 7 opens it and exports what the learner just did.
        await practiceDb.history.add(row as HistoryEntry)
        return
      }
      const { addHistoryEntry } = await import('../lib/db')
      await addHistoryEntry(row)
    },
    [mode, states, translate, lang, unit, fmtMoney, fmtNumber, monthlyInflationPercent, roundingStep, practiceDb],
  )

  const addToBasket = useCallback(async () => {
    const snap = lastComputed.current[mode]
    if (!snap) return
    emitTour({ type: 'action', name: 'add-to-basket' })
    const row = { mode, inputs: snap.inputs, results: snap.results, unit: snap.unit, createdAt: Date.now() }
    if (practiceDb !== null) {
      /* Straight to the table, not through `addBasketItem`: that helper re-publishes the header
       * badge from the real basket, and a lesson must not move the number on the app icon. */
      await practiceDb.basket.add(row as BasketItem)
      return
    }
    const { addBasketItem } = await import('../lib/db')
    await addBasketItem(row)
  }, [mode, practiceDb])

  // Auto-compute a shared link once (after the language is known), then clean the URL.
  useEffect(() => {
    if (!shared || sharedRan.current || !ready) return
    sharedRan.current = true
    if (Object.keys(shared.values).length > 0) void calculate(false)
    window.history.replaceState({}, '', import.meta.env.BASE_URL)
  }, [shared, ready, calculate])

  const shareUrl = useMemo(() => {
    const { values, ok } = validateMode(mode, states[mode])
    if (!ok) return null
    return `${window.location.origin}${import.meta.env.BASE_URL}${buildModeShareQuery({ mode, values, unit })}`
  }, [mode, states, unit])

  const modeOptions = useMemo(
    () => [
      { value: 'profit' as SegmentId, label: (<><IconPercent size={16} /> {t('modes.profit')}</>) },
      { value: 'sell' as SegmentId, label: (<><IconScale size={16} /> {t('modes.sell')}</>) },
      { value: 'discount' as SegmentId, label: (<><IconTag size={16} /> {t('modes.discount')}</>) },
    ],
    [t],
  )

  const profitKindOptions = useMemo(
    () => [
      { value: 'cash' as ProfitKind, label: (<><IconPercent size={14} /> {t('installment.cash')}</>) },
      { value: 'installments' as ProfitKind, label: (<><IconWallet size={14} /> {t('installment.installments')}</>) },
    ],
    [t],
  )

  const installmentDirectionOptions = useMemo(
    () => [
      { value: 'installment' as ModeId, label: t('installment.forward') },
      { value: 'rinstallment' as ModeId, label: t('installment.reverse') },
    ],
    [t],
  )

  const directionOptions = useMemo(
    () => [
      {
        value: 'discount' as ModeId,
        label: (<><IconTag size={14} /> {t('discountDirection.forward')}</>),
        /* The top segmented control already owns `seg-discount`; two elements with one name
           would leave the coach pointing at whichever the query found first. */
        tour: null,
      },
      { value: 'rdiscount' as ModeId, label: (<><IconTagReverse size={14} /> {t('discountDirection.reverse')}</>) },
    ],
    [t],
  )

  const result = results[mode]
  const lensFields = visibleFields(mode, states[mode]).filter((field) => field.group === 'lens')

  return (
    <main className="flex flex-col gap-4">
      <SegmentedControl<SegmentId>
        layoutId="mode-segment"
        ariaLabel={t('results.title')}
        value={SEGMENTS[segmentIndex] as SegmentId}
        onChange={onSegmentChange}
        options={modeOptions}
        tourPrefix="seg-"
      />

      <AnimatePresence initial={false}>
        {isProfitSegment && (
          <SubControl key="profit-kind" reducedMotion={!!reducedMotion}>
            <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
            <SegmentedControl<ProfitKind>
              layoutId="profit-kind"
              ariaLabel={t('modes.profit')}
              value={isInstallment ? 'installments' : 'cash'}
              onChange={onProfitKindChange}
              options={profitKindOptions}
              size="sm"
              tourPrefix="seg-"
            />
            </div>
            <HelpButton lesson="installments" />
            </div>
          </SubControl>
        )}
        {isProfitSegment && isInstallment && (
          <SubControl key="installment-direction" reducedMotion={!!reducedMotion}>
            <SegmentedControl<ModeId>
              layoutId="installment-direction"
              ariaLabel={t('modes.installment')}
              value={mode}
              onChange={(next) => {
                setMode(next)
                emitTour({ type: 'mode:change', mode: next })
              }}
              options={installmentDirectionOptions}
              size="sm"
              tourPrefix="seg-"
            />
          </SubControl>
        )}
        {isDiscountSegment && (
          <SubControl key="discount-direction" reducedMotion={!!reducedMotion}>
            <SegmentedControl<ModeId>
              layoutId="discount-direction"
              ariaLabel={t('modes.discount')}
              value={mode}
              onChange={(next) => {
                setMode(next)
                emitTour({ type: 'mode:change', mode: next })
              }}
              options={directionOptions}
              size="sm"
              tourPrefix="seg-"
            />
          </SubControl>
        )}
      </AnimatePresence>

      {/* overflow-x is clipped here so the slide transition can never widen the page (mobile shake fix) */}
      <div className="relative -mx-5 overflow-x-clip px-5">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          {/*
           * A `<form>`, not a `<div>`: none of the number fields had any way to submit on
           * Enter — no `<form>` to submit, no `onKeyDown` on any of them — so typing the last
           * field and pressing Enter (the ordinary way to finish a form on both a physical and a
           * software keyboard) silently did nothing until Calculate was found and tapped by hand.
           * A real `<form>` with the Calculate button as its submit button gives every field that
           * for free, natively, in both languages and with no per-field wiring — the same way
           * `SaveProductSheet`'s single name field already did it by hand.
           */}
          <motion.form
            key={mode}
            custom={direction}
            initial={reducedMotion ? false : { opacity: 0, x: 28 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -28 * direction }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void calculate()
            }}
          >
            <ModeFields mode={mode} state={states[mode]} errors={errors[mode]} lang={lang} onChange={setField} />

            {lensFields.length > 0 && (
              <LensRow
                fields={lensFields}
                state={states[mode]}
                errors={errors[mode]}
                lang={lang}
                monthlyInflationPercent={monthlyInflationPercent}
                onChange={setField}
                onOpenInflationSetting={onOpenSettings}
              />
            )}

            <motion.button
              type="submit"
              data-tour="btn-calculate"
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {t('actions.calculate')}
            </motion.button>

            {result && (
              <Suspense fallback={null}>
                <ResultCard
                  result={result}
                  lang={lang}
                  unit={unit}
                  shareUrl={shareUrl}
                  onAddToBasket={addToBasket}
                  onSaveProduct={result.product ? () => onSaveProduct({ ...result.product!, unit }) : undefined}
                  onOpenSchedule={
                    result.schedule
                      ? () => {
                          setSchedule(result.schedule ?? null)
                          setScheduleOpen(true)
                        }
                      : undefined
                  }
                />
              </Suspense>
            )}

            {result?.product ? (
              <Suspense fallback={null}>
                {/* The calculator itself touches no database. If the product link cannot reach
                    one, it disappears — it must never take the result card with it. */}
                <ErrorBoundary label="the product link" fallback={() => null}>
                <CalcProductLink
                  cost={result.product.cost}
                  lang={lang}
                  unit={unit}
                  rates={rates}
                  onChanged={onProductsChanged}
                />
                </ErrorBoundary>
              </Suspense>
            ) : null}
          </motion.form>
        </AnimatePresence>
      </div>

      <Suspense fallback={null}>
        {(scheduleOpen || schedule !== null) && (
          <ScheduleSheet
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            schedule={schedule}
            lang={lang}
            unit={unit}
          />
        )}
      </Suspense>
    </main>
  )
}

/** A sub-control that springs open under the segmented control without shifting the layout. */
function SubControl({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, height: 0, marginTop: -16 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

function asModeId(value: string | undefined): ModeId | null {
  return isModeId(value) ? value : null
}
