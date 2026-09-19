import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Product, StoreProfile } from '../lib/db'
import { emitTour } from '../learn/coach/events'
import { useRepository } from '../learn/ui/useRepository'
import { HelpButton, useLearn } from '../learn/ui/entry'
import { fxAt, fxLatest, productRate } from '../lib/rates'
import { resolveRateSettings } from '../lib/rates/resolve'
import type { RatesFile } from '../lib/rates/schema'
import { vibrate } from '../lib/haptics'
import { readMonthlyInflationPercent, suggestedPrice } from '../lib/inflation'
import { formatNumber, parseAmount, type AppLanguage } from '../lib/numbers'
import { productStatus, type ProductHealth, type ProductStatus } from '../lib/products'
import { readRoundingStep, roundUpTo } from '../lib/rounding'
import { UNITS, formatAmountWithUnit, unitShortLabel, type Unit } from '../lib/units'
import { IconAlert, IconCheck, IconTarget, IconTrash, IconTrendUp } from './Icons'
import { NumberField } from './NumberField'
import { RateCard } from './RateCard'
import { SegmentedControl } from './SegmentedControl'
import { Sheet } from './Sheet'

interface ProductSheetProps {
  open: boolean
  onClose: () => void
  product: Product | null
  lang: AppLanguage
  unit: Unit
  onToast: (message: string, action?: { label: string; onAction: () => void }) => void
  /** null while the rates file is loading — the card still renders, on the prior alone. */
  rates: RatesFile | null
  profile: StoreProfile | null
  /** A recorded cost changes the staleness list and the badge. */
  onProductsChanged?: () => void
}

/** Full editor for one saved product: live real margin, the new-cost shortcut, and a two-step delete. */
export function ProductSheet({
  open,
  onClose,
  product,
  lang,
  unit,
  onToast,
  rates,
  profile,
  onProductsChanged,
}: ProductSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  /* Practice runs this whole sheet against the demo shop, so every write below goes through the
   * injected repository rather than the exports bound to the shopkeeper's own database. */
  const { repository, pinned } = useRepository()
  const learn = useLearn()
  const productId = product?.id ?? null

  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [margin, setMargin] = useState('')
  const [price, setPrice] = useState('')
  const [rowUnit, setRowUnit] = useState<Unit>(unit)
  const [note, setNote] = useState('')
  const [newCostOpen, setNewCostOpen] = useState(false)
  const [newCost, setNewCost] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Re-seed whenever a different row is opened, so nothing leaks between products.
  useEffect(() => {
    if (!product) return
    setName(product.name)
    setCost(String(product.cost))
    setMargin(String(product.targetMarginPercent))
    setPrice(String(product.price))
    setRowUnit(product.unit ?? 'none')
    setNote(product.note ?? '')
    setNewCostOpen(false)
    setNewCost('')
    setShowErrors(false)
    setConfirmingDelete(false)
    // Seeding is keyed on identity only: later edits must not be overwritten by a live re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const costValue = parseAmount(cost)
  const marginValue = parseAmount(margin)
  const priceValue = parseAmount(price)

  const nameError = name.trim() === '' ? t('errors.required') : null
  const costError = !Number.isFinite(costValue)
    ? t('errors.invalid')
    : costValue <= 0
      ? t('errors.notPositive')
      : null
  // Same rules the calculator itself applies to these fields (`profit.ts`/`sell.ts`): a selling
  // price and a target margin may be exactly 0 (giving something away, a breakeven line) but
  // never negative. This sheet used to only check `Number.isFinite`, so a shopkeeper could type
  // -5000/-50%, see no error anywhere, save, and only find out from the health chip afterwards
  // — reading "Losing -105%" on a product whose numbers were never valid in the first place.
  const priceError = !Number.isFinite(priceValue)
    ? t('errors.invalid')
    : priceValue < 0
      ? t('errors.negative')
      : null
  const marginError = !Number.isFinite(marginValue)
    ? t('errors.invalid')
    : marginValue < 0
      ? t('errors.negative')
      : null

  // The chip reflects what is on screen right now, not what is stored.
  const status: ProductStatus | null = useMemo(() => {
    if (!product) return null
    if (!Number.isFinite(costValue) || costValue <= 0 || !Number.isFinite(priceValue)) return null
    const provisional: Product = {
      ...product,
      cost: costValue,
      targetMarginPercent: Number.isFinite(marginValue) ? marginValue : 0,
      price: priceValue,
      unit: rowUnit,
    }
    // Pinned during a lesson: the health chip must agree with the figure the lesson quotes.
    return productStatus(provisional, pinned?.monthlyInflationPercent ?? readMonthlyInflationPercent(), Date.now())
  }, [product, costValue, marginValue, priceValue, rowUnit, pinned])

  /* Only this product's readings, and only while the sheet is open. `null` (loading) is
   * distinct from `[]` (a product with no history), which is what the card's empty copy is for. */
  const observations = useLiveQuery(
    () => (open && productId !== null ? repository.listObservations(productId) : Promise.resolve([])),
    [open, productId, repository],
    undefined,
  )

  const rateSettings = useMemo(() => resolveRateSettings(product ?? {}, profile), [product, profile])

  /* One clock reading per open, not per render: a `now` that advanced on every keystroke
   * would make the rate and the restock figure creep while the user is reading them. */
  const [rateNow] = useState(() => Date.now())

  const rate = useMemo(() => {
    if (!product) return null
    return productRate({
      observations: observations ?? [],
      category: rateSettings.category,
      importDependency: rateSettings.importDependency,
      ...(rateSettings.manualMonthlyPercent === undefined
        ? {}
        : { manualMonthlyPercent: rateSettings.manualMonthlyPercent }),
      rates,
      now: rateNow,
    })
  }, [product, observations, rateSettings, rates, rateNow])

  /* The rate card is the most surprising thing in the app — a number the app worked out rather
   * than one the shopkeeper typed — so its first appearance earns the one-line hint. */
  useEffect(() => {
    if (open && productId !== null) learn?.tip('rate')
  }, [open, productId, learn])

  const history = useMemo(
    () => (observations ?? []).filter((o) => o.excluded !== true).map((o) => o.cost),
    [observations],
  )

  /* How far the dollar has moved since the last purchase — shown only when both ends are
   * known, because "the dollar is up 0%" from a missing reading would be a claim, not a fact. */
  const fxChangePercent = useMemo(() => {
    if (!rates || rate?.lastObservedAt == null) return null
    const then = fxAt(rates.fx.series, rate.lastObservedAt)
    const latest = fxLatest(rates.fx.series)
    if (then === null || latest === null || then <= 0) return null
    return (latest[1] / then - 1) * 100
  }, [rates, rate?.lastObservedAt])

  const onManualRateChange = async (monthlyPercent: number | null) => {
    if (!product) return
    // undefined clears the column; null from the card means "back to the automatic estimate".
    await repository.updateProduct(product.id, { manualMonthlyPercent: monthlyPercent ?? undefined })
    onProductsChanged?.()
  }

  const newCostValue = parseAmount(newCost)
  const suggested =
    Number.isFinite(newCostValue) && newCostValue > 0 && Number.isFinite(marginValue)
      ? roundUpTo(suggestedPrice(newCostValue, marginValue), pinned?.roundingStep ?? readRoundingStep())
      : null

  const pct = t('fields.percentUnit')

  const onApplyNewCost = async () => {
    if (!product || suggested === null) return
    vibrate()
    setCost(String(newCostValue))
    setPrice(String(suggested))
    setNewCostOpen(false)
    setNewCost('')
    /* recordCost, not updateProduct: a new purchase price is exactly the evidence the
     * estimate is built from, and it stamps cost/costUpdatedAt in the same transaction.
     * The FX rate of the day is stored with it so an imported product's restock figure can
     * later ride the dollar rather than the blended rate. */
    const observedAt = Date.now()
    const fxToday = rates ? fxAt(rates.fx.series, observedAt) : null
    await repository.recordCost({
      productId: product.id,
      cost: newCostValue,
      observedAt,
      ...(fxToday === null ? {} : { fxAtDate: fxToday }),
      source: 'update',
    })
    await repository.updateProduct(product.id, { price: suggested })
    emitTour({ type: 'action', name: 'apply-new-cost' })
    onProductsChanged?.()
    onToast(t('products.saved'))
  }

  const onSave = async () => {
    if (!product) return
    if (nameError || costError || priceError || marginError) {
      setShowErrors(true)
      return
    }
    vibrate()
    await repository.updateProduct(product.id, {
      name: name.trim(),
      cost: costValue,
      targetMarginPercent: marginValue,
      price: priceValue,
      unit: rowUnit,
      note: note.trim(),
    })
    onToast(t('products.saved'))
    onClose()
  }

  const onDelete = async () => {
    if (!product) return
    vibrate()
    await repository.deleteProduct(product.id)
    emitTour({ type: 'action', name: 'delete-product' })
    setConfirmingDelete(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('products.detailTitle')}>
      {!product ? null : (
        <div className="flex flex-col gap-4">
          <section aria-label={t('products.realMargin')} className="glass-strong glass-ring rounded-3xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('products.realMargin')}
              </span>
              {status ? <HealthChip health={status.health} /> : null}
            </div>
            <p dir="ltr" className={`mt-1 text-[26px] font-bold tabular-nums ${lang === 'fa' ? 'text-end' : 'text-start'}`}>
              {status ? `${formatNumber(status.realMarginPercent, lang)}${pct}` : '—'}
            </p>
            {status ? (
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {t('lens.replacementCost')}: {formatAmountWithUnit(status.replacement, lang, rowUnit)}
              </p>
            ) : null}
          </section>

          <section aria-label={t('products.name')} className="glass glass-ring rounded-3xl px-5 py-3.5">
            <label htmlFor="product-name" className="block text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
              {t('products.name')}
            </label>
            <input
              id="product-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('products.namePlaceholder')}
              autoComplete="off"
              aria-invalid={showErrors && nameError ? true : undefined}
              aria-describedby={showErrors && nameError ? 'product-name-error' : undefined}
              className="mt-0.5 w-full min-w-0 bg-transparent text-[20px] font-semibold tracking-tight text-[var(--text-primary)] outline-none placeholder:font-medium"
            />
            {showErrors && nameError ? (
              <p id="product-name-error" role="alert" className="mt-1 text-[13px] font-medium text-loss-600 dark:text-loss-400">
                {nameError}
              </p>
            ) : null}
          </section>

          <div className="glass glass-ring rounded-3xl">
            <NumberField
              id="product-cost"
              label={t('fields.purchasePrice')}
              value={cost}
              onChange={setCost}
              placeholder={t('fields.amountPlaceholder')}
              lang={lang}
              error={showErrors ? costError : null}
            />
            <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
            <NumberField
              id="product-margin"
              label={t('products.targetMargin')}
              value={margin}
              onChange={setMargin}
              placeholder={t('fields.percentPlaceholder')}
              lang={lang}
              unit={pct}
              error={showErrors ? marginError : null}
            />
            <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
            <NumberField
              id="product-price"
              label={t('fields.sellingPrice')}
              value={price}
              onChange={setPrice}
              placeholder={t('fields.amountPlaceholder')}
              lang={lang}
              error={showErrors ? priceError : null}
            />
          </div>

          {rate ? (
            <div className="relative">
            {/* Sits over the card's own corner rather than in its header: the rate card is shared
              * with nothing else, and threading a button through it would widen its props for
              * one caller. */}
            <div className="absolute end-3 top-3 z-10">
              <HelpButton lesson="smartRates" />
            </div>
            <RateCard
              rate={rate}
              history={history}
              category={rateSettings.category}
              importDependency={rateSettings.importDependency}
              lang={lang}
              fxChangePercent={fxChangePercent}
              onManualChange={(monthlyPercent) => void onManualRateChange(monthlyPercent)}
            />
            </div>
          ) : null}

          <section data-tour="product-new-cost" aria-label={t('products.newCost')}>
            <motion.button
              type="button"
              data-tour="btn-new-cost-open"
              onClick={() => {
                vibrate()
                setNewCostOpen((v) => !v)
              }}
              aria-expanded={newCostOpen}
              whileTap={reducedMotion ? undefined : { scale: 0.98 }}
              className="glass glass-ring flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
            >
              <IconTrendUp size={18} />
              <span className="min-w-0 flex-1 text-start">{t('products.newCost')}</span>
            </motion.button>

            <AnimatePresence initial={false}>
              {newCostOpen && (
                <motion.div
                  key="new-cost"
                  initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="overflow-hidden"
                >
                  <div className="glass glass-ring mt-2.5 rounded-3xl">
                    <NumberField
                      id="product-new-cost"
                      label={t('products.newCost')}
                      value={newCost}
                      onChange={setNewCost}
                      placeholder={t('fields.amountPlaceholder')}
                      lang={lang}
                      tourField="new-cost"
                      tour="field-new-cost"
                    />
                    {suggested !== null ? (
                      <>
                        <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
                        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
                              {t('products.suggestedPrice')}
                            </p>
                            <p className="truncate text-[20px] font-bold tabular-nums">
                              {formatAmountWithUnit(suggested, lang, rowUnit)}
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            data-tour="btn-new-cost-apply"
                            onClick={() => void onApplyNewCost()}
                            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-fill-strong)] px-4 py-2 text-[13px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
                          >
                            <IconCheck size={15} />
                            {t('products.newCostApply')}
                          </motion.button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section aria-label={t('settings.unit')}>
            <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('settings.unit')}
            </h3>
            <SegmentedControl<Unit>
              layoutId="product-unit"
              ariaLabel={t('settings.unit')}
              value={rowUnit}
              onChange={setRowUnit}
              size="sm"
              options={UNITS.map((u) => ({ value: u, label: unitShortLabel(u, lang) }))}
            />
          </section>

          <section aria-label={t('products.note')} className="glass glass-ring rounded-3xl px-5 py-3.5">
            <label htmlFor="product-note" className="block text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
              {t('products.note')}
            </label>
            <textarea
              id="product-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-0.5 w-full min-w-0 resize-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none"
            />
          </section>

          <motion.button
            type="button"
            onClick={() => void onSave()}
            whileTap={reducedMotion ? undefined : { scale: 0.97 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            <IconCheck size={18} />
            {t('products.save')}
          </motion.button>

          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{t('actions.areYouSure')}</span>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="shrink-0 rounded-2xl bg-loss-600 px-4 py-2.5 text-[14px] font-semibold text-white"
              >
                {t('actions.delete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="glass glass-ring shrink-0 rounded-2xl px-4 py-2.5 text-[14px] font-semibold text-[var(--text-secondary)]"
              >
                {t('actions.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="glass glass-ring flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-loss-600 dark:text-loss-400"
            >
              <IconTrash size={18} />
              {t('products.delete')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

const HEALTH_STYLES: Record<ProductHealth, string> = {
  healthy: 'bg-accent-500/16 text-[var(--accent-text)]',
  thin: 'bg-amber-500/16 text-amber-600 dark:text-amber-400',
  losing: 'bg-loss-500/16 text-loss-600 dark:text-loss-400',
}

/** Health badge that always carries its text label, so colour is never the only signal. */
export function HealthChip({ health }: { health: ProductHealth }) {
  const { t } = useTranslation()
  const labels: Record<ProductHealth, string> = {
    healthy: t('products.healthHealthy'),
    thin: t('products.healthThin'),
    losing: t('products.healthLosing'),
  }
  const Icon = health === 'healthy' ? IconTarget : IconAlert
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${HEALTH_STYLES[health]}`}
    >
      <Icon size={13} />
      {labels[health]}
    </span>
  )
}
