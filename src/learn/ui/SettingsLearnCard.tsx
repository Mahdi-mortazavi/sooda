/**
 * The tutorial's section in Settings: where you are, how to get back in, and how to switch the
 * hints off.
 *
 * Settings is the one place a shopkeeper looks for something they half-remember seeing, so the
 * three controls the brief asks for live together here rather than being scattered: the ring that
 * says how far through the lessons they are and opens the centre, «دیدن دوبارهٔ معرفی», and
 * «ریست پیشرفت آموزش» — the second behind a confirmation, because it throws work away.
 *
 * SettingsSheet is lazily loaded, so all of this (and the progress store behind it) stays out of
 * the entry chunk.
 */

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import { IconChevronForward } from '../../components/Icons'
import { vibrate } from '../../lib/haptics'
import { formatNumber, type AppLanguage } from '../../lib/numbers'
import { ProgressRing } from './ProgressRing'
import { useLearn } from './entry'
import { mastery, readProgress, replayOnboarding, resetLessonProgress, setTipsEnabled } from './progress'

export function SettingsLearnCard({ lang }: { lang: AppLanguage }) {
  const { t } = useTranslation()
  const learn = useLearn()
  const reducedMotion = useReducedMotion()
  const [progress, setProgress] = useState(readProgress)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [replayed, setReplayed] = useState(false)

  const score = mastery(progress)
  const title = t('learn.title', { defaultValue: 'Learn Sooda' })

  return (
    <section aria-label={title}>
      <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {title}
      </h3>

      <motion.button
        type="button"
        onClick={() => {
          vibrate()
          learn?.open()
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.99 }}
        className="glass glass-ring flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-start"
      >
        <ProgressRing
          done={score.finished}
          total={score.total}
          lang={lang}
          size={44}
          label={t('learn.progressLabel', {
            defaultValue: '{{done}} of {{total}} lessons finished',
            replace: { done: formatNumber(score.finished, lang, 0), total: formatNumber(score.total, lang, 0) },
          })}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">{title}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {score.master
              ? t('learn.masterBody', { defaultValue: 'You have passed every lesson.' })
              : t('learn.settingsHint', { defaultValue: 'Short lessons you do on the real app.' })}
          </span>
        </span>
        <IconChevronForward aria-hidden size={16} className="shrink-0 text-[var(--text-tertiary)] rtl:rotate-180" />
      </motion.button>

      <div className="glass glass-ring mt-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">
            {t('learn.tipsToggle', { defaultValue: 'One-line hints' })}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {t('learn.tipsToggleHint', { defaultValue: 'A single hint the first time you use something new.' })}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={progress.tipsEnabled}
          aria-label={t('learn.tipsToggle', { defaultValue: 'One-line hints' })}
          onClick={() => {
            vibrate()
            setProgress(setTipsEnabled(!progress.tipsEnabled))
          }}
          className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-300 ${
            progress.tipsEnabled ? 'bg-[var(--accent-fill-strong)]' : 'bg-black/16 dark:bg-white/20'
          }`}
        >
          {/* A logical inset, so the knob travels the correct way in Persian too. */}
          <motion.span
            aria-hidden
            layout
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
            className="absolute top-[3px] h-6 w-6 rounded-full bg-white shadow-sm"
            style={progress.tipsEnabled ? { insetInlineEnd: 3 } : { insetInlineStart: 3 }}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          vibrate()
          setProgress(replayOnboarding())
          setReplayed(true)
        }}
        className="glass glass-ring mt-2.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold">
            {t('learn.replayIntro', { defaultValue: 'See the introduction again' })}
          </span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
            {replayed
              ? t('learn.replayIntroDone', { defaultValue: 'It will appear the next time you open Sooda.' })
              : t('learn.replayIntroHint', { defaultValue: 'The three welcome cards and the first mission.' })}
          </span>
        </span>
      </button>

      {confirmingReset ? (
        <div className="glass glass-ring mt-2.5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <span className="min-w-0 text-[15px] font-semibold">{t('actions.areYouSure')}</span>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                vibrate()
                setProgress(resetLessonProgress())
                setConfirmingReset(false)
              }}
              className="rounded-xl bg-loss-600 px-4 py-2 text-[14px] font-semibold text-white"
            >
              {t('actions.delete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-xl bg-black/8 px-4 py-2 text-[14px] font-semibold text-[var(--text-secondary)] dark:bg-white/12"
            >
              {t('actions.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="glass glass-ring mt-2.5 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold">
              {t('learn.resetProgress', { defaultValue: 'Reset lesson progress' })}
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-secondary)]">
              {t('learn.resetProgressHint', { defaultValue: 'Marks every lesson as new again. Your shop is untouched.' })}
            </span>
          </span>
        </button>
      )}
    </section>
  )
}
