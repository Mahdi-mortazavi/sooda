/**
 * Everything the tutorial does, behind one `import()`.
 *
 * App holds two pieces of state and a lazy boundary; this holds the rest — the progress record,
 * the practice session, the coach, onboarding and the centre. Nothing here is reachable from the
 * entry chunk, which is what lets the budget gate hold for a shopkeeper who never opens a lesson.
 *
 * The one thing it hands back up is the repository. Starting a lesson swaps the context App
 * provides for `session.repository`, so every component that writes a product or a price reading
 * writes to the demo shop instead of the real one; leaving puts it back and deletes the database.
 * That swap is the plan's repository-injection rule, and it is the only reason practice is safe.
 */

import { AnimatePresence } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import type { AppLanguage } from '../../lib/numbers'
import { emitTour } from '../coach/events'
import type { SandboxState, TourCtx, TourDestination } from '../coach/types'
import type { PracticeSession } from '../sandbox'
import { LearnCenter } from './LearnCenter'
import { Onboarding, type OnboardingStage } from './Onboarding'
import { TipBar } from './TipBar'
import { loadLesson, lessonsAvailable } from './lessonSource'
import {
  finishOnboarding,
  markLessonPassed,
  readProgress,
  setGoals,
  setLessonProgress,
} from './progress'
import type { RepositoryValue } from './repositoryContext'
import { isLessonId, type GoalId, type LearnProgress, type LessonId } from './types'
import type { LessonStep } from '../coach/types'
import type { LearnRequest } from './entry'

const Coach = lazy(() => import('../coach/Coach').then((m) => ({ default: m.Coach })))

/** Mission 1 — the calculation every shopkeeper does first, so onboarding ends on a real answer. */
const MISSION_ONE: LessonId = 'profit'

/** Practice must never ask the browser for persistent storage: the prompt would land mid-lesson. */
const NO_PERSIST = async (): Promise<boolean> => false

interface ActiveLesson {
  id: LessonId
  steps: LessonStep[]
  session: PracticeSession
  startIndex: number
  /** Onboarding's Mission 1 returns to the celebration screen rather than to the centre. */
  mission: boolean
}

export interface LearnHostProps {
  request: LearnRequest
  lang: AppLanguage
  rtl: boolean
  /** Swaps what `RepositoryContext` provides. `null` puts the real shop back. */
  onPractice: (value: RepositoryValue | null) => void
  /** Puts the app where a step needs it before the step runs. */
  navigate: (to: TourDestination) => Promise<void>
  /** A just-in-time tip App has decided to offer, or null. */
  tip: string | null
  onTipDismiss: () => void
  onClose: () => void
}

export function LearnHost({
  request,
  lang,
  rtl,
  onPractice,
  navigate,
  tip,
  onTipDismiss,
  onClose,
}: LearnHostProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<LearnProgress>(readProgress)
  const [stage, setStage] = useState<OnboardingStage>('intro')
  const [active, setActive] = useState<ActiveLesson | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [centerOpen, setCenterOpen] = useState(request.kind !== 'onboarding')
  const startedFor = useRef<string | null>(null)

  const onboarding = request.kind === 'onboarding'

  /* ---- practice ---- */

  const leavePractice = useCallback(async () => {
    onPractice(null)
    const { exitPractice } = await import('../sandbox')
    await exitPractice()
  }, [onPractice])

  /* The database outlives a render, so leaving it behind on unmount would keep a second Dexie
   * store on the device until the next launch — and, worse, keep the repository swapped. */
  useEffect(() => {
    return () => {
      void leavePractice()
    }
  }, [leavePractice])

  const startLesson = useCallback(
    async (id: LessonId, mission = false) => {
      setNotice(null)
      const definition = await loadLesson(id)
      if (definition === null || definition.steps.length === 0) {
        if (mission) {
          // Nothing to practise yet — onboarding still finishes on its own terms.
          setStage('celebrate')
          return
        }
        setNotice(t('learn.unavailable', { defaultValue: 'Lessons are being prepared.' }))
        return
      }
      const { enterPractice } = await import('../sandbox')
      const result = await enterPractice(definition.now === undefined ? {} : { now: definition.now })
      if (!result.ok) {
        if (result.reason === 'storage') {
          setNotice(t('learn.needsStorage', { defaultValue: 'Practice needs storage, and this browser refused.' }))
        }
        return
      }
      const session = result.session
      onPractice({ repository: session.repository, db: session.db, persist: NO_PERSIST, practice: true })
      const stored = readProgress().lessons[id]
      setActive({
        id,
        steps: definition.steps,
        session,
        startIndex: stored.status === 'progress' ? stored.step : 0,
        mission,
      })
      setCenterOpen(false)
    },
    [onPractice, t],
  )

  const finishLesson = useCallback(
    (lesson: ActiveLesson, outcome: { passed: boolean; atStep: number }) => {
      setActive(null)
      void leavePractice()
      const next = outcome.passed
        ? markLessonPassed(lesson.id)
        : setLessonProgress(lesson.id, { status: 'progress', step: outcome.atStep })
      setProgress(next)
      if (lesson.mission) {
        setProgress(finishOnboarding(true))
        setStage('celebrate')
        return
      }
      setCenterOpen(true)
      if (outcome.passed) {
        setNotice(t('learn.passedNotice', { defaultValue: 'Lesson passed.' }))
      }
    },
    [leavePractice, t],
  )

  /* ---- the request ---- */

  useEffect(() => {
    if (request.kind !== 'lesson') return
    /* Guarded by the id: React runs effects again on every re-render of a changed parent, and a
     * second `enterPractice` would tear down the database the first one is running on. */
    if (startedFor.current === request.id) return
    startedFor.current = request.id
    if (!isLessonId(request.id)) {
      setCenterOpen(true)
      return
    }
    void startLesson(request.id)
  }, [request, startLesson])

  /* ---- the coach's context ---- */

  const session = active?.session ?? null
  const ctx: TourCtx | null = useMemo(() => {
    if (session === null) return null
    return {
      emit: emitTour,
      /* A getter, not a captured value: the plan's refresh rule has the coach re-read the store
       * before every `expect`, and a frozen snapshot would make that re-read pointless. */
      get sandbox(): SandboxState {
        return session.snapshot()
      },
      async refreshSandbox(): Promise<void> {
        await session.readState()
      },
      navigate,
    }
  }, [session, navigate])

  const onStart = useCallback(
    (id: LessonId) => {
      void startLesson(id)
    },
    [startLesson],
  )

  const onSkipOnboarding = useCallback(() => {
    setProgress(finishOnboarding(true))
    onClose()
  }, [onClose])

  const onStartMission = useCallback(
    (goals: GoalId[]) => {
      setProgress(setGoals(goals))
      if (stage === 'intro') {
        setStage('goals')
        return
      }
      void startLesson(MISSION_ONE, true)
    },
    [stage, startLesson],
  )

  const noticeStrip =
    notice === null ? null : (
      <p
        role="status"
        className="mb-3 rounded-2xl bg-accent-500/14 px-4 py-2.5 text-[13.5px] font-semibold text-[var(--accent-text)]"
      >
        {notice}
      </p>
    )

  return (
    <>
      {onboarding ? (
        <Onboarding
          open={active === null}
          stage={stage}
          lang={lang}
          rtl={rtl}
          onStartMission={onStartMission}
          onSkip={onSkipOnboarding}
          onOpenCenter={() => {
            setProgress(finishOnboarding(true))
            setStage('intro')
            setCenterOpen(true)
          }}
          onFinish={() => {
            setProgress(finishOnboarding(true))
            onClose()
          }}
        />
      ) : null}

      {onboarding && !centerOpen ? null : (
        <LearnCenter
          open={centerOpen && active === null}
          onClose={onClose}
          lang={lang}
          progress={progress}
          onStart={onStart}
          available={lessonsAvailable()}
          notice={noticeStrip}
        />
      )}

      {active !== null && ctx !== null ? (
        <Suspense fallback={null}>
          <Coach
            steps={active.steps}
            ctx={ctx}
            initialIndex={active.startIndex}
            onComplete={() => finishLesson(active, { passed: true, atStep: 0 })}
            onExit={(atIndex) => finishLesson(active, { passed: false, atStep: atIndex })}
          />
        </Suspense>
      ) : null}

      <AnimatePresence>
        {tip !== null ? (
          <TipBar
            key={tip}
            id={tip}
            onDismiss={onTipDismiss}
            onOpenLesson={(lesson) => {
              onTipDismiss()
              void startLesson(lesson)
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
