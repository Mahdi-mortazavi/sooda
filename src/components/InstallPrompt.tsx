import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InstallPromptState } from '../hooks/useInstallPrompt'
import { vibrate } from '../lib/haptics'
import { AppIcon } from './AppIcon'
import { IconClose, IconPlusSquare, IconShareUp } from './Icons'
import { Sheet } from './Sheet'

interface InstallPromptProps {
  state: InstallPromptState
  /** Delay the banner until onboarding (language choice) is finished. */
  ready: boolean
}

/** Elegant glass install banner + iOS Add-to-Home-Screen guide. */
export function InstallPrompt({ state, ready }: InstallPromptProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!ready || !state.available) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), 2200)
    return () => clearTimeout(timer)
  }, [ready, state.available])

  const onAction = () => {
    vibrate()
    if (state.canNativePrompt) {
      setVisible(false)
      void state.promptInstall()
    } else {
      setGuideOpen(true)
    }
  }

  const onDismiss = () => {
    setVisible(false)
    state.dismiss()
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="install-banner"
            initial={reducedMotion ? { opacity: 0 } : { y: 120, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: 140, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-4"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="glass-strong glass-ring flex items-center gap-3.5 rounded-[24px] p-3.5">
              <AppIcon size={52} className="shrink-0 rounded-[14px] shadow-[0_6px_18px_rgba(15,122,95,0.35)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold leading-tight">{t('install.title')}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-[var(--text-secondary)]">{t('install.body')}</p>
              </div>
              <motion.button
                type="button"
                onClick={onAction}
                whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                className="shrink-0 rounded-full bg-[var(--accent-fill-strong)] px-5 py-2.5 text-[14px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
              >
                {state.canNativePrompt ? t('install.install') : t('install.guide')}
              </motion.button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label={t('install.dismiss')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-black/8 dark:hover:bg-white/10"
              >
                <IconClose size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title={t('install.iosTitle')}>
        <p className="mb-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">{t('install.iosIntro')}</p>
        <ol className="flex flex-col gap-3">
          <GuideStep index={1} icon={<IconShareUp size={22} />} text={t('install.iosStep1')} />
          <GuideStep index={2} icon={<IconPlusSquare size={22} />} text={t('install.iosStep2')} />
          <GuideStep index={3} icon={<span className="text-[17px] font-bold">Add</span>} text={t('install.iosStep3')} />
        </ol>
        <div className="mt-6 flex justify-center pb-2">
          <AppIcon size={64} className="rounded-[16px] opacity-90 shadow-[0_8px_24px_rgba(15,122,95,0.3)]" />
        </div>
      </Sheet>
    </>
  )
}

function GuideStep({ index, icon, text }: { index: number; icon: React.ReactNode; text: string }) {
  return (
    <li className="glass glass-ring flex items-center gap-4 rounded-2xl px-4 py-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[var(--accent-text)]">
        {icon}
      </span>
      <span className="text-[15px] font-medium leading-snug">
        <span className="me-1.5 text-[var(--accent-text)]">{index}.</span>
        {text}
      </span>
    </li>
  )
}
