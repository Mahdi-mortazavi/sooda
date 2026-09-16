import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { vibrate } from '../lib/haptics'
import { IconSparkle, IconTarget } from './Icons'
import { Sheet } from './Sheet'
import { useLearn } from '../learn/ui/entry'
import { IconGraduation } from '../learn/ui/Illustrations'

interface WhatsNewSheetProps {
  open: boolean
  onClose: () => void
  version: string
}

/*
 * v1.5's three. `b4`–`b6` replace v1.4's `b1`–`b3`, in render order: the two «آموزش تعاملی»
 * items sit together and the contextual-help one lands last, which is the order `copy` settled on.
 */
const HIGHLIGHTS: { key: string; icon: ReactNode }[] = [
  { key: 'whatsNew.b4', icon: <IconGraduation size={22} /> },
  { key: 'whatsNew.b5', icon: <IconSparkle size={22} /> },
  { key: 'whatsNew.b6', icon: <IconTarget size={22} /> },
]

/**
 * Release highlights shown once after an update. The sheet is purely presentational —
 * deciding *when* it appears belongs to the caller, so nothing here reads version storage.
 */
export function WhatsNewSheet({ open, onClose, version }: WhatsNewSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const learn = useLearn()

  return (
    <Sheet open={open} onClose={onClose} title={t('whatsNew.title', { version })}>
      <ul className="flex flex-col gap-2.5">
        {HIGHLIGHTS.map((item, index) => (
          <motion.li
            key={item.key}
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 32,
              delay: reducedMotion ? 0 : index * 0.06,
            }}
            className="glass glass-ring flex items-center gap-4 rounded-2xl px-4 py-3.5"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[var(--accent-text)]">
              {item.icon}
            </span>
            <span className="text-[15px] font-medium leading-snug">{t(item.key)}</span>
          </motion.li>
        ))}
      </ul>

      {/* The release's headline is a thing you do, so the primary button does it. The plain
        * dismissal stays underneath: an upgrading shopkeeper who wants their calculator back
        * must never have to go through a tutorial to reach it. */}
      {learn !== null ? (
        <motion.button
          type="button"
          onClick={() => {
            vibrate()
            onClose()
            learn.open()
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="mt-5 w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]"
        >
          {t('whatsNew.learnCta', { defaultValue: 'Show me' })}
        </motion.button>
      ) : null}

      <motion.button
        type="button"
        onClick={() => {
          vibrate()
          onClose()
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={
          learn !== null
            ? 'glass glass-ring mt-2.5 w-full rounded-full py-3.5 text-[15px] font-semibold text-[var(--text-secondary)]'
            : 'mt-5 w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]'
        }
      >
        {t('whatsNew.gotIt')}
      </motion.button>
    </Sheet>
  )
}
