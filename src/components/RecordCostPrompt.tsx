import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import { IconCheck, IconTrendUp } from './Icons'

interface RecordCostPromptProps {
  /** Shown only once there is a genuinely new figure to learn from. */
  open: boolean
  productName: string
  onRecord: () => void
  onDismiss: () => void
}

/**
 * Passive learning: the shopkeeper already typed a purchase price to run a calculation,
 * so the app asks — once, inline, below the result — whether that was the real new cost.
 *
 * Deliberately not a toast and not a modal. A toast would time out and take the offer with
 * it; a modal would make an optional question feel mandatory. "No" is a full-sized button
 * beside "Record", not a dismissive ×, because declining is an ordinary answer here: a
 * quoted price or a one-off deal is not something the estimator should learn from.
 */
export function RecordCostPrompt({ open, productName, onRecord, onDismiss }: RecordCostPromptProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="record-cost"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, height: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, height: 'auto' }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, height: 0 }}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
          className="overflow-hidden"
        >
          {/* The offer animates in on its own, so a screen reader needs telling it is there. */}
          <div
            role="status"
            className="glass glass-ring mt-2 flex flex-wrap items-center gap-2 rounded-[20px] px-3.5 py-3"
          >
            <span aria-hidden className="text-[var(--accent-text)]">
              <IconTrendUp size={16} />
            </span>
            <p className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug">
              {t('recordCost.confirm', { name: productName })}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => {
                  vibrate()
                  onRecord()
                }}
                className="flex items-center gap-1.5 rounded-full bg-accent-500/16 px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-text)]"
              >
                <IconCheck size={14} />
                {t('recordCost.yes')}
              </motion.button>
              <motion.button
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => {
                  vibrate()
                  onDismiss()
                }}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/8 dark:hover:bg-white/10"
              >
                {t('recordCost.dismiss')}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
