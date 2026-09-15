import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { formatDate } from '../lib/dates'
import { vibrate } from '../lib/haptics'
import { buildSchedule } from '../lib/schedule'
import type { ScheduleInfo } from '../lib/modes/types'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconCheck, IconCopy, IconLink } from './Icons'
import { Sheet } from './Sheet'

interface ScheduleSheetProps {
  open: boolean
  onClose: () => void
  schedule: ScheduleInfo | null
  lang: AppLanguage
  unit: Unit
}

/** The instalment plan, as a customer-facing list — it deliberately carries no margin or profit. */
export function ScheduleSheet({ open, onClose, schedule, lang, unit }: ScheduleSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  const shareTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(
    () => () => {
      clearTimeout(copyTimer.current)
      clearTimeout(shareTimer.current)
    },
    [],
  )

  const rows = useMemo(
    () => (schedule ? buildSchedule(schedule.installment, schedule.count, schedule.startAt) : []),
    [schedule],
  )

  const money = (value: number) => formatAmountWithUnit(value, lang, unit)

  /* Everything the buyer needs and nothing they don't: no cost, no margin, no rate. */
  const plainText = useMemo(() => {
    if (!schedule) return ''
    const lines = [t('installment.schedule.heading')]
    if (schedule.downPayment > 0) lines.push(t('installment.schedule.downLine', { amount: money(schedule.downPayment) }))
    for (const row of rows) {
      lines.push(
        `${t('installment.schedule.row', { index: formatNumber(row.index, lang, 0) })} — ` +
          `${formatDate(row.dueAt, lang)} — ${money(row.amount)}`,
      )
    }
    lines.push(t('installment.schedule.totalLine', { amount: money(schedule.total) }))
    return lines.join('\n')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, rows, lang, unit, t])

  const onCopy = async () => {
    vibrate()
    try {
      await navigator.clipboard.writeText(plainText)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  }

  const onShare = async () => {
    vibrate()
    const payload = { title: t('installment.schedule.heading'), text: plainText }
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
        await navigator.share(payload)
        return
      }
    } catch {
      // The user cancelled the native sheet, or sharing failed — fall through to copy.
    }
    try {
      await navigator.clipboard.writeText(plainText)
      setShared(true)
      clearTimeout(shareTimer.current)
      shareTimer.current = setTimeout(() => setShared(false), 1800)
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('installment.schedule.title')}>
      {schedule ? (
        <>
          {schedule.downPayment > 0 && (
            <div className="glass glass-ring mb-3 flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3">
              <span className="text-[15px] font-medium text-[var(--text-secondary)]">{t('installment.downPayment')}</span>
              <span className="text-[16px] font-bold tabular-nums">{money(schedule.downPayment)}</span>
            </div>
          )}

          <ol className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <motion.li
                key={row.index}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 34,
                  delay: reducedMotion ? 0 : Math.min(index * 0.03, 0.3),
                }}
                className="glass glass-ring flex items-center gap-3.5 rounded-2xl px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[13px] font-bold text-[var(--accent-text)] tabular-nums">
                  {formatNumber(row.index, lang, 0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tabular-nums">{money(row.amount)}</p>
                  <time dateTime={new Date(row.dueAt).toISOString()} className="text-[12.5px] text-[var(--text-tertiary)]">
                    {formatDate(row.dueAt, lang)}
                  </time>
                </div>
              </motion.li>
            ))}
          </ol>

          <div className="glass glass-ring mt-3 flex items-baseline justify-between gap-3 rounded-2xl px-4 py-3">
            <span className="text-[15px] font-semibold">{t('installment.total')}</span>
            <span className="text-[18px] font-bold tabular-nums text-[var(--accent-text)]">{money(schedule.total)}</span>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void onShare()}
              className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
            >
              {shared ? <IconCheck size={18} /> : <IconLink size={18} />}
              {t('installment.schedule.share')}
            </button>
            <button
              type="button"
              onClick={() => void onCopy()}
              className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
            >
              {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
              {copied ? t('installment.schedule.copied') : t('installment.schedule.copy')}
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  )
}
