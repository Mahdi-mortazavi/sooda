/**
 * The Learning Centre: a place the shopkeeper can come back to, not a one-off tour.
 *
 * Three things, in the order someone arriving actually needs them: how far they have got, what to
 * do next, and everything else. The recommended path is built from the goals they chose during
 * onboarding — see `catalog.ts` — and every lesson is still listed below it, because a goal says
 * what to show first, never what to withhold.
 */

import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import {
  IconAlert,
  IconBox,
  IconCalculator,
  IconCheck,
  IconPercent,
  IconSparkle,
  IconTag,
  IconTrendUp,
  IconWallet,
} from '../../components/Icons'
import { vibrate } from '../../lib/haptics'
import { formatNumber, type AppLanguage } from '../../lib/numbers'
import { BadgeMedal } from './Illustrations'
import { ProgressRing } from './ProgressRing'
import { LearnSurface } from './Surface'
import { LESSONS, lessonBodyKey, lessonTitleKey, recommendedPath } from './catalog'
import { isFinished, mastery } from './progress'
import type { LearnProgress, LessonId, LessonStatus } from './types'

const LESSON_ICONS: Record<LessonId, ReactNode> = {
  profit: <IconPercent size={20} />,
  discount: <IconTag size={20} />,
  realProfit: <IconTrendUp size={20} />,
  installments: <IconWallet size={20} />,
  products: <IconBox size={20} />,
  smartRates: <IconSparkle size={20} />,
  everyday: <IconCalculator size={20} />,
  safety: <IconAlert size={20} />,
}

const STATUS_KEY: Record<LessonStatus, string> = {
  new: 'learn.status.new',
  progress: 'learn.status.progress',
  done: 'learn.status.done',
  passed: 'learn.status.passed',
}

const STATUS_FALLBACK: Record<LessonStatus, string> = {
  new: 'New',
  progress: 'In progress',
  done: 'Completed',
  passed: 'Passed',
}

/*
 * The brief's eight, in the order someone reads them: the concept first, then where the numbers
 * come from, then privacy, then the practicalities. `copy` owns every question and answer.
 */
const FAQ_IDS = ['realProfit', 'rate', 'inflation', 'data', 'stop', 'offline', 'phone', 'source'] as const

interface LearnCenterProps {
  open: boolean
  onClose: () => void
  lang: AppLanguage
  progress: LearnProgress
  /** Starts (or resumes) a lesson. The host owns the sandbox and the coach. */
  onStart: (id: LessonId) => void
  /** Shown instead of a start button while lesson scripts are not wired up yet. */
  available: boolean
  /** Rendered under the header — the «اولین قدم» / «استاد سودا» strip, or nothing. */
  notice?: ReactNode
}

export function LearnCenter({ open, onClose, lang, progress, onStart, available, notice }: LearnCenterProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [openFaq, setOpenFaq] = useState<string | null>(null)

  const score = useMemo(() => mastery(progress), [progress])
  const path = useMemo(() => recommendedPath(progress.goals), [progress.goals])
  /* The first thing that is not finished. "Continue where you left off" is the whole reason the
   * path exists; a recommendation that keeps pointing at a lesson already passed is decoration. */
  const next = path.find((id) => !isFinished(progress.lessons[id].status)) ?? null

  const ringLabel = t('learn.progressLabel', {
    defaultValue: '{{done}} of {{total}} lessons finished',
    replace: { done: formatNumber(score.finished, lang, 0), total: formatNumber(score.total, lang, 0) },
  })

  return (
    <LearnSurface open={open} onClose={onClose} title={t('learn.title', { defaultValue: 'Learn Sooda' })}>
      {notice}

      <section
        aria-label={t('learn.progressTitle', { defaultValue: 'Your progress' })}
        className="glass glass-ring mt-1 flex items-center gap-4 rounded-3xl px-4 py-4"
      >
        <ProgressRing done={score.finished} total={score.total} lang={lang} label={ringLabel} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight">
            {score.master
              ? t('learn.masterTitle', { defaultValue: 'Sooda master' })
              : t('learn.progressTitle', { defaultValue: 'Your progress' })}
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-secondary)]">
            {score.master
              ? t('learn.masterBody', { defaultValue: 'You have passed every lesson.' })
              : t('learn.progressBody', {
                  defaultValue: '{{passed}} passed, {{total}} in total.',
                  replace: {
                    passed: formatNumber(score.passed, lang, 0),
                    total: formatNumber(score.total, lang, 0),
                  },
                })}
          </p>
        </div>
        {score.master ? (
          <span className="flex shrink-0 flex-col items-center gap-1">
            <BadgeMedal size={44} />
            <span className="text-[11px] font-bold text-[var(--accent-text)]">
              {t('learn.badgeMaster', { defaultValue: 'Sooda master' })}
            </span>
          </span>
        ) : null}
      </section>

      {next !== null ? (
        <section aria-label={t('learn.recommended', { defaultValue: 'Recommended for you' })} className="mt-5">
          <SectionTitle>{t('learn.recommended', { defaultValue: 'Recommended for you' })}</SectionTitle>
          <motion.button
            type="button"
            onClick={() => {
              vibrate()
              onStart(next)
            }}
            whileTap={reducedMotion ? undefined : { scale: 0.98 }}
            className="flex w-full items-center gap-3.5 rounded-3xl bg-[var(--accent-fill-strong)] px-4 py-4 text-start text-white dark:text-[hsl(168_90%_8%)]"
          >
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/22">
              {LESSON_ICONS[next]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold leading-tight">{t(lessonTitleKey(next))}</span>
              <span className="mt-0.5 block text-[13px] leading-snug opacity-85">{t(lessonBodyKey(next))}</span>
            </span>
            <span aria-hidden className="shrink-0 text-[18px] font-bold rtl:rotate-180">
              ›
            </span>
          </motion.button>
        </section>
      ) : null}

      <section aria-label={t('learn.allLessons', { defaultValue: 'All lessons' })} className="mt-5">
        <SectionTitle>{t('learn.allLessons', { defaultValue: 'All lessons' })}</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {LESSONS.map((lesson, index) => (
            <LessonCard
              key={lesson.id}
              id={lesson.id}
              seconds={lesson.seconds}
              status={progress.lessons[lesson.id].status}
              lang={lang}
              index={index}
              reducedMotion={!!reducedMotion}
              onStart={() => onStart(lesson.id)}
            />
          ))}
        </ul>
        {available ? null : (
          <p role="status" className="mt-3 px-1 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            {t('learn.unavailable', {
              defaultValue: 'Lessons are being prepared — everything else here already works.',
            })}
          </p>
        )}
      </section>

      <section aria-label={t('learn.faqTitle', { defaultValue: 'Common questions' })} className="mt-6">
        <SectionTitle>{t('learn.faqTitle', { defaultValue: 'Common questions' })}</SectionTitle>
        <ul className="flex flex-col gap-2">
          {FAQ_IDS.map((id) => {
            const expanded = openFaq === id
            return (
              <li key={id} className="glass glass-ring overflow-hidden rounded-2xl">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenFaq(expanded ? null : id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start"
                >
                  <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">
                    {t(`learn.faq.${id}.q`)}
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 text-[15px] text-[var(--text-tertiary)] transition-transform ${
                      expanded ? 'rotate-90' : 'rtl:rotate-180'
                    }`}
                  >
                    ›
                  </span>
                </button>
                {expanded ? (
                  <p className="border-t border-[var(--separator)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {t(`learn.faq.${id}.a`)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>
    </LearnSurface>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
      {children}
    </h3>
  )
}

function LessonCard({
  id,
  seconds,
  status,
  lang,
  index,
  reducedMotion,
  onStart,
}: {
  id: LessonId
  seconds: number
  status: LessonStatus
  lang: AppLanguage
  index: number
  reducedMotion: boolean
  onStart: () => void
}) {
  const { t } = useTranslation()
  const finished = isFinished(status)
  return (
    <motion.li
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 420,
        damping: 34,
        delay: reducedMotion ? 0 : Math.min(index * 0.03, 0.24),
      }}
    >
      <button
        type="button"
        onClick={() => {
          vibrate()
          onStart()
        }}
        className="glass glass-ring flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-start"
      >
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            finished ? 'bg-accent-500/20 text-[var(--accent-text)]' : 'bg-black/6 text-[var(--text-secondary)] dark:bg-white/10'
          }`}
        >
          {finished ? <IconCheck size={20} /> : LESSON_ICONS[id]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-tight">{t(lessonTitleKey(id))}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
            <span>
              {t('learn.duration', {
                defaultValue: '{{n}} sec',
                replace: { n: formatNumber(seconds, lang, 0) },
              })}
            </span>
            <span aria-hidden>·</span>
            <span className={status === 'passed' ? 'font-semibold text-[var(--accent-text)]' : ''}>
              {t(STATUS_KEY[status], { defaultValue: STATUS_FALLBACK[status] })}
            </span>
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-[16px] text-[var(--text-tertiary)] rtl:rotate-180">
          ›
        </span>
      </button>
    </motion.li>
  )
}
