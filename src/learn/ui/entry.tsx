/**
 * The only part of the Learning Centre that is allowed in the entry chunk.
 *
 * The plan's budget gate names exactly three things that may be paid for by a shopkeeper who
 * never opens a lesson: the first-run check, the `?learn` parser, and the "?" buttons. They all
 * live here, with nothing imported beyond React and i18next, so nothing else can hitch a ride.
 *
 * Everything with a lesson in it — the centre, onboarding, the coach, the sandbox, the progress
 * store — is behind `await import()` from `LearnHost`.
 */

import { createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'

/** Frozen in `docs/v1.5-plan.md`. A dot, not a colon: it is deliberately outside `sooda:`. */
export const LEARN_STORAGE_KEY = 'sooda.learn.v1'

/**
 * Reads the progress record without trusting any of it.
 *
 * Storage can be absent (private mode), refused (a locked-down profile) or hold something a
 * previous version — or a hand-edited file — left behind. Every caller here only ever asks one
 * yes/no question of the answer, so an unreadable store degrades to "not yet", never to a throw.
 */
function readStored(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(LEARN_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** True once first-run onboarding has been finished or skipped. */
export function hasOnboarded(): boolean {
  return readStored()?.onboardingDone === true
}

/**
 * Whether a just-in-time tip may still be shown.
 *
 * Off when the user turned tips off in Settings, and off for good once this particular tip has
 * been seen — the brief allows each one exactly once, and a tip that reappears is an interruption
 * rather than a hint.
 */
export function tipAllowed(id: string): boolean {
  const stored = readStored()
  if (stored === null) return true
  if (stored.tipsEnabled === false) return false
  const seen = stored.tipsSeen
  return !Array.isArray(seen) || !seen.includes(id)
}

/**
 * Parses `?learn` out of a query string.
 *
 * `null` — no `?learn` at all. `''` — a bare `?learn`, which opens the centre (the manifest
 * shortcut uses this). Anything else is a lesson id, validated later by the centre itself so the
 * eight ids do not have to sit in the entry chunk.
 */
export function parseLearnQuery(search: string): string | null {
  const match = /[?&]learn(?:=([^&]*))?/.exec(search)
  if (match === null) return null
  try {
    return decodeURIComponent(match[1] ?? '')
  } catch {
    // A malformed escape is still a request for the tutorial; open the centre rather than nothing.
    return ''
  }
}

/** What a lesson, the centre or onboarding was asked for. */
export type LearnRequest =
  | { kind: 'onboarding' }
  | { kind: 'center' }
  /** `id` is unvalidated here; the centre falls back to its own list when it does not know it. */
  | { kind: 'lesson'; id: string }

export interface LearnApi {
  /** Opens the Learning Centre, at a lesson when one is named. */
  open(lesson?: string): void
  /** Offers a one-line hint the first time a complex feature is used. A no-op if already seen. */
  tip(id: string): void
}

/**
 * Null only in tests and in a tree rendered without the provider. Components treat that as
 * "there is no tutorial here" and render nothing, rather than guessing.
 */
export const LearnContext = createContext<LearnApi | null>(null)

export function useLearn(): LearnApi | null {
  return useContext(LearnContext)
}

/**
 * The small "?" beside a control that has a lesson behind it.
 *
 * Deliberately a plain button with no chunk of its own: it is the one piece of the tutorial the
 * budget lets first paint pay for, so it is a glass circle, an aria-label and a callback.
 */
export function HelpButton({ lesson, className = '' }: { lesson: string; className?: string }) {
  const learn = useLearn()
  const { t } = useTranslation()
  if (learn === null) return null
  const label = t('learn.help', { defaultValue: 'What is this?' })
  return (
    <button
      type="button"
      onClick={() => learn.open(lesson)}
      aria-label={label}
      title={label}
      className={`glass glass-ring flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-bold text-[var(--accent-text)] ${className}`}
    >
      <span aria-hidden>{t('learn.helpMark', { defaultValue: '?' })}</span>
    </button>
  )
}
