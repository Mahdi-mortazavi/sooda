/**
 * The tutorial's memory: `localStorage['sooda.learn.v1']`, in the shape the plan freezes.
 *
 * Two rules run through every function here.
 *
 * The first is that storage may not be there. Private windows, a profile with site data blocked,
 * a full disk — all of them make `localStorage` throw on the way in or the way out. A tutorial
 * that refused to run because it could not take notes would be a worse failure than one that
 * forgets, so every access is wrapped and an unreachable store falls back to an in-memory record
 * that lasts the session.
 *
 * The second is that nothing read back is trusted. The key is outside the `sooda:` namespace a
 * backup restores blindly, and a user can edit it by hand; every field is checked and anything
 * unrecognisable is replaced with its default rather than being handed to a renderer.
 */

import { LEARN_STORAGE_KEY } from './entry'
import {
  GOAL_IDS,
  LESSON_IDS,
  isGoalId,
  type GoalId,
  type LearnProgress,
  type LessonId,
  type LessonProgress,
  type LessonStatus,
} from './types'

const STATUSES: readonly LessonStatus[] = ['new', 'progress', 'done', 'passed']

export function defaultProgress(): LearnProgress {
  const lessons = {} as Record<LessonId, LessonProgress>
  for (const id of LESSON_IDS) lessons[id] = { status: 'new', step: 0 }
  return { onboardingDone: false, goals: [], lessons, tipsSeen: [], tipsEnabled: true }
}

/* Used only while storage is unreachable, so the lesson a user is in the middle of still resumes
 * and a tip still shows once. Deliberately not a cache of a working store: two sources of truth
 * would let a second tab's write be silently overwritten by this one's stale copy. */
let memory: LearnProgress | null = null
let storageUsable = true

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readLesson(value: unknown): LessonProgress {
  if (!isRecord(value)) return { status: 'new', step: 0 }
  const status = STATUSES.includes(value.status as LessonStatus) ? (value.status as LessonStatus) : 'new'
  const rawStep = value.step
  const step = typeof rawStep === 'number' && Number.isFinite(rawStep) && rawStep >= 0 ? Math.floor(rawStep) : 0
  const passedAt = typeof value.passedAt === 'number' && Number.isFinite(value.passedAt) ? value.passedAt : undefined
  return { status, step, ...(passedAt === undefined ? {} : { passedAt }) }
}

/** Total: any input at all becomes a usable record. Exported so a test can feed it rubbish. */
export function parseProgress(raw: unknown): LearnProgress {
  const base = defaultProgress()
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return base
    }
  }
  if (!isRecord(parsed)) return base
  base.onboardingDone = parsed.onboardingDone === true
  base.tipsEnabled = parsed.tipsEnabled !== false
  if (Array.isArray(parsed.goals)) {
    // De-duplicated and put back into the canonical order, so the recommended path is stable.
    const picked = new Set(parsed.goals.filter((g): g is GoalId => typeof g === 'string' && isGoalId(g)))
    base.goals = GOAL_IDS.filter((g) => picked.has(g))
  }
  if (Array.isArray(parsed.tipsSeen)) {
    base.tipsSeen = parsed.tipsSeen.filter((id): id is string => typeof id === 'string')
  }
  if (isRecord(parsed.lessons)) {
    for (const id of LESSON_IDS) base.lessons[id] = readLesson(parsed.lessons[id])
  }
  return base
}

export function readProgress(): LearnProgress {
  if (!storageUsable) return memory ?? (memory = defaultProgress())
  try {
    return parseProgress(localStorage.getItem(LEARN_STORAGE_KEY))
  } catch {
    storageUsable = false
    return memory ?? (memory = defaultProgress())
  }
}

export function writeProgress(next: LearnProgress): void {
  memory = next
  if (!storageUsable) return
  try {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota, a private window, or storage taken away mid-session. The record lives in memory now.
    storageUsable = false
  }
}

/** Read-modify-write. Returns the record that was stored, so a caller can render from it. */
export function updateProgress(change: (current: LearnProgress) => LearnProgress): LearnProgress {
  const next = change(readProgress())
  writeProgress(next)
  return next
}

/* ── the operations the UI actually performs ─────────────────────────────── */

export function setLessonProgress(id: LessonId, patch: Partial<LessonProgress>): LearnProgress {
  return updateProgress((current) => {
    const before = current.lessons[id]
    const after: LessonProgress = { ...before, ...patch }
    /* A lesson already passed cannot be demoted by replaying it: someone revisiting a lesson they
     * have mastered must not lose the badge halfway through. */
    if (before.status === 'passed' && patch.status !== undefined && patch.status !== 'passed') {
      after.status = 'passed'
    }
    return { ...current, lessons: { ...current.lessons, [id]: after } }
  })
}

export function markLessonPassed(id: LessonId, now = Date.now()): LearnProgress {
  return setLessonProgress(id, { status: 'passed', step: 0, passedAt: now })
}

export function setGoals(goals: GoalId[]): LearnProgress {
  const picked = new Set(goals)
  return updateProgress((current) => ({ ...current, goals: GOAL_IDS.filter((g) => picked.has(g)) }))
}

export function finishOnboarding(done = true): LearnProgress {
  return updateProgress((current) => ({ ...current, onboardingDone: done }))
}

export function markTipSeen(id: string): LearnProgress {
  return updateProgress((current) =>
    current.tipsSeen.includes(id) ? current : { ...current, tipsSeen: [...current.tipsSeen, id] },
  )
}

export function setTipsEnabled(enabled: boolean): LearnProgress {
  return updateProgress((current) => ({ ...current, tipsEnabled: enabled }))
}

/** «ریست پیشرفت آموزش» — forgets the lessons and the tips, keeps the goals they chose. */
export function resetLessonProgress(): LearnProgress {
  return updateProgress((current) => ({
    ...current,
    lessons: defaultProgress().lessons,
    tipsSeen: [],
  }))
}

/** «دیدن دوبارهٔ معرفی» — puts the first-run flow back, without touching what they have learnt. */
export function replayOnboarding(): LearnProgress {
  return finishOnboarding(false)
}

/** Part of "Erase all data": the tutorial's record is the user's too. Never throws. */
export function clearProgress(): void {
  memory = null
  try {
    localStorage.removeItem(LEARN_STORAGE_KEY)
  } catch {
    // storage unavailable — there was nothing stored to remove
  }
}

/* ── backup ──────────────────────────────────────────────────────────────── */

/**
 * The record as it rides in a backup file.
 *
 * `lib/backup.ts` collects every `sooda:`-prefixed localStorage key and restores only those, and
 * this key is deliberately outside that namespace — so Settings carries it across by hand rather
 * than the progress store being renamed into a namespace a restore writes blindly.
 */
export function exportProgress(): string {
  return JSON.stringify(readProgress())
}

export function importProgress(raw: string): void {
  writeProgress(parseProgress(raw))
}

/* ── derived ─────────────────────────────────────────────────────────────── */

export function isFinished(status: LessonStatus): boolean {
  return status === 'done' || status === 'passed'
}

export interface Mastery {
  finished: number
  passed: number
  total: number
  /** Every lesson answered correctly — the «استاد سودا» badge. */
  master: boolean
}

export function mastery(progress: LearnProgress): Mastery {
  let finished = 0
  let passed = 0
  for (const id of LESSON_IDS) {
    const status = progress.lessons[id].status
    if (isFinished(status)) finished += 1
    if (status === 'passed') passed += 1
  }
  return { finished, passed, total: LESSON_IDS.length, master: passed === LESSON_IDS.length }
}
