import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Mode } from '../lib/calc'
import { computeBasketTotals, type BasketTotals } from '../lib/basket'
import { clearBasket, deleteBasketItem, type BasketItem } from '../lib/db'
import { emitTour } from '../learn/coach/events'
import { useRepository } from '../learn/ui/useRepository'
import { LessonLink } from '../learn/ui/LessonLink'
import { vibrate } from '../lib/haptics'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { formatAmountWithUnit, unitShortLabel, type Unit } from '../lib/units'
import { IconBasket, IconTrash } from './Icons'
import { MODE_ICONS } from '../lib/modes/icons'
import { entrySummary } from '../lib/modes/summary'
import { Sheet } from './Sheet'

interface BasketSheetProps {
  open: boolean
  onClose: () => void
  lang: AppLanguage
}

export function BasketSheet({ open, onClose, lang }: BasketSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [confirmingClear, setConfirmingClear] = useState(false)

  /* The practice basket during a lesson. The real one also mirrors its count into localStorage
   * for the header badge, which a lesson must not move — so practice writes the table directly. */
  const { db, practice } = useRepository()
  const items = useLiveQuery(() => db.basket.orderBy('createdAt').reverse().toArray(), [db], undefined)
  const totals = computeBasketTotals(items ?? [])
  const hasItems = (items?.length ?? 0) > 0

  /* One row, from whichever basket the sheet is showing. The real helper also re-publishes the
   * header badge; the practice one must not, so it writes the table and stops there. */
  const deleteItem = async (id: number): Promise<void> => {
    await (practice ? db.basket.delete(id) : deleteBasketItem(id))
  }

  const modeLabels: Record<Mode, string> = {
    profit: t('modes.profit'),
    sell: t('modes.sell'),
    discount: t('modes.discount'),
    rdiscount: t('modes.rdiscount'),
    installment: t('modes.installment'),
    rinstallment: t('modes.rinstallment'),
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('basket.title')}>
      {!hasItems ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <div className="glass glass-ring flex h-20 w-20 items-center justify-center rounded-[26px] text-[var(--accent-text)]">
            <IconBasket size={38} />
          </div>
          <h3 className="mt-5 text-[20px] font-bold">{t('basket.empty.title')}</h3>
          <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {t('basket.empty.body')}
          </p>
          <LessonLink lesson="everyday" />
        </div>
      ) : (
        <>
          {totals.map((g) => (
            <TotalsCard key={g.unit} totals={g} lang={lang} showUnitTag={totals.length > 1} />
          ))}

          <ul className="mt-4 flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {(items ?? []).map((item) => (
                <BasketRow
                  key={item.id}
                  item={item}
                  lang={lang}
                  modeLabel={modeLabels[item.mode]}
                  onDelete={deleteItem}
                  reducedMotion={!!reducedMotion}
                />
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-5">
            {confirmingClear ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    vibrate()
                    emitTour({ type: 'action', name: 'clear-basket' })
                    void (practice ? db.basket.clear() : clearBasket()).then(() => setConfirmingClear(false))
                  }}
                  className="flex-1 rounded-2xl bg-loss-600 px-3 py-3 text-[15px] font-semibold text-white"
                >
                  {t('actions.confirmDelete')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingClear(false)}
                  className="glass glass-ring flex-1 rounded-2xl px-3 py-3 text-[15px] font-semibold text-[var(--text-secondary)]"
                >
                  {t('actions.cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="glass glass-ring flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-loss-600 dark:text-loss-400"
              >
                <IconTrash size={18} />
                {t('actions.clearAll')}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}

function TotalsCard({ totals, lang, showUnitTag }: { totals: BasketTotals; lang: AppLanguage; showUnitTag: boolean }) {
  const { t } = useTranslation()
  const fmt = (v: number) => formatAmountWithUnit(v, lang, totals.unit)
  const pct = t('fields.percentUnit')
  const isLoss = totals.profit < 0

  return (
    <section className="glass-strong glass-ring mb-3 rounded-3xl p-5" aria-label={t('basket.totals')}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {t('basket.totals')}
        </h3>
        {showUnitTag && totals.unit !== 'none' ? (
          <span className="rounded-full bg-accent-500/14 px-2.5 py-0.5 text-[12px] font-bold text-[var(--accent-text)]">
            {unitShortLabel(totals.unit, lang)}
          </span>
        ) : null}
      </div>

      {totals.sellerCount > 0 && (
        <div className="mt-3">
          {totals.shopperCount > 0 && (
            <p className="mb-1 text-[12px] font-semibold text-[var(--text-tertiary)]">{t('basket.sellerSection')}</p>
          )}
          <TotalRow label={t('basket.totalCost')} value={fmt(totals.cost)} />
          <TotalRow label={t('basket.totalRevenue')} value={fmt(totals.revenue)} />
          <TotalRow
            label={isLoss ? t('basket.totalLoss') : t('basket.totalProfit')}
            value={fmt(totals.profit)}
            emphasis
            loss={isLoss}
          />
          {totals.marginPercent !== null && (
            <TotalRow
              label={t('basket.overallMargin')}
              value={`${formatNumber(totals.marginPercent, lang)}${pct}`}
              loss={isLoss}
            />
          )}
        </div>
      )}

      {totals.shopperCount > 0 && (
        <div className={totals.sellerCount > 0 ? 'mt-3 border-t border-[var(--separator)] pt-3' : 'mt-3'}>
          {totals.sellerCount > 0 && (
            <p className="mb-1 text-[12px] font-semibold text-[var(--text-tertiary)]">{t('basket.shopperSection')}</p>
          )}
          <TotalRow label={t('basket.totalOriginal')} value={fmt(totals.original)} />
          <TotalRow label={t('basket.totalPay')} value={fmt(totals.pay)} emphasis />
          <TotalRow label={t('basket.totalSaved')} value={fmt(totals.saved)} />
        </div>
      )}
    </section>
  )
}

function TotalRow({ label, value, emphasis, loss }: { label: string; value: string; emphasis?: boolean; loss?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-[14px] font-medium text-[var(--text-secondary)]">{label}</span>
      <span
        className={`tabular-nums ${emphasis ? 'text-[20px] font-bold' : 'text-[15px] font-semibold'} ${
          loss ? 'text-loss-600 dark:text-loss-400' : emphasis ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function BasketRow({
  item,
  lang,
  modeLabel,
  onDelete,
  reducedMotion,
}: {
  item: BasketItem
  lang: AppLanguage
  modeLabel: string
  onDelete: (id: number) => Promise<void>
  reducedMotion: boolean
}) {
  const { t } = useTranslation()
  const Icon = MODE_ICONS[item.mode]
  const unit: Unit = item.unit ?? 'none'
  const fmt = (v: number) => formatNumber(v, lang)
  const fmtU = (v: number) => formatAmountWithUnit(v, lang, unit)
  const pct = t('fields.percentUnit')

  const { text: summary, isLoss } = entrySummary(item.mode, item.inputs, item.results, {
    number: fmt,
    money: fmtU,
    percent: pct,
  })

  return (
    <motion.li
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: lang === 'fa' ? 60 : -60, height: 0, marginBottom: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className="glass glass-ring flex items-center gap-3.5 rounded-2xl px-4 py-3"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[var(--accent-text)]">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-semibold">{modeLabel}</span>
        <p
          dir="ltr"
          className={`truncate text-[14px] tabular-nums ${
            isLoss ? 'font-semibold text-loss-600 dark:text-loss-400' : 'text-[var(--text-secondary)]'
          } ${lang === 'fa' ? 'text-end' : 'text-start'}`}
        >
          {summary}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          vibrate()
          void onDelete(item.id)
        }}
        aria-label={t('basket.deleteItem')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-loss-500/12 hover:text-loss-600 dark:hover:text-loss-400"
      >
        <IconTrash size={18} />
      </button>
    </motion.li>
  )
}
