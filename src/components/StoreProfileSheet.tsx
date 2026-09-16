import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { vibrate } from '../lib/haptics'
import {
  CATEGORY_IDS,
  categoryLabelKey,
  IMPORT_DEPENDENCIES,
  type CategoryId,
  type ImportDependency,
} from '../lib/rates/categories'
import { Sheet } from './Sheet'

const IMPORT_LABEL_KEYS: Record<string, string> = {
  '0': 'profile.domestic',
  '0.5': 'profile.mixed',
  '1': 'profile.imported',
}

export interface StoreProfileDraft {
  categories: CategoryId[]
  importDependency: ImportDependency
}

interface StoreProfileSheetProps {
  open: boolean
  onClose: () => void
  initial: StoreProfileDraft
  onSave: (draft: StoreProfileDraft) => void
  /** Skipping is allowed: the app falls back to 'other' at half import dependency. */
  onSkip: () => void
}

/**
 * Two taps, asked once, and never at launch — only the first time the answer would
 * actually change a number on screen. Everything here is optional.
 */
export function StoreProfileSheet({ open, onClose, initial, onSave, onSkip }: StoreProfileSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [categories, setCategories] = useState<CategoryId[]>(initial.categories)
  const [dependency, setDependency] = useState<ImportDependency>(initial.importDependency)

  // Re-seed whenever the sheet is reopened, so Settings never shows a stale draft.
  useEffect(() => {
    if (!open) return
    setCategories(initial.categories)
    setDependency(initial.importDependency)
  }, [open, initial])

  /* Order is meaningful: the first pick becomes the primary category new products inherit,
   * so a re-pick appends rather than reshuffling. */
  const toggle = (id: CategoryId) => {
    vibrate()
    setCategories((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  const save = () => {
    vibrate()
    onSave({ categories: categories.length > 0 ? categories : ['other'], importDependency: dependency })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.title')}>
      <div data-tour="profile-panel">
      <p className="mb-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{t('profile.hint')}</p>

      <div role="group" aria-label={t('profile.title')} className="flex flex-wrap gap-2">
        {CATEGORY_IDS.map((id) => {
          const index = categories.indexOf(id)
          const selected = index !== -1
          return (
            <motion.button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(id)}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              className={`flex min-w-0 items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                selected
                  ? 'bg-[var(--accent-fill-strong)] text-white dark:text-[hsl(168_90%_8%)]'
                  : 'glass glass-ring text-[var(--text-secondary)]'
              }`}
            >
              {/* The primary category is the one every new product inherits, so it is marked. */}
              {index === 0 && (
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              )}
              <span className="truncate">{t(categoryLabelKey(id))}</span>
            </motion.button>
          )
        })}
      </div>

      <h3 className="mb-2 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {t('profile.importTitle')}
      </h3>
      {/*
       * A `SegmentedControl` was here, and its own comment claimed the three answers "never fit
       * one row on a 360px phone, so they stack" — but a `SegmentedControl` always lays its
       * options out in one equal-width, non-wrapping row (see its own `whitespace-nowrap` +
       * `truncate`), and wrapping a single instance of it in a `flex-col` stacks nothing. The
       * middle answer, «هم ایرانی هم وارداتی», is genuinely the whole sentence — there is no
       * shorter version that still answers the question — so it was rendered as
       * «هم ایرانی هم وار…» on every phone this was checked on, not only narrow ones.
       *
       * This is a radio question, not a set of tabs, so it gets the same wrapping chip grid the
       * category question above it already uses successfully for the same reason (a Persian
       * label with no safe abbreviation) — full labels, on their own row where they need one,
       * one answer selected at a time.
       */}
      <div role="radiogroup" aria-label={t('profile.importTitle')} className="flex flex-wrap gap-2">
        {IMPORT_DEPENDENCIES.map((entry) => {
          const value = String(entry)
          const selected = dependency === entry
          return (
            <motion.button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (!selected) {
                  vibrate()
                  setDependency(entry)
                }
              }}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              className={`min-w-0 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                selected
                  ? 'bg-[var(--accent-fill-strong)] text-white dark:text-[hsl(168_90%_8%)]'
                  : 'glass glass-ring text-[var(--text-secondary)]'
              }`}
            >
              {t(IMPORT_LABEL_KEYS[value] ?? 'profile.domestic')}
            </motion.button>
          )
        })}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            vibrate()
            onSkip()
            onClose()
          }}
          className="glass glass-ring min-w-0 flex-1 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--text-secondary)]"
        >
          {t('profile.skip')}
        </button>
        <motion.button
          type="button"
          data-tour="btn-profile-save"
          onClick={save}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="min-w-0 flex-1 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3 text-[15px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
        >
          {t('profile.save')}
        </motion.button>
      </div>
      </div>
    </Sheet>
  )
}
