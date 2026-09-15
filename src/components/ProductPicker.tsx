import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Product } from '../lib/db'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconBox, IconCheck, IconSearch } from './Icons'
import { Sheet } from './Sheet'

/** Beyond this the list is scrolled, not read, so search earns its place on screen. */
const SEARCH_THRESHOLD = 7

interface ProductPickerProps {
  open: boolean
  onClose: () => void
  products: Product[]
  /** The product the calculator is currently tied to, or null for a loose calculation. */
  selectedId: number | null
  lang: AppLanguage
  unit: Unit
  onSelect: (productId: number | null) => void
}

/**
 * Links a calculation to a saved product, which is what lets the app learn from it: a cost
 * typed against a known product becomes an observation, and observations are the only thing
 * that makes the rate estimate personal rather than national.
 *
 * Choosing nothing is a first-class option, not an escape hatch — a quick what-if on a price
 * the shop has never bought should not end up in any product's price history.
 */
export function ProductPicker({ open, onClose, products, selectedId, lang, unit, onSelect }: ProductPickerProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // A reopened picker starts fresh: the last search is never what the user wants next.
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const searchable = products.length >= SEARCH_THRESHOLD

  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(lang === 'fa' ? 'fa' : 'en')
    const ordered = [...products].sort((a, b) => b.updatedAt - a.updatedAt)
    if (!needle) return ordered
    return ordered.filter((p) => p.name.toLocaleLowerCase(lang === 'fa' ? 'fa' : 'en').includes(needle))
  }, [products, query, lang])

  const choose = (id: number | null) => {
    vibrate()
    onSelect(id)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('picker.title')}>
      <div className="space-y-2.5">
        {searchable && (
          <label className="glass glass-ring flex items-center gap-2 rounded-[18px] px-3.5 py-2.5">
            <span aria-hidden className="text-[var(--text-tertiary)]">
              <IconSearch size={16} />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('picker.search')}
              aria-label={t('picker.search')}
              className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold outline-none placeholder:font-medium placeholder:text-[var(--text-tertiary)]"
            />
          </label>
        )}

        <ul className="space-y-1.5">
          {/* Always first, always reachable without scrolling past the whole catalogue. */}
          <li>
            <PickerRow
              label={t('picker.none')}
              selected={selectedId === null}
              reducedMotion={reducedMotion}
              onClick={() => choose(null)}
            />
          </li>
          {matches.map((product) => (
            <li key={product.id}>
              <PickerRow
                label={product.name}
                detail={formatAmountWithUnit(product.cost, lang, unit)}
                selected={product.id === selectedId}
                reducedMotion={reducedMotion}
                onClick={() => choose(product.id)}
              />
            </li>
          ))}
        </ul>

        {matches.length === 0 && (
          <p className="px-1 py-6 text-center text-[13.5px] font-medium text-[var(--text-secondary)]">
            {t('products.empty.title')}
          </p>
        )}
      </div>
    </Sheet>
  )
}

function PickerRow({
  label,
  detail,
  selected,
  reducedMotion,
  onClick,
}: {
  label: string
  detail?: string
  selected: boolean
  reducedMotion: boolean | null
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      onClick={onClick}
      aria-pressed={selected}
      className={`glass glass-ring flex w-full items-center gap-2.5 rounded-[18px] px-3.5 py-3 text-start transition-colors ${
        selected ? 'bg-accent-500/12' : ''
      }`}
    >
      <span aria-hidden className={selected ? 'text-[var(--accent-text)]' : 'text-[var(--text-tertiary)]'}>
        <IconBox size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{label}</span>
      {detail ? (
        <span className="shrink-0 text-[13px] font-semibold text-[var(--text-secondary)] tabular-nums">{detail}</span>
      ) : null}
      {selected ? (
        <span aria-hidden className="shrink-0 text-[var(--accent-text)]">
          <IconCheck size={16} />
        </span>
      ) : null}
    </motion.button>
  )
}
