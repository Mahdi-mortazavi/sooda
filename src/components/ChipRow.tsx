import { motion } from 'motion/react'
import { vibrate } from '../lib/haptics'

export interface ChipOption {
  value: string
  label: string
}

interface ChipRowProps {
  options: ChipOption[]
  value: string
  onChange: (value: string) => void
  /** Unique per row so the sliding pill animates between this row's chips only. */
  layoutId: string
  ariaLabel: string
}

/** A scrollable row of glass pills with a sliding selection, for short fixed choices. */
export function ChipRow({ options, value, onChange, layoutId, ariaLabel }: ChipRowProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return
              vibrate()
              onChange(option.value)
            }}
            className={`relative shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition-colors duration-300 ${
              selected ? 'text-white dark:text-[hsl(168_90%_8%)]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-full bg-[var(--accent-fill-strong)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
