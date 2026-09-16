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
import { formatNumber, type AppLanguage } from '../../lib/numbers'
import { emitTour } from '../coach/events'
import type { SandboxState, TourCtx, TourDestination } from '../coach/types'
import type { PracticeSession } from '../sandbox'
import { Challenges } from './Challenges'
import { LearnCenter } from './LearnCenter'
import { Onboarding, type OnboardingStage } from './Onboarding'
import { TipBar } from './TipBar'
import { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_ROUNDING_STEP } from '../lessons/rate'
import { loadLesson, loadMission, lessonsAvailable } from './lessonSource'
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

/** Practice must never ask the browser for persistent storage: the prompt would land mid-lesson. */
const NO_PERSIST = async (): Promise<boolean> => false

interface ActiveRun {
  /**
   * `null` for Mission 1, which is not a lesson: it has no card in the centre and no row in the
   * progress map, so there is nothing to mark. Every progress write below is behind this check.
   */
  id: LessonId | null
  steps: LessonStep[]
  /** The questions asked after the steps: the typed and multiple-choice ones only. */
  quiz: Challenge[]
  /** The lesson's own one-line summary, shown as «این را یاد گرفتید» after a right answer. */
  summaryKey: string
  /** Its figures assume the pinned 3%/month, so the note has to be on screen while it runs. */
  showsRate: boolean
  /** …but not from the first step: the step id it is held back until. See the banner. */
  rateNoteFromStep: string | null
  session: PracticeSession
  startIndex: number
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
  /** `null` when nothing was asked for and only a just-in-time tip is keeping the host mounted. */
  request: LearnRequest | null
  /** Swaps what `RepositoryContext` provides. `null` puts the real shop back. */
  onPractice: (value: RepositoryValue | null) => void
  /** Puts the app where a step needs it before the step runs. */
  navigate: (to: TourDestination) => Promise<void>
  /**
   * A just-in-time tip App has decided to offer, or null.
   *
   * App cannot judge whether it is a good moment: it knows a practice session is open, but not
   * that a challenge is being asked with the session already torn down. This component does, and
   * drops the offer below rather than showing it or saving it for later.
   */
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
  const [active, setActive] = useState<ActiveRun | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /* The lesson whose questions are being asked. Practice has already been torn down by then. */
  const [quiz, setQuiz] = useState<ActiveRun | null>(null)
  /* Opened by what was asked for, then owned here: a tip arriving later must not open the centre,
   * and closing the centre must not depend on App clearing the request first. */
  const [centerOpen, setCenterOpen] = useState(request !== null && request.kind !== 'onboarding')
  const startedFor = useRef<string | null>(null)
  /* Fetched as soon as onboarding opens, so the story card has something to show the moment the
   * question is answered rather than a blank panel while a chunk downloads. */
  const [missionStory, setMissionStory] = useState<string | null>(null)

  const onboarding = request?.kind === 'onboarding'

  useEffect(() => {
    if (request?.kind !== 'onboarding') return
    let live = true
    void loadMission().then((mission) => {
      if (live && mission !== null) setMissionStory(mission.storyKey)
    })
    return () => {
      live = false
    }
  }, [request?.kind])

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

  /**
   * Opens the practice shop and hands the coach a script. One path for a lesson and for the
   * mission, because they differ only in what is written down afterwards.
   */
  const startRun = useCallback(
    async (run: {
      id: LessonId | null
      steps: LessonStep[]
      challenges: Challenge[]
      summaryKey: string
      /** The pinned-rate note belongs on screen for any run whose figures depend on it. */
      showsRate: boolean
      /** Hold that note back until this step is on screen. See the banner below. */
      rateNoteFromStep?: string
      suggestion?: { field: string; value: string; label: string }
    }) => {
      setNotice(null)
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
        suggestion: run.suggestion ?? null,
      })
      const stored = run.id === null ? null : readProgress().lessons[run.id]
      const split = splitChallenges(run.steps, run.challenges)
      setActive({
        id: run.id,
        steps: split.steps,
        quiz: split.quiz,
        summaryKey: run.summaryKey,
        showsRate: run.showsRate,
        rateNoteFromStep: run.rateNoteFromStep ?? null,
        session,
        startIndex: stored !== null && stored.status === 'progress' ? stored.step : 0,
      })
      setCenterOpen(false)
    },
    [onPractice, t],
  )

  const startLesson = useCallback(
    async (id: LessonId) => {
      const definition = await loadLesson(id)
      if (definition === null || definition.steps.length === 0) {
        setNotice(t('learn.unavailable', { defaultValue: 'Lessons are being prepared.' }))
        return
      }
      await startRun({
        id,
        steps: definition.steps,
        challenges: definition.challenges,
        summaryKey: definition.summaryKey,
        showsRate: definition.showsRate,
      })
    },
    [startRun, t],
  )

  /**
   * Mission 1. Not `startLesson('profit')`: the mission is thirty seconds and five steps, and the
   * profit lesson is seventy and seven — running the lesson here would mean a first-time user
   * finishes onboarding without ever seeing what three months does to their margin, which is the
   * one thing the mission exists to show them.
   */
  const startMission = useCallback(async () => {
    const mission = await loadMission()
    if (mission === null || mission.steps.length === 0) {
      // Nothing to run yet: onboarding still finishes on its own terms rather than on a lesson.
      setStage('celebrate')
      return
    }
    await startRun({
      id: null,
      steps: mission.steps,
      challenges: [],
      summaryKey: mission.storyKey,
      showsRate: mission.showsRate,
      /* The mission's own figure, never a second copy of it: the chip fills the field with the
       * same 100,000 its first step is judged against. */
      suggestion: {
        field: mission.suggestion.field,
        value: mission.suggestion.value,
        /* Translated here, so `NumberField` — which is in the entry chunk — never has to reach
         * for i18next to draw a chip almost nobody will ever see. */
        label: t(mission.suggestion.labelKey, {
          replace: { value: formatNumber(Number(mission.suggestion.value), lang, 0) },
        }),
      },
      ...(mission.rateNoteFromStep === undefined ? {} : { rateNoteFromStep: mission.rateNoteFromStep }),
    })
  }, [lang, startRun, t])

  /** Where a run lands once its steps and its questions are behind it. */
  const settle = useCallback(
    (lesson: ActiveRun, passed: boolean) => {
      if (lesson.id === null) {
        // The mission. Nothing to record but that the welcome is over.
        setProgress(finishOnboarding(true))
        setStage('celebrate')
        return
      }
      setProgress(passed ? markLessonPassed(lesson.id) : setLessonProgress(lesson.id, { status: 'done', step: 0 }))
      setCenterOpen(true)
      setNotice(
        passed
          ? t('learn.passedNotice')
          : t('learn.doneNotice'),
      )
    },
    [t],
  )

  const finishLesson = useCallback(
    (lesson: ActiveRun, outcome: { finished: boolean; atStep: number }) => {
      setActive(null)
      /*
       * Mission 1 ends ON its payoff, and that is the one ending the demo shop must survive.
       *
       * The last thing the mission asks for is the second «محاسبه کن», and the card that tap
       * paints — «قیمت پیشنهادی ۱۳۲٬۰۰۰ · سود واقعی ۹٫۸۲٪ · کم‌سود» — is the entire reason the
       * minute exists. Leaving practice here unmounts the calculator in the same frame the step
       * passes, because `App` remounts it across the practice boundary: the payoff was measured
       * on screen for between zero and four tenths of a second, in roughly one run in four, and
       * otherwise never painted at all. A first-time user reached the badge having been shown
       * the one number onboarding is for exactly never.
       *
       * So it is left standing behind the celebration — which is, after all, celebrating it —
       * and comes down when the welcome is closed: by the three handlers below, and by the
       * unmount cleanup whatever happens. Only for the mission, and only when it finished: a
       * lesson's questions are asked with the store already gone, and a mission walked out of
       * halfway has no payoff to keep.
       */
      if (!(lesson.id === null && outcome.finished)) void leavePractice()
      if (!outcome.finished) {
        if (lesson.id === null) {
          setProgress(finishOnboarding(true))
          setStage('celebrate')
          return
        }
        /* Left partway through. The step index is kept so «ادامه» resumes exactly there —
         * nothing in the tutorial is ever lost by walking away from it. */
        setProgress(setLessonProgress(lesson.id, { status: 'progress', step: outcome.atStep }))
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
    if (request === null || request.kind !== 'lesson') return
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

  /**
   * When the pinned-rate note joins the practice banner.
   *
   * «در این تمرین فرض می‌کنیم قیمت‌ها ماهی ۳٪ گران می‌شوند.» qualifies a figure, so it appears
   * with the first figure. A lesson can afford to state the assumption from step 1; Mission 1
   * cannot — thirty seconds long, and the first thing anyone reads — which is why it sets
   * `rateNoteFromStep`.
   *
   * The coach reports the step on screen through `onStep`, so this is the declared step and not
   * an event that happens to land near it. It was approximated from the first `result:shown`
   * until the coach gained that callback; the approximation showed the note one step early,
   * which on a thirty-second screen is most of the difference the field exists to make.
   *
   * Latched rather than tracked: once the note has been earned it stays, because a banner that
   * qualifies a figure must not vanish while the figure is still on screen.
   */
  const [rateNoteDue, setRateNoteDue] = useState(false)
  useEffect(() => {
    setRateNoteDue(false)
  }, [active])

  const noteStep = active?.rateNoteFromStep ?? null
  const handleStep = useCallback(
    (id: string) => {
      if (noteStep !== null && id === noteStep) setRateNoteDue(true)
    },
    [noteStep],
  )

  /**
   * A tip offered while a lesson is running is thrown away, not queued.
   *
   * Every one of the four tips fires somewhere on the tutorial path — `lens` on Mission 1's
   * «۳ ماه» tap, fifteen seconds into a first run. Shown then it would render at `z-30` beneath
   * the coach's `z-[60]` dim, `inert`, unreadable and untappable — and `TipBar` marks a tip seen
   * on mount, so the one chance to explain the lens would be spent before the shopkeeper had
   * seen a single word of it, and never offered again on their own shop.
   *
   * Queueing it to the end of the lesson is the same mistake more politely: a just-in-time tip
   * is worth something at the moment the feature is first used and nothing at all afterwards.
   * The lesson has just taught that feature properly, so there is nothing left to say.
   */
  useEffect(() => {
    if (tip === null) return
    if (active !== null || quiz !== null) onTipDismiss()
  }, [tip, active, quiz, onTipDismiss])

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

  /* Every way out of the welcome, and each one has to put the real shop back: the mission leaves
   * its demo store standing so the badge lands over the payoff rather than over a blank
   * calculator, which makes closing the welcome the moment it is no longer wanted. */
  const onSkipOnboarding = useCallback(() => {
    void leavePractice()
    setProgress(finishOnboarding(true))
    onClose()
  }, [leavePractice, onClose])

  /**
   * Onboarding's one forward button, which means something different on each stage: cards →
   * question → story card → the mission itself.
   */
  const onAdvanceOnboarding = useCallback(
    (goals: GoalId[]) => {
      if (stage === 'intro') {
        setStage('goals')
        return
      }
      if (stage === 'goals') {
        setProgress(setGoals(goals))
        setStage('story')
        return
      }
      void startMission()
    },
    [stage, startMission],
  )

  /* Both halves of closing: the surface here and the request upstream. Called by every exit, so a
   * centre closed while a tip is still on screen does not come back on the next render. */
  const close = useCallback(() => {
    setCenterOpen(false)
    setQuiz(null)
    onClose()
  }, [onClose])

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
          open={active === null && quiz === null && !centerOpen}
          stage={stage}
          lang={lang}
          rtl={rtl}
          onAdvance={onAdvanceOnboarding}
          storyKey={missionStory}
          onSkip={onSkipOnboarding}
          onOpenCenter={() => {
            void leavePractice()
            setProgress(finishOnboarding(true))
            setStage('intro')
            setCenterOpen(true)
          }}
          onFinish={() => {
            void leavePractice()
            setProgress(finishOnboarding(true))
            onClose()
          }}
        />
      ) : null}

      <LearnCenter
          open={centerOpen && active === null && quiz === null}
          onClose={close}
          lang={lang}
          progress={progress}
          onStart={onStart}
          available={lessonsAvailable()}
          notice={noticeStrip}
        />

      {/* A lesson is running against a throwaway shop, and every figure in it assumes a pinned
        * rate. Both facts have to be on screen the whole time, not buried in a step's text: a
        * learner who looks up mid-lesson must be able to see that none of this is their data.
        *
        * `data-coach-keep` holds it out of the coach's `inert` sweep. It is non-interactive, so
        * being swept looked free — but `inert` takes a subtree out of the accessibility tree as
        * well as the tab order, which meant the one user who cannot glance up at a banner was
        * also the one never told they were in a practice shop, or what rate its figures assume. */}
      {active !== null ? (
        <div
          role="status"
          data-coach-keep=""
          className="glass-sheet glass-ring pointer-events-none fixed inset-x-3 z-[70] mx-auto max-w-[480px] rounded-2xl px-3.5 py-2 text-center"
          style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
        >
          <p className="text-[12px] font-semibold leading-snug text-[var(--text-secondary)]">
            {t('learn.practiceNotice')}
          </p>
          {active.showsRate && (active.rateNoteFromStep === null || rateNoteDue) ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-tertiary)]">{t('learn.practiceRate')}</p>
          ) : null}
        </div>
      ) : null}

      {active !== null && ctx !== null ? (
        <Suspense fallback={null}>
          <Coach
            steps={active.steps}
            ctx={ctx}
            initialIndex={active.startIndex}
            onComplete={() => finishLesson(active, { finished: true, atStep: 0 })}
            onExit={(atIndex) => finishLesson(active, { finished: false, atStep: atIndex })}
            onStep={handleStep}
          />
        </Suspense>
      ) : null}

      {quiz !== null ? (
        <Challenges
          lang={lang}
          title={quiz.id === null ? t('learn.missionTitle') : t(`learn.lessons.${quiz.id}.title`)}
          open
          challenges={quiz.quiz}
          summaryKey={quiz.summaryKey}
          onDone={(passed) => {
            setQuiz(null)
            settle(quiz, passed)
          }}
          onSkip={() => {
            setQuiz(null)
            settle(quiz, false)
          }}
        />
      ) : null}

      <AnimatePresence>
        {/* Belt and braces with the effect above: the drop is a state update a render behind,
          * and one frame of a tip under the dim is one frame too many — `TipBar` marks it seen
          * the moment it mounts. */}
        {tip !== null && active === null && quiz === null ? (
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
