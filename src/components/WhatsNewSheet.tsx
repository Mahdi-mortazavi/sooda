import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { vibrate } from '../lib/haptics'
import { IconBox, IconTrendUp, IconWallet } from './Icons'
import { Sheet } from './Sheet'

interface WhatsNewSheetProps {
  open: boolean
  onClose: () => void
  version: string
}

const HIGHLIGHTS: { key: string; icon: ReactNode }[] = [
  { key: 'whatsNew.b1', icon: <IconTrendUp size={22} /> },
  { key: 'whatsNew.b2', icon: <IconWallet size={22} /> },
  { key: 'whatsNew.b3', icon: <IconBox size={22} /> },
]

/**
 * Release highlights shown once after an update. The sheet is purely presentational —
 * deciding *when* it appears belongs to the caller, so nothing here reads version storage.
 */
export function WhatsNewSheet({ open, onClose, version }: WhatsNewSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

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

      <motion.button
        type="button"
        onClick={() => {
          vibrate()
          onClose()
        }}
        whileTap={reducedMotion ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="mt-5 w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]"
      >
        {t('whatsNew.gotIt')}
      </motion.button>
    </Sheet>
  )
}
