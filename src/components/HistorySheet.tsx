import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Mode } from '../lib/calc'
import { buildHistoryCsv, downloadCsv } from '../lib/csv'
import { clearHistory, db, deleteHistoryEntry, type HistoryEntry } from '../lib/db'
import { emitTour } from '../learn/coach/events'
import { LessonLink } from '../learn/ui/LessonLink'
import { vibrate } from '../lib/haptics'
import { formatNumber, normalizeDigits, type AppLanguage } from '../lib/numbers'
import { formatAmountWithUnit } from '../lib/units'
import { IconClock, IconDownload, IconSearch, IconTrash } from './Icons'
import { MODE_ICONS } from '../lib/modes/icons'
import { entrySummary } from '../lib/modes/summary'
import { Sheet } from './Sheet'

interface HistorySheetProps {
  open: boolean
  onClose: () => void
  lang: AppLanguage
}

export function HistorySheet({ open, onClose, lang }: HistorySheetProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const reducedMotion = useReducedMotion()

  const entries = useLiveQuery(() => db.history.orderBy('createdAt').reverse().toArray(), [], undefined)

  const modeLabels: Record<Mode, string> = {
    profit: t('modes.profit'),
    sell: t('modes.sell'),
    discount: t('modes.discount'),
    rdiscount: t('modes.rdiscount'),
    installment: t('modes.installment'),
    rinstallment: t('modes.rinstallment'),
  }

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = normalizeDigits(query.trim()).toLowerCase()
    if (!q) return entries
    return entries.filter((e) => {
      const haystack = [
        modeLabels[e.mode].toLowerCase(),
        ...e.inputs.map(String),
        ...e.results.map(String),
        ...e.inputs.map((v) => formatNumber(v, lang)),
        ...e.results.map((v) => formatNumber(v, lang)),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q) || normalizeDigits(haystack).includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, lang, modeLabels.profit, modeLabels.sell, modeLabels.discount, modeLabels.rdiscount])

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    [lang],
  )

  const onExport = () => {
    if (!entries?.length) return
    vibrate()
    emitTour({ type: 'action', name: 'export-csv' })
    const headers = t('history.csvHeaders', { returnObjects: true }) as string[]
    downloadCsv(buildHistoryCsv(entries, headers, modeLabels), 'sooda-history.csv')
  }

  const onClearAll = async () => {
    vibrate()
    emitTour({ type: 'action', name: 'clear-history' })
    await clearHistory()
    setConfirmingClear(false)
  }

  const hasEntries = (entries?.length ?? 0) > 0

  return (
    <Sheet open={open} onClose={onClose} title={t('history.title')}>
      {hasEntries && (
        <div className="glass glass-ring mb-4 flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
          <IconSearch size={18} className="shrink-0 text-[var(--text-tertiary)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            aria-label={t('history.searchPlaceholder')}
            className="w-full bg-transparent text-[16px] outline-none"
          />
        </div>
      )}

      {!hasEntries ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-[var(--text-secondary)]">{t('history.noMatches')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {filtered.map((entry, i) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                lang={lang}
                index={i}
                modeLabel={modeLabels[entry.mode]}
                dateFormatter={dateFormatter}
                reducedMotion={!!reducedMotion}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {hasEntries && (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            data-tour="btn-export-csv"
            onClick={onExport}
            className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
          >
            <IconDownload size={18} />
            {t('actions.exportCsv')}
          </button>
          {confirmingClear ? (
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => void onClearAll()}
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
              className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-loss-600 dark:text-loss-400"
            >
              <IconTrash size={18} />
              {t('actions.clearAll')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="glass glass-ring flex h-20 w-20 items-center justify-center rounded-[26px] text-[var(--accent-text)]">
        <IconClock size={38} />
      </div>
      <h3 className="mt-5 text-[20px] font-bold">{t('history.empty.title')}</h3>
      <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
        {t('history.empty.body')}
      </p>
      <LessonLink lesson="everyday" />
    </div>
  )
}

function HistoryItem({
  entry,
  lang,
  index,
  modeLabel,
  dateFormatter,
  reducedMotion,
}: {
  entry: HistoryEntry
  lang: AppLanguage
  index: number
  modeLabel: string
  dateFormatter: Intl.DateTimeFormat
  reducedMotion: boolean
}) {
  const { t } = useTranslation()
  const Icon = MODE_ICONS[entry.mode]
  const fmt = (v: number) => formatNumber(v, lang)
  const fmtU = (v: number) => formatAmountWithUnit(v, lang, entry.unit ?? 'none')
  const pct = t('fields.percentUnit')
  const { text: summary, isLoss } = entrySummary(entry.mode, entry.inputs, entry.results, {
    number: fmt,
    money: fmtU,
    percent: pct,
  })

  return (
    <motion.li
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: lang === 'fa' ? 60 : -60, height: 0, marginBottom: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34, delay: reducedMotion ? 0 : Math.min(index * 0.035, 0.35) }}
      className="glass glass-ring flex items-center gap-3.5 rounded-2xl px-4 py-3"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[var(--accent-text)]">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-semibold">{modeLabel}</span>
          <time
            dateTime={new Date(entry.createdAt).toISOString()}
            className="shrink-0 text-[12px] text-[var(--text-tertiary)]"
          >
            {dateFormatter.format(entry.createdAt)}
          </time>
        </div>
        <p
          dir="ltr"
          className={`truncate text-start text-[14px] tabular-nums ${
            isLoss ? 'font-semibold text-loss-600 dark:text-loss-400' : 'text-[var(--text-secondary)]'
          } ${lang === 'fa' ? 'text-end' : ''}`}
        >
          {summary}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          vibrate()
          void deleteHistoryEntry(entry.id)
        }}
        aria-label={t('history.deleteEntry')}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-loss-500/12 hover:text-loss-600 dark:hover:text-loss-400"
      >
        <IconTrash size={18} />
      </button>
    </motion.li>
  )
}
