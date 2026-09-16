import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Product } from '../lib/db'
import { vibrate } from '../lib/haptics'
import { formatNumber, parseAmount, type AppLanguage } from '../lib/numbers'
import { readMonthlyInflationPercent } from '../lib/inflation'
import { previewBulk, type BulkOp, type ProductChange } from '../lib/products'
import { readRoundingStep } from '../lib/rounding'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconCheck, IconSigma } from './Icons'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'
import { Sheet } from './Sheet'
import { emitTour } from '../learn/coach/events'
import { HelpButton } from '../learn/ui/entry'
import { useRepository } from '../learn/ui/useRepository'

type BulkKind = BulkOp['kind']

interface BulkRepriceSheetProps {
  open: boolean
  onClose: () => void
  /** The products the user selected, or all of them when nothing was selected. */
  products: Product[]
  lang: AppLanguage
  unit: Unit
  onToast: (message: string, action?: { label: string; onAction: () => void }) => void
  /** Fired after a commit AND after an undo — both change what the estimates and badge should say. */
  onApplied?: () => void
}

/** Previews a cost-up or retarget reprice across many products, then commits it with a 10-second undo. */
export function BulkRepriceSheet({ open, onClose, products, lang, unit, onToast, onApplied }: BulkRepriceSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  // A reprice is the largest write in the app; during a lesson it must land in the demo shop.
  const { repository, pinned } = useRepository()
  const [kind, setKind] = useState<BulkKind>('costUp')
  const [percent, setPercent] = useState('10')
  const [applying, setApplying] = useState(false)

  const parsedPercent = parseAmount(percent)
  const percentValue = Number.isFinite(parsedPercent) ? parsedPercent : 0
  /* Both pinned during a lesson, so the preview a learner is asked about matches the figures the
   * lesson quotes rather than whatever this device has rounding set to. */
  const step = pinned?.roundingStep ?? readRoundingStep()

  const rows = useMemo(() => {
    const op: BulkOp = kind === 'costUp' ? { kind: 'costUp', percent: percentValue } : { kind: 'retarget' }
    return previewBulk(products, op, step, pinned?.monthlyInflationPercent ?? readMonthlyInflationPercent(), Date.now())
  }, [products, kind, percentValue, step, pinned])

  const changed = rows.filter((r) => r.newPrice !== r.oldPrice || r.newCost !== r.oldCost)
  const canApply = changed.length > 0 && !applying

  const pct = t('fields.percentUnit')
  const costUpLabel = t('products.bulkCostUp', { percent: formatNumber(percentValue, lang) })

  const onApply = async () => {
    if (!canApply) return
    setApplying(true)
    try {
      // Snapshot before the write, so Undo can put every row back verbatim.
      const snapshot = products.map((p) => ({ ...p }))
      const now = Date.now()
      const changes: ProductChange[] = changed.map((r) =>
        kind === 'costUp'
          ? { id: r.id, price: r.newPrice, cost: r.newCost, costUpdatedAt: now }
          : { id: r.id, price: r.newPrice },
      )
      const { observationIds } = await repository.bulkApply(changes)
      vibrate()
      emitTour({ type: 'action', name: 'bulk-apply' })
      onApplied?.()
      onToast(t('products.bulkApplied'), {
        label: t('products.bulkUndo'),
        onAction: () => {
          // Undo puts the old costs back, so the stale list has to be recomputed again — and it
          // takes back exactly the readings this run created, named rather than re-derived.
          void repository
            .restoreProducts(snapshot, observationIds)
            .then(() => {
              emitTour({ type: 'action', name: 'bulk-undo' })
              onApplied?.()
            })
            .catch(() => {
              /* The products lesson ends on this very reprice, so the toast can still be on
               * screen when the lesson finishes and the practice database is deleted under it.
               * The handle then rejects, which is the safe direction — it cannot reach the real
               * shop — but without this it surfaces as an unhandled rejection. Nothing to
               * report either way: the shop the undo belonged to no longer exists. */
            })
        },
      })
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('products.bulkTitle')}>
      <div data-tour="bulk-panel" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <p className="min-w-0 flex-1 text-[13px] text-[var(--text-tertiary)]">
            {t('products.count', { replace: { count: formatNumber(products.length, lang, 0) } })}
          </p>
          <HelpButton lesson="products" />
        </div>

        <SegmentedControl<BulkKind>
          layoutId="bulk-op"
          ariaLabel={t('products.bulkTitle')}
          value={kind}
          onChange={setKind}
          size="sm"
          options={[
            {
              value: 'costUp',
              label: <span className="min-w-0 truncate">{costUpLabel}</span>,
              ariaLabel: costUpLabel,
              tour: 'chip-bulk-costup',
            },
            {
              value: 'retarget',
              label: <span className="min-w-0 truncate">{t('products.bulkRetarget')}</span>,
              ariaLabel: t('products.bulkRetarget'),
            },
          ]}
        />

        <AnimatePresence initial={false}>
          {kind === 'costUp' && (
            <motion.div
              key="bulk-percent"
              initial={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="overflow-hidden"
            >
              <div className="glass glass-ring rounded-3xl">
                <NumberField
                  id="bulk-percent"
                  label={t('products.bulkPercent')}
                  value={percent}
                  onChange={setPercent}
                  placeholder={t('fields.percentPlaceholder')}
                  lang={lang}
                  unit={pct}
                  tourField="bulk-percent"
                  tour="field-bulk-percent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section aria-label={t('products.bulkPreview')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('products.bulkPreview')}
          </h3>
          {changed.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-[var(--text-secondary)]">{t('products.bulkNoChange')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const isChanged = row.newPrice !== row.oldPrice || row.newCost !== row.oldCost
                const rowUnit = products.find((p) => p.id === row.id)?.unit ?? unit
                const delta = row.newPrice - row.oldPrice
                return (
                  <li
                    key={row.id}
                    className={`glass glass-ring flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                      isChanged ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{row.name}</p>
                      <p
                        dir="ltr"
                        className={`truncate text-[13px] tabular-nums text-[var(--text-secondary)] ${
                          lang === 'fa' ? 'text-end' : 'text-start'
                        }`}
                      >
                        {formatAmountWithUnit(row.oldPrice, lang, rowUnit)} → {formatAmountWithUnit(row.newPrice, lang, rowUnit)}
                      </p>
                    </div>
                    <span
                      dir="ltr"
                      className={`shrink-0 text-[13px] font-bold tabular-nums ${
                        delta > 0
                          ? 'text-[var(--accent-text)]'
                          : delta < 0
                            ? 'text-loss-600 dark:text-loss-400'
                            : 'text-[var(--text-tertiary)]'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {formatNumber(delta, lang)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <motion.button
          type="button"
          data-tour="btn-bulk-apply"
          onClick={() => void onApply()}
          disabled={!canApply}
          whileTap={reducedMotion || !canApply ? undefined : { scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white disabled:opacity-40 dark:text-[hsl(168_90%_8%)]"
        >
          {changed.length > 0 ? <IconCheck size={18} /> : <IconSigma size={18} />}
          {t('products.bulkApply')}
        </motion.button>
      </div>
    </Sheet>
  )
}
