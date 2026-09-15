import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Product, StoreProfile } from '../lib/db'
import { vibrate } from '../lib/haptics'
import { readMonthlyInflationPercent } from '../lib/inflation'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import {
  buildProductsCsv,
  productStatus,
  searchProducts,
  sortProducts,
  type ProductSort,
  type ProductStatus,
} from '../lib/products'
import { downloadCsv } from '../lib/csv'
import type { RatesFile } from '../lib/rates/schema'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { BulkRepriceSheet } from './BulkRepriceSheet'
import { IconBox, IconCheck, IconDownload, IconSearch, IconTrendUp } from './Icons'
import { HealthChip, ProductSheet } from './ProductSheet'
import { SegmentedControl } from './SegmentedControl'
import { Toast } from './Toast'
import { emitTour } from '../learn/coach/events'
import { HelpButton, useLearn } from '../learn/ui/entry'
import { LessonLink } from '../learn/ui/LessonLink'
import { useRepository } from '../learn/ui/useRepository'

interface ProductsViewProps {
  lang: AppLanguage
  unit: Unit
  /** Jumps back to the calculator tab — used by the empty state's CTA. */
  onGoToCalculator: () => void
  /** null while the rates file is still loading; every estimate falls back to a bare prior. */
  rates: RatesFile | null
  profile: StoreProfile | null
  /** How many products the check-in would ask about — 0 hides the card entirely. */
  checkInCount: number
  onStartCheckIn: () => void
  /** Products a finished check-in found had gone up, to open bulk reprice preselected. */
  repriceIds: number[] | null
  onRepriceConsumed: () => void
  /** Lets the app recompute staleness and the badge after a write on this tab. */
  onProductsChanged: () => void
  /**
   * A sheet a lesson step asked for before it runs: `'product'` opens the first row under the
   * current sort, `'bulk-reprice'` opens the reprice sheet, anything else closes both. App owns
   * the other sheets and cannot reach these two, so it relays the request and this tab acts.
   */
  tourSheet?: string | null
  onTourSheetHandled?: () => void
}

interface ToastState {
  message: string
  action?: { label: string; onAction: () => void }
}

/** The "My products" tab: searchable, sortable price list with health chips, CSV export and bulk reprice. */
export function ProductsView({
  lang,
  unit,
  onGoToCalculator,
  rates,
  profile,
  checkInCount,
  onStartCheckIn,
  repriceIds,
  onRepriceConsumed,
  onProductsChanged,
  tourSheet = null,
  onTourSheetHandled,
}: ProductsViewProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const learn = useLearn()
  /* The demo shop during a lesson, the real one otherwise. Reading from the bound `db` directly
   * would show the shopkeeper's own price list inside the tutorial. */
  const { db, pinned } = useRepository()

  const items = useLiveQuery(() => db.products.toArray(), [db], undefined)
  const all = useMemo(() => items ?? [], [items])

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ProductSort>('risk')
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMounted, setBulkMounted] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [toastOpen, setToastOpen] = useState(false)

  // One status per product, from one inflation read and one clock reading per pass.
  const statuses = useMemo(() => {
    const now = Date.now()
    /* A lesson pins the rate, so the health chips agree with the figures the lesson quotes. */
    const monthlyInflationPercent = pinned?.monthlyInflationPercent ?? readMonthlyInflationPercent()
    const map = new Map<number, ProductStatus>()
    for (const p of all) map.set(p.id, productStatus(p, monthlyInflationPercent, now))
    return map
  }, [all])

  const visible = useMemo(() => sortProducts(searchProducts(all, query), sort, statuses), [all, query, sort, statuses])
  /* Read by the tour-sheet effect below without making it depend on the sorted array: a step that
   * asks for «the first product» wants the row on screen, not a re-run on every keystroke. */
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  /* A finished check-in hands over the products whose cost went up. Selecting them and
   * opening the bulk sheet is the whole point of the hand-off, so it happens without a tap;
   * the sheet still shows a preview and nothing is written until the user confirms. */
  useEffect(() => {
    if (repriceIds === null) return
    if (repriceIds.length > 0) {
      setSelecting(true)
      setSelectedIds(repriceIds)
      emitTour({ type: 'sheet:open', sheet: 'bulk-reprice' })
      setBulkMounted(true)
      setBulkOpen(true)
    }
    onRepriceConsumed()
  }, [repriceIds, onRepriceConsumed])

  useEffect(() => {
    if (tourSheet === null) return
    if (tourSheet === 'product') {
      const first = visibleRef.current[0]
      setBulkOpen(false)
      if (first !== undefined) {
        setDetailId(first.id)
        setDetailOpen(true)
      }
    } else if (tourSheet === 'bulk-reprice') {
      setDetailOpen(false)
      setBulkMounted(true)
      setBulkOpen(true)
    } else {
      setDetailOpen(false)
      setBulkOpen(false)
    }
    onTourSheetHandled?.()
  }, [tourSheet, onTourSheetHandled])

  const showToast = useCallback((message: string, action?: { label: string; onAction: () => void }) => {
    setToast({ message, action })
    setToastOpen(true)
  }, [])

  const detailProduct = all.find((p) => p.id === detailId) ?? null
  // Stable identity: the bulk sheet memoizes its preview on this array.
  const bulkTargets = useMemo(() => {
    const picked = all.filter((p) => selectedIds.includes(p.id))
    return picked.length > 0 ? picked : all
  }, [all, selectedIds])
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.includes(p.id))

  const toggleSelected = (id: number) => {
    vibrate()
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  const toggleSelectAll = () => {
    vibrate()
    setSelectedIds(allVisibleSelected ? [] : visible.map((p) => p.id))
  }

  const onExport = () => {
    if (all.length === 0) return
    vibrate()
    emitTour({ type: 'action', name: 'export-csv' })
    const headers = t('products.csvHeaders', { returnObjects: true }) as string[]
    downloadCsv(buildProductsCsv(all, headers), 'sooda-products.csv')
  }

  const openRow = (product: Product) => {
    vibrate()
    emitTour({ type: 'sheet:open', sheet: 'product' })
    setDetailId(product.id)
    setDetailOpen(true)
  }

  /* One place for both ways into the bulk sheet, so the tip and the event cannot come from one
   * of them and not the other. */
  const openBulk = () => {
    learn?.tip('bulk')
    emitTour({ type: 'sheet:open', sheet: 'bulk-reprice' })
    setBulkMounted(true)
    setBulkOpen(true)
  }

  const hasItems = all.length > 0

  return (
    <section aria-label={t('products.title')} className="flex flex-col pb-28">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-bold tracking-tight">{t('products.title')}</h2>
        <HelpButton lesson="products" className="self-center" />
        {hasItems ? (
          <span className="shrink-0 text-[13px] text-[var(--text-tertiary)]">
            {t('products.count', { replace: { count: formatNumber(all.length, lang, 0) } })}
          </span>
        ) : null}
      </div>

      {hasItems && checkInCount > 0 ? (
        <motion.button
          type="button"
          data-tour="checkin-card"
          layout={reducedMotion ? false : undefined}
          whileTap={reducedMotion ? undefined : { scale: 0.99 }}
          onClick={() => {
            vibrate()
            emitTour({ type: 'sheet:open', sheet: 'check-in' })
            onStartCheckIn()
          }}
          className="glass glass-ring mb-3 flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-start"
        >
          <span aria-hidden className="shrink-0 text-[var(--accent-text)]">
            <IconTrendUp size={18} />
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug">
            {t('checkin.cardTitle', { count: checkInCount, replace: { n: formatNumber(checkInCount, lang, 0) } })}
          </span>
          <span className="shrink-0 rounded-full bg-accent-500/16 px-3 py-1.5 text-[13px] font-bold text-[var(--accent-text)]">
            {t('checkin.cardCta')}
          </span>
        </motion.button>
      ) : null}

      {!hasItems ? (
        <div className="glass glass-ring flex flex-col items-center rounded-3xl px-6 py-10 text-center">
          <div className="glass glass-ring flex h-20 w-20 items-center justify-center rounded-[26px] text-[var(--accent-text)]">
            <IconBox size={38} />
          </div>
          <h3 className="mt-5 text-[20px] font-bold">{t('products.empty.title')}</h3>
          <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {t('products.empty.body')}
          </p>
          <motion.button
            type="button"
            onClick={() => {
              vibrate()
              onGoToCalculator()
            }}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            className="mt-5 rounded-2xl bg-[var(--accent-fill-strong)] px-5 py-3 text-[15px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
          >
            {t('products.empty.cta')}
          </motion.button>
          {/* The empty state is the one screen where a lesson is unambiguously the most useful
            * thing on it: there is nothing else here to do. */}
          <LessonLink lesson="products" />
        </div>
      ) : (
        <>
          <div className="glass glass-ring mb-3 flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
            <IconSearch size={18} className="shrink-0 text-[var(--text-tertiary)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('products.search')}
              aria-label={t('products.search')}
              className="w-full bg-transparent text-[16px] outline-none"
            />
          </div>

          <div className="mb-3">
            <SegmentedControl<ProductSort>
              layoutId="products-sort"
              ariaLabel={t('products.title')}
              value={sort}
              onChange={setSort}
              size="sm"
              options={[
                { value: 'risk', label: <span className="min-w-0 truncate">{t('products.sortRisk')}</span> },
                { value: 'name', label: <span className="min-w-0 truncate">{t('products.sortName')}</span> },
                { value: 'updated', label: <span className="min-w-0 truncate">{t('products.sortUpdated')}</span> },
              ]}
            />
          </div>

          {selecting ? (
            <div className="glass glass-ring mb-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
              <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-secondary)]">
                {t('products.bulkSelected', { replace: { count: formatNumber(selectedIds.length, lang, 0) } })}
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="shrink-0 text-[13px] font-bold text-[var(--accent-text)]"
              >
                {t('products.bulkSelectAll')}
              </button>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-[var(--text-secondary)]">{t('history.noMatches')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {visible.map((product, i) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    /* Only the first: a lesson points at «the riskiest product», and eight rows
                       sharing one name would leave the coach highlighting an arbitrary one. */
                    tour={i === 0 ? 'product-row' : undefined}
                    status={statuses.get(product.id)}
                    lang={lang}
                    unit={unit}
                    index={i}
                    selecting={selecting}
                    selected={selectedIds.includes(product.id)}
                    onToggleSelected={() => toggleSelected(product.id)}
                    onOpen={() => openRow(product)}
                    reducedMotion={!!reducedMotion}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-5 flex items-center gap-3">
            {selecting ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelecting(false)
                    setSelectedIds([])
                  }}
                  className="glass glass-ring flex-1 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--text-secondary)]"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    vibrate()
                    openBulk()
                  }}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3 text-[15px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
                >
                  <IconTrendUp size={18} />
                  <span className="min-w-0 truncate">{t('products.bulkOpen')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onExport}
                  className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
                >
                  <IconDownload size={18} />
                  <span className="min-w-0 truncate">{t('products.exportCsv')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    vibrate()
                    setSelecting(true)
                  }}
                  className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
                >
                  <IconTrendUp size={18} />
                  <span className="min-w-0 truncate">{t('products.bulkOpen')}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      <ProductSheet
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          emitTour({ type: 'sheet:close', sheet: 'product' })
        }}
        product={detailProduct}
        lang={lang}
        unit={unit}
        onToast={showToast}
        rates={rates}
        profile={profile}
        onProductsChanged={onProductsChanged}
      />

      {(bulkOpen || bulkMounted) && (
        <BulkRepriceSheet
          open={bulkOpen}
          onClose={() => {
            setBulkOpen(false)
            emitTour({ type: 'sheet:close', sheet: 'bulk-reprice' })
          }}
          products={bulkTargets}
          lang={lang}
          unit={unit}
          onToast={showToast}
          onApplied={onProductsChanged}
        />
      )}

      <Toast
        open={toastOpen}
        message={toast?.message ?? ''}
        action={toast?.action}
        onDismiss={() => setToastOpen(false)}
        durationMs={toast?.action ? 10000 : 4000}
      />
    </section>
  )
}

function ProductRow({
  product,
  tour,
  status,
  lang,
  unit,
  index,
  selecting,
  selected,
  onToggleSelected,
  onOpen,
  reducedMotion,
}: {
  product: Product
  tour?: string
  status: ProductStatus | undefined
  lang: AppLanguage
  unit: Unit
  index: number
  selecting: boolean
  selected: boolean
  onToggleSelected: () => void
  onOpen: () => void
  reducedMotion: boolean
}) {
  const { t } = useTranslation()
  const pct = t('fields.percentUnit')
  const rowUnit = product.unit ?? unit
  const marginTone =
    status === undefined
      ? 'text-[var(--text-secondary)]'
      : status.health === 'healthy'
        ? 'text-[var(--accent-text)]'
        : status.health === 'thin'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-loss-600 dark:text-loss-400'

  return (
    <motion.li
      data-tour={tour}
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: lang === 'fa' ? 60 : -60, height: 0, marginBottom: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.35) }}
      className="glass glass-ring flex items-center gap-3 rounded-2xl px-4 py-3"
    >
      {selecting ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={product.name}
          onClick={onToggleSelected}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected
              ? 'border-transparent bg-[var(--accent-fill-strong)] text-white dark:text-[hsl(168_90%_8%)]'
              : 'border-[var(--separator)] text-transparent'
          }`}
        >
          <IconCheck size={15} />
        </button>
      ) : null}

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[15px] font-semibold">{product.name}</span>
          {status ? <HealthChip health={status.health} /> : null}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate text-[14px] tabular-nums text-[var(--text-secondary)]">
            {formatAmountWithUnit(product.price, lang, rowUnit)}
          </span>
          <span dir="ltr" className={`shrink-0 text-[14px] font-semibold tabular-nums ${marginTone}`}>
            {status ? `${formatNumber(status.realMarginPercent, lang)}${pct}` : '—'}
          </span>
        </div>
        {status && status.costAgeMonths >= 1 ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">
            {t('products.costAge', { count: status.costAgeMonths, replace: { n: formatNumber(status.costAgeMonths, lang, 0) } })}
          </p>
        ) : null}
      </button>
    </motion.li>
  )
}
