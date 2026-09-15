import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { vibrate } from '../lib/haptics'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  ariaLabel?: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  layoutId: string
  ariaLabel: string
  size?: 'md' | 'sm'
  /**
   * Tabs by default, because that is what the mode switchers are. A control that asks a
   * question — "are your goods imported?" — is a radio group: announcing it as a tablist
   * promises panels that do not exist and have no aria-controls to point at.
   */
  as?: 'tablist' | 'radiogroup'
}

/** iOS-style glass segmented control with a sliding liquid indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  size = 'md',
  as = 'tablist',
}: SegmentedControlProps<T>) {
  const radio = as === 'radiogroup'
  return (
    <div
      role={as}
      aria-label={ariaLabel}
      className={`glass glass-ring flex w-full rounded-2xl ${size === 'md' ? 'p-1.5' : 'p-1'}`}
    >
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            role={radio ? 'radio' : 'tab'}
            {...(radio ? { 'aria-checked': selected } : { 'aria-selected': selected })}
            aria-label={opt.ariaLabel}
            onClick={() => {
              if (!selected) {
                vibrate()
                onChange(opt.value)
              }
            }}
            /* min-w-0 lets the button shrink below its content; without it flex-1 refuses
               to go under the intrinsic label width and the control spills off a 360px screen. */
            className={`relative min-w-0 flex-1 rounded-xl font-semibold transition-colors duration-300 ${
              size === 'md' ? 'px-2 py-2 text-[15px]' : 'px-2 py-1.5 text-[13px]'
            } ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-xl bg-white/80 shadow-[0_2px_10px_rgba(20,40,35,0.14),inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-white/16 dark:shadow-[0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.16)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            {/* A plain string label may be long (the instalment questions are whole sentences),
                so it ellipsises rather than spilling past the control on a narrow phone. */}
            <span className="relative z-10 flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap">
              {typeof opt.label === 'string' ? <span className="min-w-0 truncate">{opt.label}</span> : opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
