/**
 * The DOM half of the spotlight: finding the target, keeping its rect true as the page
 * scrolls and reflows, reading the safe area, and taking the rest of the app out of the
 * tab order. All of the deciding happens in `geometry.ts`, which knows none of this.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react'
import { useReducedMotion } from 'motion/react'
import type { Rect, Size } from './geometry'

/** How long to keep looking for a target that a still-opening sheet has not rendered yet. */
const FIND_TIMEOUT_MS = 2000
/** How long to keep re-reading the rect after a step begins, while smooth scrolling settles. */
const SETTLE_MS = 700
/** Sub-pixel churn from a spring is not a move worth re-rendering for. */
const EPSILON = 0.5

/** The browser's own safe-area names are physical; they are made logical at the call site. */
export interface SafeArea {
  top: number
  bottom: number
  left: number
  right: number
}

function escapeAttribute(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')
}

/** The one place a `data-tour` name is turned into an element. */
export function findTourTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${escapeAttribute(name)}"]`)
}

function readRect(element: Element): Rect {
  const box = element.getBoundingClientRect()
  return { x: box.left, y: box.top, width: box.width, height: box.height }
}

function sameRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.width - b.width) < EPSILON &&
    Math.abs(a.height - b.height) < EPSILON
  )
}

export interface SpotlightTarget {
  element: HTMLElement | null
  /** Null until the element exists — the overlay dims but waits before drawing a hole. */
  rect: Rect | null
  /** Re-read now. The runner calls it after a demo action moves something. */
  remeasure: () => void
}

/**
 * Track one `data-tour` target. Scrolls it into view before the first measurement, then
 * follows it: a spring-animated sheet keeps moving for a few hundred milliseconds after
 * `scrollIntoView` returns, so a single read would pin the hole to where the target was.
 */
export function useSpotlightTarget(name: string): SpotlightTarget {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const reducedMotion = useReducedMotion()

  /*
   * A step often starts while the sheet holding its target is still mounting, so a miss is
   * normal for a frame or two. Setting the same null twice is free — React bails out.
   *
   * It keeps watching after a hit, and that is the whole point. This used to stop resolving the
   * moment it found anything, which held whatever node existed at that instant for the life of
   * the step — so when the previous step's mode switch made React re-create the control, the
   * coach stayed pinned to the detached one. Everything downstream then failed together:
   * `measure` bailed on `!isConnected` and the hole fell back to a stub offscreen, the `inert`
   * sweep never re-ran around the live node so the real target stayed inside an inert subtree,
   * and the blocker swallowed every click on it. Six of the eight lessons dead-ended, and
   * «نشانم بده» could not get past it either, because it calls `click()` on an inert element.
   *
   * The re-query is skipped while the element we hold is still connected, so the steady-state
   * cost is an identity check per frame rather than a `querySelector`.
   */
  useEffect(() => {
    let frame = 0
    const deadline = Date.now() + FIND_TIMEOUT_MS
    let everFound = false
    const find = () => {
      setElement((previous) => {
        if (previous !== null && previous.isConnected) return previous
        const found = findTourTarget(name)
        if (found !== null) everFound = true
        return found
      })
      /* The deadline only governs a target that has never appeared — a step pointing at
       * something that does not exist must not spin forever. Once one has been seen, the step
       * keeps watching for as long as it is on screen, because the node can be replaced again. */
      if (everFound || Date.now() < deadline) frame = requestAnimationFrame(find)
    }
    find()
    return () => cancelAnimationFrame(frame)
  }, [name])

  const measure = useCallback(() => {
    setRect((previous) => {
      if (!element || !element.isConnected) return null
      const next = readRect(element)
      return previous && sameRect(previous, next) ? previous : next
    })
  }, [element])

  useEffect(() => {
    if (!element) {
      setRect(null)
      return
    }
    element.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })

    let frame = 0
    const settleUntil = Date.now() + SETTLE_MS
    const follow = () => {
      measure()
      if (Date.now() < settleUntil) frame = requestAnimationFrame(follow)
    }
    follow()

    // Capture phase: the scroll that matters is usually a pane's, not the window's.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    const visual = window.visualViewport ?? null
    visual?.addEventListener('resize', measure)
    visual?.addEventListener('scroll', measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      visual?.removeEventListener('resize', measure)
      visual?.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [element, measure, reducedMotion])

  return { element, rect, remeasure: measure }
}

/**
 * The layout viewport, which is the coordinate space `getBoundingClientRect` reports in.
 * `visualViewport` is listened to but not measured: its box is offset when the page is
 * pinch-zoomed, and mixing the two spaces puts the hole in the wrong place.
 */
export function useViewportSize(): Size {
  const [size, setSize] = useState<Size>(() => readViewport())
  useEffect(() => {
    const update = () =>
      setSize((previous) => {
        const next = readViewport()
        return previous.width === next.width && previous.height === next.height ? previous : next
      })
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    const visual = window.visualViewport ?? null
    visual?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      visual?.removeEventListener('resize', update)
    }
  }, [])
  return size
}

function readViewport(): Size {
  const root = document.documentElement
  return { width: root.clientWidth, height: root.clientHeight }
}

/** Measure an element the component itself renders — here, the tooltip. */
export function useMeasuredSize(ref: RefObject<HTMLElement | null>, key: string, initial: Size): Size {
  const [size, setSize] = useState<Size>(initial)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () =>
      setSize((previous) => {
        const next = { width: node.offsetWidth, height: node.offsetHeight }
        return previous.width === next.width && previous.height === next.height ? previous : next
      })
    // Measured synchronously on a step change as well as observed, so the first paint of
    // new copy is already placed against its real height rather than the previous step's.
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, key])
  return size
}

/**
 * `env(safe-area-inset-*)` is not readable from script, so it is read off a throwaway
 * probe. Re-read on resize because a rotation changes which edge the notch is on.
 */
export function useSafeArea(): SafeArea {
  const [area, setArea] = useState<SafeArea>({ top: 0, bottom: 0, left: 0, right: 0 })
  useEffect(() => {
    const read = () => {
      const next = probeSafeArea()
      setArea((previous) => (sameArea(previous, next) ? previous : next))
    }
    read()
    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
    }
  }, [])
  return area
}

function sameArea(a: SafeArea, b: SafeArea): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
}

function probeSafeArea(): SafeArea {
  const empty: SafeArea = { top: 0, bottom: 0, left: 0, right: 0 }
  try {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);' +
      'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'
    document.body.appendChild(probe)
    const style = getComputedStyle(probe)
    const area: SafeArea = {
      top: Number.parseFloat(style.paddingTop) || 0,
      bottom: Number.parseFloat(style.paddingBottom) || 0,
      left: Number.parseFloat(style.paddingLeft) || 0,
      right: Number.parseFloat(style.paddingRight) || 0,
    }
    probe.remove()
    return area
  } catch {
    return empty
  }
}

/** True while the document reads right-to-left, however the attribute got set. */
export function useIsRtl(): boolean {
  const [rtl, setRtl] = useState<boolean>(() => readRtl())
  useEffect(() => {
    const update = () => {
      const next = readRtl()
      setRtl((previous) => (previous === next ? previous : next))
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir', 'lang'] })
    return () => observer.disconnect()
  }, [])
  return rtl
}

function readRtl(): boolean {
  try {
    return getComputedStyle(document.documentElement).direction === 'rtl'
  } catch {
    return document.documentElement.dir === 'rtl'
  }
}

/**
 * Take the rest of the page out of the tab order and the accessibility tree, leaving the
 * overlay and the target's own ancestry alone.
 *
 * `inert` on the app root would be one line, and would also disable the target — the one
 * control the lesson exists to have the user touch. Walking up from the target and marking
 * each ancestor's *siblings* is what "everything except the hole" actually means.
 */
export function applyInertOutside(target: Element | null, keep: readonly (Element | null)[]): () => void {
  const kept = new Set<Element>()
  for (const element of keep) if (element) kept.add(element)
  const marked: Element[] = []

  const mark = (element: Element) => {
    // Something already inert stays inert and is left off the list, so restoring the page
    // cannot un-hide a sheet's backdrop that was inert before the lesson started.
    if (kept.has(element) || element.hasAttribute('inert')) return
    /*
     * `inert` removes a subtree from the accessibility tree, not just from the tab order — so
     * sweeping the practice banner took «این یک مغازهٔ تمرینی است…» and the pinned-rate note
     * away from screen-reader users for the whole lesson. Those are the two facts the plan says
     * must be on screen the entire time, and they were the two an assistive-technology user was
     * never told. Opting out by attribute rather than by ref keeps the rule in the markup that
     * needs it; the containment check matters because the banner is usually a descendant of a
     * branch this would otherwise mark wholesale.
     */
    if (element.querySelector('[data-coach-keep]') !== null || element.hasAttribute('data-coach-keep')) return
    element.setAttribute('inert', '')
    marked.push(element)
  }

  const chain: Element[] = []
  for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
    chain.push(node)
  }

  if (chain.length === 0) {
    for (const child of Array.from(document.body.children)) mark(child)
  } else {
    for (const element of chain) {
      const parent = element.parentElement
      if (!parent) continue
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== element) mark(sibling)
      }
    }
  }

  return () => {
    for (const element of marked) element.removeAttribute('inert')
  }
}

/** Focus without scrolling — the spotlight decides what is on screen, not the focus ring. */
export function focusQuietly(element: HTMLElement | null | undefined): void {
  if (!element || !element.isConnected) return
  try {
    element.focus({ preventScroll: true })
  } catch {
    // A detached or disabled element is not worth failing a step over.
  }
}

/** A stable ref that always holds the latest value, for listeners that outlive a render. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value)
  ref.current = value
  return ref
}
