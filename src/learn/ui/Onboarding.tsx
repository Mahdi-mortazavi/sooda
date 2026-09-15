/**
 * First run: three cards, one question, one mission, one badge.
 *
 * Every screen carries «رد شدن». The brief's first rule is that the tutorial never blocks, and a
 * first-run flow is where that is easiest to get wrong — so skip is in the header of every stage,
 * Escape closes the surface, and skipping still writes `onboardingDone` so the app does not ask
 * again. Nothing here is on a timer: the cards advance on a swipe, a tap or an arrow key.
 *
 * An upgrading user never reaches this file at all; App only asks for it on an install that has
 * no stored version of its own (see `resolveLastSeenVersion`).
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import { vibrate } from '../../lib/haptics'
import { formatNumber, type AppLanguage } from '../../lib/numbers'
import { BadgeMedal, IllustrationEverything, IllustrationPrivate, IllustrationPrice } from './Illustrations'
import { LearnSurface } from './Surface'
import { INTRO_CARD_IDS } from './catalog'
import { GOAL_IDS, type GoalId } from './types'

/**
 * Which stage the host wants shown. `story` is Mission 1's setup card — «آقا رضا شالی را
 * ۱۰۰٬۰۰۰ تومان خریده…» — which has to be read before the first step, because every figure the
 * mission asks for comes out of it. The mission itself is the coach's, over the real UI.
 */
export type OnboardingStage = 'intro' | 'goals' | 'story' | 'celebrate'

/*
 * The ids are copy's and are shared with the test that checks their strings resolve; the drawings
 * follow the sentence, not the id. `rise` is «همه‌چیز یک‌جا» and `practice` is «روی گوشی خودتان» —
 * renaming either would break three keys for no reader's benefit.
 */
const ART: Record<(typeof INTRO_CARD_IDS)[number], ReactNode> = {
  price: <IllustrationPrice />,
  rise: <IllustrationEverything />,
  practice: <IllustrationPrivate />,
}

const CARDS = INTRO_CARD_IDS.map((id) => ({ id, art: ART[id] }))

/** A swipe shorter than this is a scroll that wandered, not a decision. */
const SWIPE_DISTANCE = 56
const SWIPE_VELOCITY = 420

interface OnboardingProps {
  open: boolean
  stage: OnboardingStage
  lang: AppLanguage
  rtl: boolean
  /** The one forward button. The host decides what the next stage is. */
  onAdvance: (goals: GoalId[]) => void
  /** The mission's story card text, once the host has a mission to run. */
  storyKey: string | null
  /** «رد شدن» from any stage, and the close button. */
  onSkip: () => void
  /** Celebration CTA — opens the Learning Centre. */
  onOpenCenter: () => void
  /** Celebration CTA — closes everything and hands the calculator back. */
  onFinish: () => void
}

export function Onboarding({
  open,
  stage,
  lang,
  rtl,
  onAdvance,
  storyKey,
  onSkip,
  onOpenCenter,
  onFinish,
}: OnboardingProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [card, setCard] = useState(0)
  const [goals, setGoals] = useState<GoalId[]>([])

  const skipLabel = t('learn.skip', { defaultValue: 'Skip' })
  const title =
    stage === 'celebrate'
      ? t('learn.celebrateTitle', { defaultValue: 'Nicely done' })
      : stage === 'goals'
        ? t('learn.goalsTitle', { defaultValue: 'What brings you here?' })
        : stage === 'story'
          ? t('learn.missionTitle')
          : t('learn.introTitle', { defaultValue: 'Welcome to Sooda' })

  const go = (next: number) => {
    if (next < 0 || next >= CARDS.length) return
    vibrate()
    setCard(next)
  }

  const toggleGoal = (id: GoalId) => {
    vibrate()
    setGoals((current) => (current.includes(id) ? current.filter((g) => g !== id) : [...current, id]))
  }

  return (
    <LearnSurface
      open={open}
      onClose={onSkip}
      title={title}
      aside={
        stage === 'celebrate' ? null : (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 rounded-full px-3 py-1.5 text-[14px] font-semibold text-[var(--text-secondary)]"
          >
            {skipLabel}
          </button>
        )
      }
    >
      {stage === 'intro' ? (
        <div className="flex min-h-full flex-col">
          <div
            className="relative flex-1"
            role="group"
            aria-roledescription={t('learn.introTitle', { defaultValue: 'Welcome to Sooda' })}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') go(rtl ? card - 1 : card + 1)
              if (e.key === 'ArrowLeft') go(rtl ? card + 1 : card - 1)
            }}
            tabIndex={0}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={CARDS[card]?.id ?? card}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                drag={reducedMotion ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_e, info) => {
                  /* Mirrored rather than hard-coded: in Persian the next card lives to the
                   * inline-end, which is the opposite physical side. */
                  const forward = rtl ? info.offset.x > 0 : info.offset.x < 0
                  const far = Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY
                  if (!far) return
                  go(forward ? card + 1 : card - 1)
                }}
                className="glass glass-ring flex flex-col items-center rounded-[28px] px-6 py-7 text-center"
              >
                <span className="text-[var(--text-secondary)]">{CARDS[card]?.art}</span>
                <h3 className="mt-4 text-[21px] font-bold leading-tight">
                  {t(`learn.intro.${CARDS[card]?.id}.title`)}
                </h3>
                <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
                  {t(`learn.intro.${CARDS[card]?.id}.body`)}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <p aria-live="polite" className="sr-only">
            {t('learn.cardOf', {
              defaultValue: '{{current}} of {{total}}',
              replace: { current: formatNumber(card + 1, lang, 0), total: formatNumber(CARDS.length, lang, 0) },
            })}
          </p>

          <div aria-hidden className="mt-5 flex justify-center gap-2">
            {CARDS.map((item, index) => (
              <span
                key={item.id}
                className={`h-2 rounded-full transition-all ${
                  index === card ? 'w-6 bg-[var(--accent-fill-strong)]' : 'w-2 bg-black/15 dark:bg-white/20'
                }`}
              />
            ))}
          </div>

          <motion.button
            type="button"
            onClick={() => {
              vibrate()
              if (card + 1 < CARDS.length) setCard(card + 1)
              else onAdvance(goals)
            }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            className="mt-5 w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {card + 1 < CARDS.length
              ? t('learn.next', { defaultValue: 'Next' })
              : t('learn.introCta', { defaultValue: 'Let’s go' })}
          </motion.button>
        </div>
      ) : null}

      {stage === 'goals' ? (
        <div className="flex min-h-full flex-col">
          <p className="px-1 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {t('learn.goalsBody', { defaultValue: 'Pick as many as you like — it only decides what we show first.' })}
          </p>
          <div role="group" aria-label={t('learn.goalsTitle', { defaultValue: 'What brings you here?' })} className="mt-4 flex flex-wrap gap-2">
            {GOAL_IDS.map((id) => {
              const picked = goals.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => toggleGoal(id)}
                  className={`rounded-full px-4 py-2.5 text-[14.5px] font-semibold transition-colors ${
                    picked
                      ? 'bg-[var(--accent-fill-strong)] text-white dark:text-[hsl(168_90%_8%)]'
                      : 'glass glass-ring text-[var(--text-secondary)]'
                  }`}
                >
                  {t(`learn.goals.${id}`)}
                </button>
              )
            })}
          </div>

          <motion.button
            type="button"
            onClick={() => {
              vibrate()
              onAdvance(goals)
            }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            className="mt-auto w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {t('learn.missionCta', { defaultValue: 'Try it on a real calculation' })}
          </motion.button>
        </div>
      ) : null}

      {stage === 'story' ? (
        <div className="flex min-h-full flex-col">
          {/* Read before the first step, because every figure the mission asks for is in it. */}
          <div className="glass glass-ring rounded-[28px] px-5 py-6">
            <p className="text-[16px] leading-relaxed">{storyKey === null ? '' : t(storyKey)}</p>
          </div>
          <p className="mt-3 px-1 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            {t('learn.practiceNotice', {
              defaultValue: 'Nothing here touches your own data — it is a practice shop.',
            })}
          </p>
          <motion.button
            type="button"
            onClick={() => {
              vibrate()
              onAdvance(goals)
            }}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            className="mt-auto w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {t('learn.missionStart')}
          </motion.button>
        </div>
      ) : null}

      {stage === 'celebrate' ? (
        <div className="flex min-h-full flex-col items-center text-center">
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="mt-4 flex h-[92px] w-[92px] items-center justify-center rounded-full bg-accent-500/14"
          >
            <BadgeMedal size={56} />
          </motion.div>
          <p className="mt-3 rounded-full bg-accent-500/16 px-4 py-1.5 text-[13px] font-bold text-[var(--accent-text)]">
            {t('learn.badgeFirstStep', { defaultValue: 'First step' })}
          </p>
          <h3 className="mt-4 text-[22px] font-bold leading-tight">
            {t('learn.celebrateTitle', { defaultValue: 'Nicely done' })}
          </h3>
          <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {t('learn.celebrateBody', {
              defaultValue: 'That was the whole idea — you learn Sooda by using it. Nothing you did was saved.',
            })}
          </p>

          {/* Their own shop is the primary action, and the tutorial is the quiet one underneath.
            * The mission has just made its point on «آقا رضا»'s numbers; what a first-run user
            * should want next is to try it on theirs, not to be handed more tutorial. */}
          <div className="mt-auto flex w-full flex-col gap-2.5 pt-8">
            <motion.button
              type="button"
              onClick={() => {
                vibrate()
                onFinish()
              }}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              className="w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
            >
              {t('learn.celebrateStart', { defaultValue: 'Start using Sooda' })}
            </motion.button>
            <button
              type="button"
              onClick={() => {
                vibrate()
                onOpenCenter()
              }}
              className="glass glass-ring w-full rounded-full py-3.5 text-[15px] font-semibold text-[var(--text-secondary)]"
            >
              {t('learn.celebrateCenter', { defaultValue: 'See all the lessons' })}
            </button>
          </div>
        </div>
      ) : null}
    </LearnSurface>
  )
}
