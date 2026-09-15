import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { Product } from '../lib/db'
import { vibrate } from '../lib/haptics'
import { formatDate } from '../lib/dates'
import { formatNumber, parseAmount, type AppLanguage } from '../lib/numbers'
import { addObservation, recordCost } from '../lib/observations'
import { checkOutlier } from '../lib/rates'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconBox, IconCheck, IconTrendUp } from './Icons'
import { NumberField } from './NumberField'
import { OutlierDialog } from './OutlierDialog'
import { Sheet } from './Sheet'

/** One stable id: the field is never remounted between products, so the keyboard never drops. */
const FIELD_ID = 'checkin-cost'

/** How long the "saved as temporary" line stays up before it stops competing with the next product. */
const NOTICE_MS = 2600

/** Past this much travel (or this much flick) a horizontal drag counts as "skip this one". */
const SWIPE_DISTANCE = 84
const SWIPE_VELOCITY = 520

export interface CheckInItem {
  product: Product
  /** What the engine thinks it costs today. */
  predictedCost: number
  /** Chronological history, for the outlier check. */
  history: { cost: number; observedAt: number; excluded?: boolean }[]
}

export interface CheckInOutcome {
  /** Products whose recorded cost went UP — the ones worth repricing. */
  increasedIds: number[]
  recordedIds: number[]
}

interface CheckInSheetProps {
  open: boolean
  onClose: () => void
  items: CheckInItem[]
  lang: AppLanguage
  unit: Unit
  /** Injected so the flow is testable and never disagrees with the estimate that opened it. */
  now: number
  /** Called once when the user reaches the finish screen. */
  onFinish: (outcome: CheckInOutcome) => void
  /** The finish screen's CTA into bulk reprice, preselected with `increasedIds`. */
  onReprice: (productIds: number[]) => void
}

/** The last reading the estimator would actually trust, or the product's own stamped cost. */
function lastRecorded(item: CheckInItem): { cost: number; observedAt: number } {
  const usable = item.history.filter((h) => h.excluded !== true)
  return usable[usable.length - 1] ?? { cost: item.product.cost, observedAt: item.product.costUpdatedAt }
}

/**
 * The habit loop: one product at a time, three taps wide, keyboard-complete. Every estimate in
 * Sooda is only as good as how often this gets done, so the whole screen is built around not
 * making the shopkeeper wait — the card advances before the write lands, and the field keeps focus.
 */
export function CheckInSheet({ open, onClose, items, lang, unit, now, onFinish, onReprice }: CheckInSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [pendingCost, setPendingCost] = useState<number | null>(null)
  const [notice, setNotice] = useState(false)
  const [recordedIds, setRecordedIds] = useState<number[]>([])
  const [increasedIds, setIncreasedIds] = useState<number[]>([])
  const finishedRef = useRef(false)

  const total = items.length
  const current = items[index]
  const done = total > 0 && index >= total

  // A reopened sheet is a new run: nothing from the previous one should carry over.
  useEffect(() => {
    if (!open) return
    setIndex(0)
    setDraft('')
    setPendingCost(null)
    setNotice(false)
    setRecordedIds([])
    setIncreasedIds([])
    finishedRef.current = false
  }, [open])

  // Exactly once, on first arrival at the finish screen — not on every render of it.
  useEffect(() => {
    if (!open || !done || finishedRef.current) return
    finishedRef.current = true
    onFinish({ increasedIds, recordedIds })
  }, [open, done, increasedIds, recordedIds, onFinish])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(false), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  /* Sheet claims the panel for itself when it opens, so the first focus has to land after that.
   * Keyed on the position, not on `current`: a fresh `items` array from the parent must not yank
   * focus out from under someone who is mid-type. */
  useEffect(() => {
    if (!open || index >= total) return
    const timer = window.setTimeout(() => document.getElementById(FIELD_ID)?.focus({ preventScroll: true }), 120)
    return () => window.clearTimeout(timer)
  }, [open, index, total])

  /* The dialog restores focus to whatever opened it when it unmounts; a parent effect runs after
   * that cleanup, so this is what actually puts the caret back in the field. */
  const dialogWasOpen = useRef(false)
  useEffect(() => {
    if (pendingCost !== null) {
      dialogWasOpen.current = true
      return
    }
    if (!dialogWasOpen.current) return
    dialogWasOpen.current = false
    document.getElementById(FIELD_ID)?.focus({ preventScroll: true })
  }, [pendingCost])

  const advance = () => {
    setDraft('')
    setIndex((i) => i + 1)
    /* Synchronous, still inside the user's tap: iOS only keeps the keyboard up for a focus call
     * that belongs to a real gesture, and a keyboard that closes between products costs seconds. */
    document.getElementById(FIELD_ID)?.focus({ preventScroll: true })
  }

  const record = (cost: number, temporary: boolean) => {
    if (!current) return
    const id = current.product.id
    const previous = lastRecorded(current).cost
    vibrate()
    setRecordedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    /* A temporary price is a sale, not a new normal — repricing off it would hand the shopkeeper
     * a selling price built on a discount they will never get again. */
    if (!temporary && cost > previous) setIncreasedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    advance()
    /* Excluded readings are kept but must not move `product.cost`, so they go in as a plain
     * observation; a real reading stamps the product so nothing on screen can disagree with it. */
    const write: Promise<unknown> = temporary
      ? addObservation({ productId: id, cost, observedAt: now, excluded: true, source: 'checkin' })
      : recordCost({ productId: id, cost, observedAt: now, source: 'checkin' })
    void write.catch(() => {
      /* Nothing the shopkeeper can act on mid-flow. The product simply stays stale and gets
       * offered again on the next check-in, which is the safe direction to fail in. */
    })
  }

  const typedCost = parseAmount(draft)
  const canRecord = Number.isFinite(typedCost) && typedCost > 0

  const submitTyped = () => {
    if (!current || !canRecord) return
    const verdict = checkOutlier(current.history, { cost: typedCost, observedAt: now })
    // A jump this big is usually a missing or extra zero — ask before it reaches the history.
    if (verdict.outlier) {
      vibrate()
      setPendingCost(typedCost)
      return
    }
    record(typedCost, false)
  }

  const recordUnchanged = () => {
    if (!current) return
    const previous = lastRecorded(current).cost
    // Nothing usable to repeat — treat it as a skip rather than writing a zero into the history.
    if (!Number.isFinite(previous) || previous <= 0) {
      vibrate()
      advance()
      return
    }
    record(previous, false)
  }

  const skip = () => {
    if (!current) return
    vibrate()
    advance()
  }

  /* Physical axis, derived from the language: `dir` flips the layout but never a transform, so
   * "forward" is leftwards in English and rightwards in Persian. */
  const forward = lang === 'fa' ? 1 : -1

  return (
    <Sheet open={open} onClose={onClose} title={t('checkin.title')}>
      {total === 0 ? (
        <p className="px-4 py-12 text-center text-[15px] leading-relaxed text-[var(--text-secondary)]">
          {t('checkin.empty')}
        </p>
      ) : done ? (
        <FinishScreen
          lang={lang}
          increasedIds={increasedIds}
          reducedMotion={!!reducedMotion}
          onReprice={onReprice}
        />
      ) : current ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div aria-hidden className="flex flex-wrap items-center gap-1.5">
              {items.map((item, i) => (
                <motion.span
                  key={item.product.id}
                  animate={{ width: i === index ? 20 : 6 }}
                  transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 32 }}
                  className={`block h-1.5 rounded-full ${
                    i === index
                      ? 'bg-[var(--accent-fill-strong)]'
                      : i < index
                        ? 'bg-accent-500/45'
                        : 'bg-[var(--separator)]'
                  }`}
                />
              ))}
            </div>
            <p role="status" className="text-[12.5px] font-semibold tracking-wide text-[var(--text-tertiary)]">
              {t('checkin.progress', { n: formatNumber(index + 1, lang, 0), total: formatNumber(total, lang, 0) })}
            </p>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            <motion.section
              key={current.product.id}
              aria-label={current.product.name}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: forward * -34 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: forward * 34 }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 34 }}
              drag={reducedMotion ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                const travel = info.offset.x * forward
                const flick = info.velocity.x * forward
                if (travel > SWIPE_DISTANCE || flick > SWIPE_VELOCITY) skip()
              }}
              className="glass-strong glass-ring rounded-3xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-500/14 text-[var(--accent-text)]">
                  <IconBox size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[18px] font-bold tracking-tight">{current.product.name}</h3>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {t('checkin.lastCost', {
                      amount: formatAmountWithUnit(lastRecorded(current).cost, lang, current.product.unit ?? unit),
                      date: formatDate(lastRecorded(current).observedAt, lang),
                    })}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 flex items-start gap-1.5 border-t border-[var(--separator)] pt-2.5 text-[13.5px] leading-relaxed text-[var(--accent-text)]">
                <IconTrendUp size={15} className="mt-px shrink-0" />
                {t('checkin.predicted', {
                  amount: formatAmountWithUnit(current.predictedCost, lang, current.product.unit ?? unit),
                })}
              </p>
            </motion.section>
          </AnimatePresence>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitTyped()
            }}
            className="flex flex-col gap-3"
          >
            <div className="glass glass-ring rounded-3xl">
              <NumberField
                id={FIELD_ID}
                label={t('checkin.field')}
                value={draft}
                onChange={setDraft}
                placeholder={t('fields.amountPlaceholder')}
                lang={lang}
              />
            </div>

            <motion.button
              type="submit"
              disabled={!canRecord}
              whileTap={reducedMotion || !canRecord ? undefined : { scale: 0.97 }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white disabled:opacity-40 dark:text-[hsl(168_90%_8%)]"
            >
              <IconCheck size={18} />
              {t('checkin.record')}
            </motion.button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={recordUnchanged}
                className="glass glass-ring min-w-0 flex-1 rounded-2xl px-3 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
              >
                {t('checkin.unchanged')}
              </button>
              <button
                type="button"
                onClick={skip}
                className="glass glass-ring min-w-0 flex-1 rounded-2xl px-3 py-3 text-[15px] font-semibold text-[var(--text-secondary)]"
              >
                {t('checkin.later')}
              </button>
            </div>
          </form>

          <p role="status" className="min-h-[18px] text-[13px] text-[var(--text-secondary)]">
            {notice ? t('outlier.excluded') : ''}
          </p>

          <OutlierDialog
            open={pendingCost !== null}
            from={lastRecorded(current).cost}
            to={pendingCost ?? 0}
            lang={lang}
            unit={current.product.unit ?? unit}
            onConfirm={() => {
              const cost = pendingCost
              setPendingCost(null)
              if (cost !== null) record(cost, false)
            }}
            onFix={() => {
              setPendingCost(null)
              document.getElementById(FIELD_ID)?.focus({ preventScroll: true })
            }}
            onTemporary={() => {
              const cost = pendingCost
              setPendingCost(null)
              if (cost !== null) {
                record(cost, true)
                setNotice(true)
              }
            }}
          />
        </div>
      ) : null}
    </Sheet>
  )
}

/** The payoff screen: what the run bought the shopkeeper, and the one action that cashes it in. */
function FinishScreen({
  lang,
  increasedIds,
  reducedMotion,
  onReprice,
}: {
  lang: AppLanguage
  increasedIds: number[]
  reducedMotion: boolean
  onReprice: (productIds: number[]) => void
}) {
  const { t } = useTranslation()
  const raised = increasedIds.length

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
      className="flex flex-col items-center px-6 py-10 text-center"
    >
      <div className="glass glass-ring flex h-20 w-20 items-center justify-center rounded-[26px] text-[var(--accent-text)]">
        <IconCheck size={38} />
      </div>
      <h3 className="mt-5 text-[20px] font-bold">{t('checkin.doneTitle')}</h3>
      <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-[var(--text-secondary)]">
        {raised > 0 ? t('checkin.doneBody', { n: formatNumber(raised, lang, 0) }) : t('checkin.doneNone')}
      </p>
      {raised > 0 && (
        <motion.button
          type="button"
          onClick={() => {
            vibrate()
            onReprice(increasedIds)
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white dark:text-[hsl(168_90%_8%)]"
        >
          <IconTrendUp size={18} />
          {t('checkin.doneCta')}
        </motion.button>
      )}
    </motion.div>
  )
}
