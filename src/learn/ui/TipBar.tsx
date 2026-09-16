/**
 * The one-line hint that appears the first time a complex feature is used.
 *
 * Rules the brief sets and this enforces: one line, dismissible, at most once per feature ever,
 * and switchable off wholesale in Settings. It is marked seen the moment it is shown rather than
 * when it is dismissed — a user who ignores it and carries on has still been offered the hint, and
 * showing it again on the next launch would be the app nagging.
 *
 * It never steals focus and never covers the control it is talking about: it sits above the tab
 * bar, announces itself politely, and disappears on a tap.
 */

import { motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import { IconClose } from '../../components/Icons'
import { vibrate } from '../../lib/haptics'
import { TIP_IDS } from './catalog'
import { markTipSeen } from './progress'
import { isLessonId, type LessonId } from './types'

/** Which lesson each tip offers. Keyed on `TIP_IDS`, so a new tip cannot be added without one. */
const TIP_LESSON: Record<(typeof TIP_IDS)[number], LessonId> = {
  lens: 'realProfit',
  installments: 'installments',
  bulk: 'products',
  rate: 'smartRates',
}

interface TipBarProps {
  id: string
  onDismiss: () => void
  onOpenLesson: (lesson: LessonId) => void
}

export function TipBar({ id, onDismiss, onOpenLesson }: TipBarProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    markTipSeen(id)
  }, [id])

  const lesson = (TIP_LESSON as Record<string, LessonId | undefined>)[id]
  const text = t(`learn.tips.${id}`, { defaultValue: '' })
  // A tip whose string has not landed yet is no tip at all — better nothing than a raw key.
  if (text === '') return null

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="glass-sheet glass-ring fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[480px] items-center gap-2 rounded-2xl px-3.5 py-2.5"
    >
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--text-secondary)]">{text}</p>
      {lesson !== undefined && isLessonId(lesson) ? (
        <button
          type="button"
          onClick={() => {
            vibrate()
            onOpenLesson(lesson)
          }}
          className="shrink-0 rounded-full bg-accent-500/16 px-3 py-1 text-[12.5px] font-bold text-[var(--accent-text)]"
        >
          {t('learn.tipCta', { defaultValue: 'Show me' })}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('actions.close')}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/8 text-[var(--text-secondary)] dark:bg-white/12"
      >
        <IconClose size={14} />
      </button>
    </motion.div>
  )
}
