import { useLiveQuery } from 'dexie-react-hooks'
import { motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { db } from '../lib/db'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { recordCost } from '../lib/observations'
import { fxAt } from '../lib/rates'
import type { RatesFile } from '../lib/rates/schema'
import type { Unit } from '../lib/units'
import { IconBox } from './Icons'
import { RecordCostPrompt } from './RecordCostPrompt'

const ProductPicker = lazy(() => import('./ProductPicker').then((m) => ({ default: m.ProductPicker })))

/** Below this the two costs are the same purchase, not a new one worth recording. */
const MIN_CHANGE_PERCENT = 0.5

interface CalcProductLinkProps {
  /** The purchase price the calculation was run on. */
  cost: number
  lang: AppLanguage
  unit: Unit
  rates: RatesFile | null
  /** A recorded cost changes the estimates and the badge. */
  onChanged: () => void
}

/**
 * Ties a calculation to a saved product, which is what turns an ordinary day's work into
 * the price history the estimate is built from. The shopkeeper already typed a purchase
 * price to get an answer; all this asks is which product it was for.
 *
 * Nothing is written by picking. The offer to record appears only once a product is chosen
 * AND the typed cost actually differs from what that product last recorded — re-running the
 * same numbers must not fill the history with duplicate readings.
 */
export function CalcProductLink({ cost, lang, unit, rates, onChanged }: CalcProductLinkProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const products = useLiveQuery(() => db.products.toArray(), [], undefined)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Cleared on a successful write so the prompt does not reappear for a reading already taken.
  const [recordedFor, setRecordedFor] = useState<string | null>(null)

  const all = products ?? []
  const selected = all.find((p) => p.id === selectedId) ?? null

  /* A product deleted on the other tab must not leave the calculator pointing at it. */
  useEffect(() => {
    if (selectedId !== null && products !== undefined && !products.some((p) => p.id === selectedId)) {
      setSelectedId(null)
    }
  }, [products, selectedId])

  const changed =
    selected !== null &&
    selected.cost > 0 &&
    Math.abs(cost / selected.cost - 1) * 100 >= MIN_CHANGE_PERCENT

  const onRecord = async () => {
    if (!selected) return
    const observedAt = Date.now()
    const fxToday = rates ? fxAt(rates.fx.series, observedAt) : null
    await recordCost({
      productId: selected.id,
      cost,
      observedAt,
      ...(fxToday === null ? {} : { fxAtDate: fxToday }),
      source: 'calc',
    })
    setRecordedFor(`${selected.id}:${cost}`)
    onChanged()
  }

  // Nothing saved yet — there is no product to link to, so the whole control stays out of the way.
  if (all.length === 0) return null

  return (
    <div className="mt-2">
      <motion.button
        type="button"
        whileTap={reducedMotion ? undefined : { scale: 0.99 }}
        onClick={() => {
          vibrate()
          setPickerOpen(true)
        }}
        className="glass glass-ring flex w-full items-center gap-2.5 rounded-[20px] px-3.5 py-3 text-start"
      >
        <span aria-hidden className={selected ? 'text-[var(--accent-text)]' : 'text-[var(--text-tertiary)]'}>
          <IconBox size={16} />
        </span>
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-[var(--text-secondary)]">
          {t('picker.label')}
        </span>
        <span className="min-w-0 max-w-[55%] truncate text-[13.5px] font-semibold">
          {selected ? selected.name : t('picker.none')}
        </span>
      </motion.button>

      <RecordCostPrompt
        open={changed && recordedFor !== `${selected?.id}:${cost}`}
        productName={selected?.name ?? ''}
        onRecord={() => void onRecord()}
        // Declining is remembered for this exact reading, so it is asked once, not on every render.
        onDismiss={() => setRecordedFor(`${selected?.id}:${cost}`)}
      />

      <Suspense fallback={null}>
        {pickerOpen && (
          <ProductPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            products={all}
            selectedId={selectedId}
            lang={lang}
            unit={unit}
            onSelect={setSelectedId}
          />
        )}
      </Suspense>
    </div>
  )
}
