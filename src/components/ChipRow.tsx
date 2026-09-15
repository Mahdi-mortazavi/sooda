import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { vibrate } from '../lib/haptics'
import { emitTour } from '../learn/coach/events'

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
  /** The row's `data-tour` name, e.g. `field-months`. */
  tour?: string
  /**
   * The field id this row stands for. Names each chip `chip-<key>-<value>` for `data-tour`, and
   * is the `group` of the `chip:select` event the row announces.
   */
  tourKey?: string
}

/** A scrollable row of glass pills with a sliding selection, for short fixed choices. */
export function ChipRow({ options, value, onChange, layoutId, ariaLabel, tour, tourKey }: ChipRowProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  /* The trailing fade is a scroll affordance, so it only earns its place when the row
   * really does overflow — applied unconditionally it dims a perfectly tappable chip. */
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const measure = () => setOverflowing(element.scrollWidth - element.clientWidth > 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [options])

  return (
    <div
      ref={scroller}
      data-tour={tour}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        overflowing
          ? '[mask-image:linear-gradient(to_right,#000_0,#000_calc(100%-24px),transparent_100%)] rtl:[mask-image:linear-gradient(to_left,#000_0,#000_calc(100%-24px),transparent_100%)]'
          : ''
      }`}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            data-tour={tourKey === undefined ? undefined : `chip-${tourKey}-${option.value}`}
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return
              vibrate()
              onChange(option.value)
              if (tourKey !== undefined) emitTour({ type: 'chip:select', group: tourKey, value: option.value })
            }}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition-colors duration-300 ${
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
