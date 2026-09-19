/**
 * The full-height glass surface the Learning Centre and onboarding are drawn on.
 *
 * `components/Sheet.tsx` is a bottom sheet capped at 86dvh with drag-to-dismiss, which is right
 * for a drawer over the calculator and wrong for a screen the shopkeeper reads for a minute: the
 * centre is a place, not a peek, and a drag gesture over a scrolling list of lesson cards fights
 * the list. So this is its own surface — same glass, same spring, same safe areas.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconClose } from '../../components/Icons'

interface LearnSurfaceProps {
  open: boolean
  /** Escape and the close button. Always available — the brief forbids a blocking tutorial. */
  onClose: () => void
  title: string
  /** Sits in the header beside the close button — the skip link, a step counter, a badge. */
  aside?: ReactNode
  children: ReactNode
}

export function LearnSurface({ open, onClose, title, aside, children }: LearnSurfaceProps) {
  const reducedMotion = useReducedMotion()
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    /* The page behind must not scroll under the surface; restored on the way out so a lesson that
     * exits mid-scroll leaves the calculator exactly as usable as it was. */
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="learn-surface"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="glass-sheet fixed inset-0 z-50 flex flex-col outline-none"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <div className="mx-auto flex min-h-0 w-full max-w-[520px] flex-1 flex-col">
            {/*
             * `items-start`, not `items-center`, and no `truncate`: this header is shared by the
             * Learning Centre ("آموزش سودا", always short) and every onboarding stage, and one of
             * those — the goals question — is a full sentence that, combined with the "رد شدن"
             * aside sitting in the same row, was cut down to "بیشتر برای چه از سودا ا…", losing
             * the question itself. A title this shared has no length any caller can promise, so it
             * wraps instead of being told to lose its own words; the buttons pin to the first line.
             */}
            <div className="flex shrink-0 items-start gap-2 px-5 pb-2 pt-4">
              <h2 className="min-w-0 flex-1 text-[22px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">
                {title}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {aside}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('actions.close')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/8 text-[var(--text-secondary)] transition-colors hover:bg-black/12 dark:bg-white/12 dark:hover:bg-white/18"
                >
                  <IconClose size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8">{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
