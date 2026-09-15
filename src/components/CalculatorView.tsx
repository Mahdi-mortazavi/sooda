import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { createDraftWriter, readDraft, type DraftState } from '../lib/drafts'
import { vibrate } from '../lib/haptics'
import {
  SEGMENTS,
  defaultModeOfSegment,
  emptyStates,
  ensureBehaviour,
  isModeId,
  perMode,
  runMode,
  segmentIndexOf,
  validateMode,
  visibleFields,
} from '../lib/modes/registry'
import type { ModeId, ModeState, ResultDisplay, ScheduleInfo, SegmentId, Translate } from '../lib/modes/types'
import type { RatesFile } from '../lib/rates/schema'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import type { RoundingStep } from '../lib/rounding'
import { buildModeShareQuery, parseModeShareQuery } from '../lib/share'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconPercent, IconScale, IconTag, IconTagReverse, IconWallet } from './Icons'
import { ErrorBoundary } from './ErrorBoundary'
import { LensRow } from './LensRow'
import { ModeFields } from './ModeFields'
import type { ProductDraft } from './SaveProductSheet'
import { SegmentedControl } from './SegmentedControl'

const ScheduleSheet = lazy(() => import('./ScheduleSheet').then((m) => ({ default: m.ScheduleSheet })))
// The result card only exists once the user has tapped Calculate, which is seconds
// after load and a deliberate act — so its refraction filter and real-profit block
// have no business in the bytes that decide first paint.
const ResultCard = lazy(() => import('./ResultCard').then((m) => ({ default: m.ResultCard })))
// Only ever mounted under a result that carries a cost, so it never costs a first-time user anything.
const CalcProductLink = lazy(() => import('./CalcProductLink').then((m) => ({ default: m.CalcProductLink })))

interface Snapshot {
  inputs: number[]
  results: number[]
  unit: Unit
}

/** Cash and instalment pricing share the profit segment; these are the two halves of its sub-control. */
type ProfitKind = 'cash' | 'installments'

interface CalculatorViewProps {
  lang: AppLanguage
  unit: Unit
  /** Onboarding is finished — safe to auto-run a shared link. */
  ready: boolean
  monthlyInflationPercent: number
  roundingStep: RoundingStep
  /** The lens's inflation chip is a shortcut into Settings, where the rate lives. */
  onOpenSettings: () => void
  onSaveProduct: (draft: ProductDraft) => void
  /** null while the rates file loads; only used to stamp the day's FX on a recorded cost. */
  rates: RatesFile | null
  /** A cost recorded from here changes the stale list and the badge. */
  onProductsChanged: () => void
  /** Persisted with the calculator draft so a service-worker reload lands where the user was. */
  tab: DraftState['tab']
}

export function CalculatorView({
  lang,
  unit,
  ready,
  monthlyInflationPercent,
  roundingStep,
  onOpenSettings,
  onSaveProduct,
  rates,
  onProductsChanged,
  tab,
}: CalculatorViewProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  // A shared calculation link pre-fills and auto-computes; mode-only links
  // (?m=profit) from PWA shortcuts just open the right calculator. A link always
  // beats a restored draft — the user clicked it on purpose.
  const shared = useMemo(() => parseModeShareQuery(window.location.search), [])
  const restored = useMemo(() => (shared ? null : readDraft()), [shared])
  const sharedRan = useRef(false)

  const [mode, setMode] = useState<ModeId>(() => shared?.mode ?? asModeId(restored?.mode) ?? 'profit')
  const [prevSegment, setPrevSegment] = useState(() => segmentIndexOf(shared?.mode ?? asModeId(restored?.mode) ?? 'profit'))
  const [states, setStates] = useState<Record<ModeId, ModeState>>(() => {
    const initial = emptyStates()
    if (restored) {
      for (const key of Object.keys(initial) as ModeId[]) {
        const saved = restored.modes[key]
        if (saved) initial[key] = { ...initial[key], ...saved }
      }
    }
    if (shared) {
      const target = { ...initial[shared.mode] }
      for (const [key, value] of Object.entries(shared.values)) target[key] = String(value)
      initial[shared.mode] = target
    }
    return initial
  })
  const [errors, setErrors] = useState<Record<ModeId, Record<string, ValidationError>>>(() =>
    perMode<Record<string, ValidationError>>(() => ({})),
  )
  const [results, setResults] = useState<Record<ModeId, ResultDisplay | null>>(() =>
    perMode<ResultDisplay | null>(() => null),
  )
  // Raw numbers behind the latest result per mode, for add-to-basket.
  const lastComputed = useRef<Record<ModeId, Snapshot | null>>(perMode<Snapshot | null>(() => null))

  // The card is a lazy chunk. The first keystroke is seconds of typing ahead of the
  // first Calculate, which is ample time to fetch it — so the result never waits.
  const warmedResultCard = useRef(false)
  const warmResultCard = useCallback(() => {
    if (warmedResultCard.current) return
    warmedResultCard.current = true
    void import('./ResultCard')
  }, [])

  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const rtl = lang === 'fa'
  const segmentIndex = segmentIndexOf(mode)
  // Slide direction: +1 when moving toward the next segment, mirrored for RTL.
  const direction = (segmentIndex >= prevSegment ? 1 : -1) * (rtl ? -1 : 1)
  const isProfitSegment = segmentIndex === 0
  const isDiscountSegment = segmentIndex === 2
  const isInstallment = mode === 'installment' || mode === 'rinstallment'

  // Keep typed input across the reload a new service worker triggers.
  const draftWriter = useMemo(() => createDraftWriter(), [])
  useEffect(() => () => draftWriter.cancel(), [draftWriter])
  useEffect(() => {
    draftWriter.save({ modes: states, mode, tab })
  }, [states, mode, tab, draftWriter])

  const onSegmentChange = useCallback(
    (next: SegmentId) => {
      setPrevSegment(segmentIndexOf(mode))
      setMode(defaultModeOfSegment(next))
      // Keep the viewport anchored — prevents the page-jump feel on mobile.
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [mode, reducedMotion],
  )

  const setField = useCallback(
    (key: string, value: string) => {
      warmResultCard()
      setStates((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: value } }))
      setErrors((prev) => {
        if (!prev[mode][key]) return prev
        const next = { ...prev[mode] }
        delete next[key]
        return { ...prev, [mode]: next }
      })
    },
    [mode, warmResultCard],
  )

  /** Instalment pricing starts from the price the profit tab just worked out. */
  const onProfitKindChange = useCallback(
    (kind: ProfitKind) => {
      if (kind === 'cash') {
        setMode('profit')
        return
      }
      const lastProfit = lastComputed.current.profit
      setStates((prev) => {
        if ((prev.installment['cash'] ?? '') !== '' || !lastProfit) return prev
        const cash = String(lastProfit.results[0] ?? '')
        return {
          ...prev,
          installment: { ...prev.installment, cash },
          rinstallment: { ...prev.rinstallment, cash },
        }
      })
      setMode('installment')
    },
    [],
  )

  const translate = useCallback<Translate>((key, vars) => t(key, vars ?? {}), [t])
  const fmtMoney = useCallback((value: number) => formatAmountWithUnit(value, lang, unit), [lang, unit])
  const fmtNumber = useCallback((value: number) => formatNumber(value, lang), [lang])

  const calculate = useCallback(
    async (saveToHistory = true) => {
      vibrate()
      const state = states[mode]
      // Instalment maths is a separate chunk; load it before validating so the
      // cross-field rules (down payment, whole instalment count) actually run.
      const behaviour = await ensureBehaviour(mode)
      const { values, errors: fieldErrors, ok } = validateMode(mode, state)
      if (!ok) {
        setErrors((prev) => ({ ...prev, [mode]: fieldErrors }))
        setResults((prev) => ({ ...prev, [mode]: null }))
        return
      }
      setErrors((prev) => ({ ...prev, [mode]: {} }))

      const now = Date.now()
      const { display, snapshot } = runMode(
        behaviour,
        values,
        { monthlyInflationPercent, roundingStep, now, state },
        {
          t: translate,
          lang,
          unit,
          fmtMoney,
          fmtNumber,
          roundingStep,
          key: `${mode}:${Object.values(values).join(':')}:${now}`,
        },
      )

      setResults((prev) => ({ ...prev, [mode]: display }))
      lastComputed.current[mode] = { ...snapshot, unit }
      if (saveToHistory) {
        const { addHistoryEntry } = await import('../lib/db')
        await addHistoryEntry({ mode, inputs: snapshot.inputs, results: snapshot.results, unit, createdAt: now })
      }
    },
    [mode, states, translate, lang, unit, fmtMoney, fmtNumber, monthlyInflationPercent, roundingStep],
  )

  const addToBasket = useCallback(async () => {
    const snap = lastComputed.current[mode]
    if (!snap) return
    const { addBasketItem } = await import('../lib/db')
    await addBasketItem({ mode, inputs: snap.inputs, results: snap.results, unit: snap.unit, createdAt: Date.now() })
  }, [mode])

  // Auto-compute a shared link once (after the language is known), then clean the URL.
  useEffect(() => {
    if (!shared || sharedRan.current || !ready) return
    sharedRan.current = true
    if (Object.keys(shared.values).length > 0) void calculate(false)
    window.history.replaceState({}, '', import.meta.env.BASE_URL)
  }, [shared, ready, calculate])

  const shareUrl = useMemo(() => {
    const { values, ok } = validateMode(mode, states[mode])
    if (!ok) return null
    return `${window.location.origin}${import.meta.env.BASE_URL}${buildModeShareQuery({ mode, values, unit })}`
  }, [mode, states, unit])

  const modeOptions = useMemo(
    () => [
      { value: 'profit' as SegmentId, label: (<><IconPercent size={16} /> {t('modes.profit')}</>) },
      { value: 'sell' as SegmentId, label: (<><IconScale size={16} /> {t('modes.sell')}</>) },
      { value: 'discount' as SegmentId, label: (<><IconTag size={16} /> {t('modes.discount')}</>) },
    ],
    [t],
  )

  const profitKindOptions = useMemo(
    () => [
      { value: 'cash' as ProfitKind, label: (<><IconPercent size={14} /> {t('installment.cash')}</>) },
      { value: 'installments' as ProfitKind, label: (<><IconWallet size={14} /> {t('installment.installments')}</>) },
    ],
    [t],
  )

  const installmentDirectionOptions = useMemo(
    () => [
      { value: 'installment' as ModeId, label: t('installment.forward') },
      { value: 'rinstallment' as ModeId, label: t('installment.reverse') },
    ],
    [t],
  )

  const directionOptions = useMemo(
    () => [
      { value: 'discount' as ModeId, label: (<><IconTag size={14} /> {t('discountDirection.forward')}</>) },
      { value: 'rdiscount' as ModeId, label: (<><IconTagReverse size={14} /> {t('discountDirection.reverse')}</>) },
    ],
    [t],
  )

  const result = results[mode]
  const lensFields = visibleFields(mode, states[mode]).filter((field) => field.group === 'lens')

  return (
    <main className="flex flex-col gap-4">
      <SegmentedControl<SegmentId>
        layoutId="mode-segment"
        ariaLabel={t('results.title')}
        value={SEGMENTS[segmentIndex] as SegmentId}
        onChange={onSegmentChange}
        options={modeOptions}
      />

      <AnimatePresence initial={false}>
        {isProfitSegment && (
          <SubControl key="profit-kind" reducedMotion={!!reducedMotion}>
            <SegmentedControl<ProfitKind>
              layoutId="profit-kind"
              ariaLabel={t('modes.profit')}
              value={isInstallment ? 'installments' : 'cash'}
              onChange={onProfitKindChange}
              options={profitKindOptions}
              size="sm"
            />
          </SubControl>
        )}
        {isProfitSegment && isInstallment && (
          <SubControl key="installment-direction" reducedMotion={!!reducedMotion}>
            <SegmentedControl<ModeId>
              layoutId="installment-direction"
              ariaLabel={t('modes.installment')}
              value={mode}
              onChange={setMode}
              options={installmentDirectionOptions}
              size="sm"
            />
          </SubControl>
        )}
        {isDiscountSegment && (
          <SubControl key="discount-direction" reducedMotion={!!reducedMotion}>
            <SegmentedControl<ModeId>
              layoutId="discount-direction"
              ariaLabel={t('modes.discount')}
              value={mode}
              onChange={setMode}
              options={directionOptions}
              size="sm"
            />
          </SubControl>
        )}
      </AnimatePresence>

      {/* overflow-x is clipped here so the slide transition can never widen the page (mobile shake fix) */}
      <div className="relative -mx-5 overflow-x-clip px-5">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={mode}
            custom={direction}
            initial={reducedMotion ? false : { opacity: 0, x: 28 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -28 * direction }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex flex-col gap-4"
          >
            <ModeFields mode={mode} state={states[mode]} errors={errors[mode]} lang={lang} onChange={setField} />

            {lensFields.length > 0 && (
              <LensRow
                fields={lensFields}
                state={states[mode]}
                errors={errors[mode]}
                lang={lang}
                monthlyInflationPercent={monthlyInflationPercent}
                onChange={setField}
                onOpenInflationSetting={onOpenSettings}
              />
            )}

            <motion.button
              type="button"
              onClick={() => void calculate()}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {t('actions.calculate')}
            </motion.button>

            {result && (
              <Suspense fallback={null}>
                <ResultCard
                  result={result}
                  lang={lang}
                  unit={unit}
                  shareUrl={shareUrl}
                  onAddToBasket={addToBasket}
                  onSaveProduct={result.product ? () => onSaveProduct({ ...result.product!, unit }) : undefined}
                  onOpenSchedule={
                    result.schedule
                      ? () => {
                          setSchedule(result.schedule ?? null)
                          setScheduleOpen(true)
                        }
                      : undefined
                  }
                />
              </Suspense>
            )}

            {result?.product ? (
              <Suspense fallback={null}>
                {/* The calculator itself touches no database. If the product link cannot reach
                    one, it disappears — it must never take the result card with it. */}
                <ErrorBoundary label="the product link" fallback={() => null}>
                <CalcProductLink
                  cost={result.product.cost}
                  lang={lang}
                  unit={unit}
                  rates={rates}
                  onChanged={onProductsChanged}
                />
                </ErrorBoundary>
              </Suspense>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <Suspense fallback={null}>
        {(scheduleOpen || schedule !== null) && (
          <ScheduleSheet
            open={scheduleOpen}
            onClose={() => setScheduleOpen(false)}
            schedule={schedule}
            lang={lang}
            unit={unit}
          />
        )}
      </Suspense>
    </main>
  )
}

/** A sub-control that springs open under the segmented control without shifting the layout. */
function SubControl({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, height: 0, marginTop: -16 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

function asModeId(value: string | undefined): ModeId | null {
  return isModeId(value) ? value : null
}
