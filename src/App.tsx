import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AmbientBackground } from './components/AmbientBackground'
import { IconClock, IconGear, IconMoon, IconPercent, IconScale, IconSun, IconTag } from './components/Icons'
import { NumberField } from './components/NumberField'
import { ResultCard, type ResultDisplay } from './components/ResultCard'
import { SegmentedControl } from './components/SegmentedControl'

// Sheets (and Dexie behind them) load on demand to keep the initial bundle lean.
const HistorySheet = lazy(() => import('./components/HistorySheet').then((m) => ({ default: m.HistorySheet })))
const SettingsSheet = lazy(() => import('./components/SettingsSheet').then((m) => ({ default: m.SettingsSheet })))
import { useTheme } from './hooks/useTheme'
import { setLanguage } from './i18n'
import {
  MODE_RULES,
  MODES,
  calcDiscount,
  calcFromProfitPercent,
  calcFromSellingPrice,
  validateValue,
  type Mode,
  type ValidationError,
} from './lib/calc'
import { vibrate } from './lib/haptics'
import { MODE_FIELD_KEYS } from './lib/modes'
import { formatNumber, parseAmount, type AppLanguage } from './lib/numbers'

type FieldErrors = [ValidationError | null, ValidationError | null]

const EMPTY_INPUTS: Record<Mode, [string, string]> = {
  profit: ['', ''],
  sell: ['', ''],
  discount: ['', ''],
}

export default function App() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language.startsWith('fa') ? 'fa' : 'en') as AppLanguage
  const { preference, isDark, setPreference, toggle } = useTheme()
  const reducedMotion = useReducedMotion()

  const [mode, setMode] = useState<Mode>('profit')
  const [prevModeIndex, setPrevModeIndex] = useState(0)
  const [inputs, setInputs] = useState(EMPTY_INPUTS)
  const [errors, setErrors] = useState<Record<Mode, FieldErrors>>({
    profit: [null, null],
    sell: [null, null],
    discount: [null, null],
  })
  const [results, setResults] = useState<Record<Mode, ResultDisplay | null>>({
    profit: null,
    sell: null,
    discount: null,
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Once a sheet has been opened we keep it mounted so its exit animation can play.
  const [historyMounted, setHistoryMounted] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)

  const modeIndex = MODES.indexOf(mode)
  const rtl = lang === 'fa'
  // Slide direction: +1 when moving toward the next segment, mirrored for RTL.
  const direction = (modeIndex >= prevModeIndex ? 1 : -1) * (rtl ? -1 : 1)

  const onModeChange = useCallback(
    (next: Mode) => {
      setPrevModeIndex(MODES.indexOf(mode))
      setMode(next)
    },
    [mode],
  )

  const setInput = (index: 0 | 1, value: string) => {
    setInputs((prev) => {
      const next: [string, string] = [...prev[mode]]
      next[index] = value
      return { ...prev, [mode]: next }
    })
    setErrors((prev) =>
      prev[mode][index] ? { ...prev, [mode]: index === 0 ? [null, prev[mode][1]] : [prev[mode][0], null] } : prev,
    )
  }

  const pct = t('fields.percentUnit')
  const fmt = useCallback((v: number) => formatNumber(v, lang), [lang])

  const calculate = useCallback(async () => {
    vibrate()
    const [rawA, rawB] = inputs[mode]
    const a = parseAmount(rawA)
    const b = parseAmount(rawB)
    const [ruleA, ruleB] = MODE_RULES[mode]
    const errA = validateValue(a, ruleA, rawA.trim() === '')
    const errB = validateValue(b, ruleB, rawB.trim() === '')
    if (errA || errB) {
      setErrors((prev) => ({ ...prev, [mode]: [errA, errB] }))
      setResults((prev) => ({ ...prev, [mode]: null }))
      return
    }
    setErrors((prev) => ({ ...prev, [mode]: [null, null] }))

    let display: ResultDisplay
    let stored: [number, number]
    if (mode === 'profit') {
      const r = calcFromProfitPercent(a, b)
      stored = [r.sellingPrice, r.profitAmount]
      display = {
        key: `${mode}:${a}:${b}:${Date.now()}`,
        primaryLabel: t('results.sellingPrice'),
        primaryValue: r.sellingPrice,
        secondaryLabel: t('results.profitAmount'),
        secondaryValue: r.profitAmount,
        isLoss: false,
        copyText: `${t('results.sellingPrice')}: ${fmt(r.sellingPrice)} — ${t('results.profitAmount')}: ${fmt(r.profitAmount)}`,
      }
    } else if (mode === 'sell') {
      const r = calcFromSellingPrice(a, b)
      stored = [r.profitPercent, r.profitAmount]
      const pctLabel = r.isLoss ? t('results.lossPercent') : t('results.profitPercent')
      const amtLabel = r.isLoss ? t('results.lossAmount') : t('results.profitAmount')
      display = {
        key: `${mode}:${a}:${b}:${Date.now()}`,
        primaryLabel: pctLabel,
        primaryValue: r.profitPercent,
        primaryUnit: pct,
        secondaryLabel: amtLabel,
        secondaryValue: r.profitAmount,
        isLoss: r.isLoss,
        notice: r.isLoss ? t('results.lossNotice') : r.profitAmount === 0 ? t('results.breakEven') : undefined,
        copyText: `${pctLabel}: ${fmt(r.profitPercent)}${pct} — ${amtLabel}: ${fmt(r.profitAmount)}`,
      }
    } else {
      const r = calcDiscount(a, b)
      stored = [r.finalPrice, r.savedAmount]
      display = {
        key: `${mode}:${a}:${b}:${Date.now()}`,
        primaryLabel: t('results.finalPrice'),
        primaryValue: r.finalPrice,
        secondaryLabel: t('results.savedAmount'),
        secondaryValue: r.savedAmount,
        isLoss: false,
        copyText: `${t('results.finalPrice')}: ${fmt(r.finalPrice)} — ${t('results.savedAmount')}: ${fmt(r.savedAmount)}`,
      }
    }

    setResults((prev) => ({ ...prev, [mode]: display }))
    const { addHistoryEntry } = await import('./lib/db')
    await addHistoryEntry({ mode, inputs: [a, b], results: stored, createdAt: Date.now() })
  }, [inputs, mode, t, fmt, pct])

  const fieldError = (index: 0 | 1): string | null => {
    const err = errors[mode][index]
    return err ? t(`errors.${err}`) : null
  }

  const [fieldKeyA, fieldKeyB] = MODE_FIELD_KEYS[mode]
  const isPercentB = mode !== 'sell'
  const result = results[mode]

  const modeOptions = useMemo(
    () => [
      {
        value: 'profit' as Mode,
        label: (
          <>
            <IconPercent size={16} /> {t('modes.profit')}
          </>
        ),
      },
      {
        value: 'sell' as Mode,
        label: (
          <>
            <IconScale size={16} /> {t('modes.sell')}
          </>
        ),
      },
      {
        value: 'discount' as Mode,
        label: (
          <>
            <IconTag size={16} /> {t('modes.discount')}
          </>
        ),
      },
    ],
    [t],
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AmbientBackground />

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{t('app.name')}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{t('app.tagline')}</p>
        </div>
        <div className="mt-1 flex gap-2.5">
          <HeaderButton onClick={toggle} label={t('settings.toggleTheme')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isDark ? 'moon' : 'sun'}
                initial={reducedMotion ? false : { rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="flex"
              >
                {isDark ? <IconMoon /> : <IconSun />}
              </motion.span>
            </AnimatePresence>
          </HeaderButton>
          <HeaderButton
            onClick={() => {
              setHistoryMounted(true)
              setHistoryOpen(true)
            }}
            label={t('history.open')}
          >
            <IconClock />
          </HeaderButton>
          <HeaderButton
            onClick={() => {
              setSettingsMounted(true)
              setSettingsOpen(true)
            }}
            label={t('settings.open')}
          >
            <IconGear />
          </HeaderButton>
        </div>
      </header>

      <main className="flex flex-col gap-4">
        <SegmentedControl<Mode>
          layoutId="mode-segment"
          ariaLabel={t('results.title')}
          value={mode}
          onChange={onModeChange}
          options={modeOptions}
        />

        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={mode}
            custom={direction}
            initial={reducedMotion ? false : { opacity: 0, x: 36 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -36 * direction }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="flex flex-col gap-4"
          >
            <div className="glass glass-ring rounded-3xl">
              <NumberField
                id={`${mode}-a`}
                label={t(fieldKeyA)}
                value={inputs[mode][0]}
                onChange={(v) => setInput(0, v)}
                placeholder={t('fields.amountPlaceholder')}
                error={fieldError(0)}
              />
              <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
              <NumberField
                id={`${mode}-b`}
                label={t(fieldKeyB)}
                value={inputs[mode][1]}
                onChange={(v) => setInput(1, v)}
                placeholder={isPercentB ? t('fields.percentPlaceholder') : t('fields.amountPlaceholder')}
                unit={isPercentB ? pct : undefined}
                error={fieldError(1)}
              />
            </div>

            <motion.button
              type="button"
              onClick={() => void calculate()}
              whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-full rounded-full bg-[var(--accent-fill-strong)] py-4 text-[17px] font-bold text-white shadow-[0_10px_30px_-6px_hsl(165_80%_30%/0.55),inset_0_1px_0_rgba(255,255,255,0.25)] dark:text-[hsl(168_90%_8%)] dark:shadow-[0_10px_34px_-6px_hsl(165_85%_45%/0.4),inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              {t('actions.calculate')}
            </motion.button>

            {result && <ResultCard result={result} lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto pt-10 text-center text-[12px] text-[var(--text-tertiary)]">
        <p>{t('settings.privacy')}</p>
      </footer>

      <Suspense fallback={null}>
        {(historyOpen || historyMounted) && (
          <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} lang={lang} />
        )}
        {(settingsOpen || settingsMounted) && (
          <SettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            lang={lang}
            onLanguageChange={(l) => void setLanguage(l)}
            themePreference={preference}
            onThemeChange={setPreference}
          />
        )}
      </Suspense>
    </div>
  )
}

function HeaderButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={() => {
        vibrate()
        onClick()
      }}
      whileTap={reducedMotion ? undefined : { scale: 0.9 }}
      aria-label={label}
      title={label}
      className="glass glass-ring flex h-11 w-11 items-center justify-center rounded-full text-[var(--text-primary)]"
    >
      {children}
    </motion.button>
  )
}
