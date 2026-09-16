/**
 * The «درس ۶۰ ثانیه‌ای» link in an empty state.
 *
 * An empty history, an empty basket, an empty price list — three screens where there is nothing
 * to read and nothing to tap, which makes them the one place a lesson is unambiguously the most
 * useful thing on offer. It is a link and not a banner: nothing is interrupted, and a shopkeeper
 * who came to add a product is not asked to watch a tutorial first.
 *
 * Only lazily-loaded views import this, so it never reaches the entry chunk.
 */

import { useTranslation } from 'react-i18next'
import '../../i18n/sheets'
import { vibrate } from '../../lib/haptics'
import { useLearn } from './entry'
import type { LessonId } from './types'

export function LessonLink({ lesson, className = '' }: { lesson: LessonId; className?: string }) {
  const learn = useLearn()
  const { t } = useTranslation()
  if (learn === null) return null
  return (
    <button
      type="button"
      onClick={() => {
        vibrate()
        learn.open(lesson)
      }}
      className={`mt-4 text-[13.5px] font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline ${className}`}
    >
      {t('learn.sixtySecond', { defaultValue: 'Take the 60-second lesson' })}
    </button>
  )
}
