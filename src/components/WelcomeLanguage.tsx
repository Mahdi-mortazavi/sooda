import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { AppIcon } from './AppIcon'

interface WelcomeLanguageProps {
  open: boolean
  onChoose: (lang: AppLanguage) => void
}

/**
 * First-launch overlay asking the user to pick a language.
 * Deliberately bilingual and hard-coded — it renders before a language exists.
 */
export function WelcomeLanguage({ open, onChoose }: WelcomeLanguageProps) {
  const reducedMotion = useReducedMotion()

  const choose = (lang: AppLanguage) => {
    vibrate()
    onChoose(lang)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.35 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--bg)]/60 p-6 backdrop-blur-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Choose your language · انتخاب زبان"
        >
          {/* No entrance animation — the static boot shell already painted this card. */}
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass-strong glass-ring w-full max-w-[360px] rounded-[32px] p-7 text-center"
          >
            <AppIcon size={84} className="mx-auto rounded-[22px] shadow-[0_12px_32px_rgba(15,122,95,0.35)]" />
            <h2 className="mt-4 text-[26px] font-bold tracking-tight">
              Sooda <span className="text-[var(--accent-text)]">·</span> سودا
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Choose your language
              <br />
              زبان خود را انتخاب کنید
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <motion.button
                type="button"
                lang="fa"
                dir="rtl"
                onClick={() => choose('fa')}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                className="w-full rounded-2xl bg-[var(--accent-fill-strong)] py-3.5 text-[17px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
              >
                فارسی
              </motion.button>
              <motion.button
                type="button"
                lang="en"
                dir="ltr"
                onClick={() => choose('en')}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                className="glass glass-ring w-full rounded-2xl py-3.5 text-[17px] font-bold text-[var(--text-primary)]"
              >
                English
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
