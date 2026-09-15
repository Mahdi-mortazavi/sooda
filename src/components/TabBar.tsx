import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { vibrate } from '../lib/haptics'
import { IconBox, IconCalculator } from './Icons'

export type AppTab = 'calculator' | 'products'

interface TabBarProps {
  value: AppTab
  onChange: (tab: AppTab) => void
}

/** Floating liquid-glass tab bar pinned to the bottom of the viewport, with a sliding indicator. */
export function TabBar({ value, onChange }: TabBarProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const tabs: { id: AppTab; label: string; Icon: typeof IconBox }[] = [
    { id: 'calculator', label: t('tabs.calculator'), Icon: IconCalculator },
    { id: 'products', label: t('tabs.products'), Icon: IconBox },
  ]

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div role="tablist" aria-label={t('app.name')} className="glass-strong glass-ring flex w-full rounded-[24px] p-1.5">
        {tabs.map(({ id, label, Icon }) => {
          const selected = id === value
          return (
            <motion.button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              onClick={() => {
                if (selected) return
                vibrate()
                onChange(id)
              }}
              className={`relative flex-1 rounded-[18px] px-2 py-1.5 transition-colors duration-300 ${
                selected ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="tab-indicator"
                  aria-hidden
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-[18px] bg-white/80 shadow-[0_2px_10px_rgba(20,40,35,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-white/16 dark:shadow-[0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.16)]"
                />
              )}
              <span className="relative z-10 flex flex-col items-center gap-0.5">
                <Icon size={22} />
                <span className="text-[11px] font-semibold leading-tight">{label}</span>
              </span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
