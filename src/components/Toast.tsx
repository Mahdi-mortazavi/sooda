import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import { IconClose, IconUndo } from './Icons'

interface ToastProps {
  open: boolean
  message: string
  /** Optional action, e.g. Undo. */
  action?: { label: string; onAction: () => void }
  onDismiss: () => void
  /** Auto-dismiss delay; 0 disables it. Default 4000; the bulk-undo toast passes 10000. */
  durationMs?: number
}

/** Glass toast pill that slides up above the tab bar, with an optional single action. */
export function Toast({ open, message, action, onDismiss, durationMs = 4000 }: ToastProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  // Kept in a ref so a caller that re-creates onDismiss each render cannot restart the timer.
  const dismissRef = useRef(onDismiss)

  useEffect(() => {
    dismissRef.current = onDismiss
  }, [onDismiss])

  // Restarts whenever a new message is shown, and is cleared on unmount.
  useEffect(() => {
    if (!open || durationMs <= 0) return
    const timer = setTimeout(() => dismissRef.current(), durationMs)
    return () => clearTimeout(timer)
  }, [open, message, durationMs])

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-4"
      style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="toast"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.96 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="glass-strong glass-ring pointer-events-auto flex items-center gap-2.5 rounded-[22px] px-4 py-3"
          >
            <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{message}</p>
            {action ? (
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => {
                  vibrate()
                  action.onAction()
                  onDismiss()
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500/16 px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-text)]"
              >
                <IconUndo size={15} />
                {action.label}
              </motion.button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                vibrate()
                onDismiss()
              }}
              aria-label={t('actions.close')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-black/8 dark:hover:bg-white/10"
            >
              <IconClose size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
