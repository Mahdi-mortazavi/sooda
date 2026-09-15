import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ValidationError } from '../lib/calc'
import { vibrate } from '../lib/haptics'
import { readAnnualInflationPercent } from '../lib/inflation'
import {
  SEGMENTS,
  defaultModeOfSegment,
  emptyStates,
  perMode,
  runMode,
  segmentIndexOf,
  validateMode,
} from '../lib/modes/registry'
import type { ModeId, ModeState, ResultDisplay, SegmentId, Translate } from '../lib/modes/types'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { readRoundingStep } from '../lib/rounding'
import { buildModeShareQuery, parseModeShareQuery } from '../lib/share'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconPercent, IconScale, IconTag, IconTagReverse } from './Icons'
import { ModeFields } from './ModeFields'
import { ResultCard } from './ResultCard'
import { SegmentedControl } from './SegmentedControl'

interface Snapshot {
  inputs: number[]
  results: number[]
  unit: Unit
}

interface CalculatorViewProps {
  lang: AppLanguage
  unit: Unit
  /** Onboarding is finished — safe to auto-run a shared link. */
  ready: boolean
}

export function CalculatorView({ lang, unit, ready }: CalculatorViewProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()

  // A shared calculation link pre-fills and auto-computes; mode-only links
  // (?m=profit) from PWA shortcuts just open the right calculator.
  const shared = useMemo(() => parseModeShareQuery(window.location.search), [])
  const sharedRan = useRef(false)

  const [mode, setMode] = useState<ModeId>(shared?.mode ?? 'profit')
  const [prevSegment, setPrevSegment] = useState(() => segmentIndexOf(shared?.mode ?? 'profit'))
  const [states, setStates] = useState<Record<ModeId, ModeState>>(() => {
    const initial = emptyStates()
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

  const rtl = lang === 'fa'
  const segmentIndex = segmentIndexOf(mode)
  // Slide direction: +1 when moving toward the next segment, mirrored for RTL.
  const direction = (segmentIndex >= prevSegment ? 1 : -1) * (rtl ? -1 : 1)
  const isDiscountSegment = segmentIndex === 2

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
      setStates((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: value } }))
      setErrors((prev) => {
        if (!prev[mode][key]) return prev
        const next = { ...prev[mode] }
        delete next[key]
        return { ...prev, [mode]: next }
      })
    },
    [mode],
  )

  const translate = useCallback<Translate>((key, vars) => t(key, vars ?? {}), [t])
  const fmtMoney = useCallback((value: number) => formatAmountWithUnit(value, lang, unit), [lang, unit])
  const fmtNumber = useCallback((value: number) => formatNumber(value, lang), [lang])

  const calculate = useCallback(
    async (saveToHistory = true) => {
      vibrate()
      const { values, errors: fieldErrors, ok } = validateMode(mode, states[mode])
      if (!ok) {
        setErrors((prev) => ({ ...prev, [mode]: fieldErrors }))
        setResults((prev) => ({ ...prev, [mode]: null }))
        return
      }
      setErrors((prev) => ({ ...prev, [mode]: {} }))

      const roundingStep = readRoundingStep()
      const { display, snapshot } = runMode(
        mode,
        values,
        { annualInflationPercent: readAnnualInflationPercent(), roundingStep, now: Date.now() },
        {
          t: translate,
          lang,
          unit,
          fmtMoney,
          fmtNumber,
          roundingStep,
          key: `${mode}:${Object.values(values).join(':')}:${Date.now()}`,
        },
      )

      setResults((prev) => ({ ...prev, [mode]: display }))
      lastComputed.current[mode] = { ...snapshot, unit }
      if (saveToHistory) {
        const { addHistoryEntry } = await import('../lib/db')
        await addHistoryEntry({ mode, inputs: snapshot.inputs, results: snapshot.results, unit, createdAt: Date.now() })
      }
    },
    [mode, states, translate, lang, unit, fmtMoney, fmtNumber],
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

  const directionOptions = useMemo(
    () => [
      { value: 'discount' as ModeId, label: (<><IconTag size={14} /> {t('discountDirection.forward')}</>) },
      { value: 'rdiscount' as ModeId, label: (<><IconTagReverse size={14} /> {t('discountDirection.reverse')}</>) },
    ],
    [t],
  )

  const result = results[mode]

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
        {isDiscountSegment && (
          <motion.div
            key="discount-direction"
            initial={reducedMotion ? false : { opacity: 0, height: 0, marginTop: -16 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: -16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 36 }}
            className="overflow-hidden"
          >
            <SegmentedControl<ModeId>
              layoutId="discount-direction"
              ariaLabel={t('modes.discount')}
              value={mode}
              onChange={setMode}
              options={directionOptions}
              size="sm"
            />
          </motion.div>
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
              <ResultCard result={result} lang={lang} unit={unit} shareUrl={shareUrl} onAddToBasket={addToBasket} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  )
}
