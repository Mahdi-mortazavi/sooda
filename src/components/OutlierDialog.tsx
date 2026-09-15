import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconAlert, IconCheck, IconUndo } from './Icons'

interface OutlierDialogProps {
  open: boolean
  /** The previous recorded cost and the one just typed. */
  from: number
  to: number
  lang: AppLanguage
  unit: Unit
  /** Record it as a real price. */
  onConfirm: () => void
  /** Go back and edit the number. */
  onFix: () => void
  /** Record it, but mark it temporary so the estimator ignores it. */
  onTemporary: () => void
}

/**
 * The honest-data guard. A mistyped zero must not silently poison a price history, but Sooda
 * must not refuse a real price either — so it asks, and the shopkeeper decides.
 */
export function OutlierDialog({ open, from, to, lang, unit, onConfirm, onFix, onTemporary }: OutlierDialogProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstActionRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const bodyId = useId()

  /* Escape is answered by whatever `onFix` is at the time, without re-running the effect below —
   * re-registering it would steal focus back to the first action on every parent render. */
  const onFixRef = useRef(onFix)
  useEffect(() => {
    onFixRef.current = onFix
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    firstActionRef.current?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        /* Captured and stopped before it reaches Sheet's own Escape listener: closing the whole
         * check-in behind this question would throw away the number the user just typed. */
        e.stopPropagation()
        e.preventDefault()
        onFixRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open])

  const spring = reducedMotion ? { duration: 0 } : ({ type: 'spring', stiffness: 460, damping: 32 } as const)

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="outlier-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          onClick={onFix}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-6 backdrop-blur-[3px]"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong glass-ring w-full max-w-[360px] rounded-[28px] p-5 outline-none"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warn-500/18 text-warn-700 dark:text-warn-400">
                <IconAlert size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id={titleId} className="text-[17px] font-bold leading-snug">
                  {t('outlier.title')}
                </h3>
                <p id={bodyId} className="mt-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                  {t('outlier.body', {
                    from: formatAmountWithUnit(from, lang, unit),
                    to: formatAmountWithUnit(to, lang, unit),
                  })}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <motion.button
                ref={firstActionRef}
                type="button"
                onClick={() => {
                  vibrate()
                  onConfirm()
                }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3 text-[15px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
              >
                <IconCheck size={17} />
                {t('outlier.yes')}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  vibrate()
                  onFix()
                }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                className="glass glass-ring flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
              >
                <IconUndo size={17} />
                {t('outlier.fix')}
              </motion.button>
              <button
                type="button"
                onClick={() => {
                  vibrate()
                  onTemporary()
                }}
                className="w-full rounded-2xl px-4 py-2.5 text-[14px] font-semibold text-[var(--text-secondary)] underline-offset-2 hover:underline"
              >
                {t('outlier.temporary')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
