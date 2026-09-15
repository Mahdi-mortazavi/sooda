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
import { Challenges } from './Challenges'
import { LearnCenter } from './LearnCenter'
import { Onboarding, type OnboardingStage } from './Onboarding'
import { TipBar } from './TipBar'
import { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_ROUNDING_STEP } from '../lessons/rate'
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
import type { Challenge } from '../lessons/types'
import type { LearnRequest } from './entry'

const Coach = lazy(() => import('../coach/Coach').then((m) => ({ default: m.Coach })))

/** Mission 1 — the calculation every shopkeeper does first, so onboarding ends on a real answer. */
const MISSION_ONE: LessonId = 'profit'

/** Practice must never ask the browser for persistent storage: the prompt would land mid-lesson. */
const NO_PERSIST = async (): Promise<boolean> => false

interface ActiveLesson {
  id: LessonId
  steps: LessonStep[]
  /** The questions asked after the steps: the typed and multiple-choice ones only. */
  quiz: Challenge[]
  session: PracticeSession
  startIndex: number
  /** Onboarding's Mission 1 returns to the celebration screen rather than to the centre. */
  mission: boolean
}

/**
 * A `task` challenge is «do it in the practice shop», which is what a step already is — same
 * target, same event-judged predicate, same demo. So it is appended to the steps and the coach
 * runs it, rather than a second runner being built to do the same job slightly differently.
 */
function splitChallenges(steps: LessonStep[], challenges: Challenge[]): { steps: LessonStep[]; quiz: Challenge[] } {
  const tasks: LessonStep[] = []
  const quiz: Challenge[] = []
  for (const challenge of challenges) {
    if (challenge.kind !== 'task') {
      quiz.push(challenge)
      continue
    }
    tasks.push({
      id: challenge.id,
      target: challenge.target,
      textKey: challenge.promptKey,
      expect: challenge.done,
      demo: challenge.demo,
    })
  }
  return { steps: [...steps, ...tasks], quiz }
}

export interface LearnHostProps {
  request: LearnRequest
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
  onPractice,
  navigate,
  tip,
  onTipDismiss,
  onClose,
}: LearnHostProps) {
  const { t, i18n } = useTranslation()
  /* Derived rather than passed: App would have to compute and thread both through the entry
   * chunk, and i18next already knows. */
  const lang: AppLanguage = i18n.language.startsWith('fa') ? 'fa' : 'en'
  const rtl = lang === 'fa'
  const [progress, setProgress] = useState<LearnProgress>(readProgress)
  const [stage, setStage] = useState<OnboardingStage>('intro')
  const [active, setActive] = useState<ActiveLesson | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /* The lesson whose questions are being asked. Practice has already been torn down by then. */
  const [quiz, setQuiz] = useState<ActiveLesson | null>(null)
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
      /* No pinned `now`: `lessons` dates the demo shop from the real clock deliberately, because
       * every «۱ ماه پیش» on the products tab is measured against it. */
      const result = await enterPractice({
        /* The demo shop's product names go through i18n as it is seeded, so an English-locale
         * learner is not reading five Persian rows inside English lesson text. */
        translate: (key: string, fallback: string) => t(key, { defaultValue: fallback }),
      })
      if (!result.ok) {
        if (result.reason === 'storage') {
          setNotice(t('learn.needsStorage', { defaultValue: 'Practice needs storage, and this browser refused.' }))
        }
        return
      }
      const session = result.session
      onPractice({
        repository: session.repository,
        db: session.db,
        persist: NO_PERSIST,
        practice: true,
        pinned: { monthlyInflationPercent: TUTORIAL_MONTHLY_PERCENT, roundingStep: TUTORIAL_ROUNDING_STEP },
      })
      const stored = readProgress().lessons[id]
      const split = splitChallenges(definition.steps, definition.challenges)
      setActive({
        id,
        steps: split.steps,
        quiz: split.quiz,
        session,
        startIndex: stored.status === 'progress' ? stored.step : 0,
        mission,
      })
      setCenterOpen(false)
    },
    [onPractice, t],
  )

  /** Where a lesson lands once its steps and its questions are behind it. */
  const settle = useCallback(
    (lesson: ActiveLesson, passed: boolean) => {
      setProgress(passed ? markLessonPassed(lesson.id) : setLessonProgress(lesson.id, { status: 'done', step: 0 }))
      if (lesson.mission) {
        setProgress(finishOnboarding(true))
        setStage('celebrate')
        return
      }
      setCenterOpen(true)
      setNotice(
        passed
          ? t('learn.passedNotice', { defaultValue: 'Lesson passed.' })
          : t('learn.doneNotice', { defaultValue: 'Lesson finished — answer its question to pass it.' }),
      )
    },
    [t],
  )

  const finishLesson = useCallback(
    (lesson: ActiveLesson, outcome: { finished: boolean; atStep: number }) => {
      setActive(null)
      void leavePractice()
      if (!outcome.finished) {
        /* Left partway through. The step index is kept so «ادامه» resumes exactly there —
         * nothing in the tutorial is ever lost by walking away from it. */
        setProgress(setLessonProgress(lesson.id, { status: 'progress', step: outcome.atStep }))
        if (lesson.mission) {
          setProgress(finishOnboarding(true))
          setStage('celebrate')
          return
        }
        setCenterOpen(true)
        return
      }
      /* The practice store is gone by now, and the remaining questions do not need it: a `task`
       * challenge was run as a step. Anything left is a figure to type or a verdict to pick. */
      if (lesson.quiz.length > 0) {
        setQuiz(lesson)
        return
      }
      settle(lesson, true)
    },
    [leavePractice, settle],
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
          open={active === null && quiz === null}
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
          open={centerOpen && active === null && quiz === null}
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
            onComplete={() => finishLesson(active, { finished: true, atStep: 0 })}
            onExit={(atIndex) => finishLesson(active, { finished: false, atStep: atIndex })}
          />
        </Suspense>
      ) : null}

      {quiz !== null ? (
        <Challenges
          open
          lang={lang}
          title={t(`learn.lessons.${quiz.id}.title`)}
          challenges={quiz.quiz}
          onPassed={() => {
            setQuiz(null)
            settle(quiz, true)
          }}
          onSkip={() => {
            setQuiz(null)
            settle(quiz, false)
          }}
        />
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
