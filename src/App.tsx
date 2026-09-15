import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { lazy, Suspense, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AmbientBackground } from './components/AmbientBackground'
import { CalculatorView } from './components/CalculatorView'
import { IconBasket, IconClock, IconGear, IconMoon, IconSun } from './components/Icons'
import { InstallPrompt } from './components/InstallPrompt'
import { WelcomeLanguage } from './components/WelcomeLanguage'
import { useBasketCount } from './hooks/useBasketCount'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useTheme } from './hooks/useTheme'
import { LANG_STORAGE_KEY, setLanguage } from './i18n'
import { vibrate } from './lib/haptics'
import { TELEGRAM_URL } from './lib/links'
import { formatNumber, type AppLanguage } from './lib/numbers'
import { readStoredUnit, storeUnit, type Unit } from './lib/units'

// Sheets (and Dexie behind them) load on demand to keep the initial bundle lean.
const HistorySheet = lazy(() => import('./components/HistorySheet').then((m) => ({ default: m.HistorySheet })))
const SettingsSheet = lazy(() => import('./components/SettingsSheet').then((m) => ({ default: m.SettingsSheet })))
const BasketSheet = lazy(() => import('./components/BasketSheet').then((m) => ({ default: m.BasketSheet })))

function hasStoredLanguage(): boolean {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY)
    return v === 'en' || v === 'fa'
  } catch {
    return true // storage unavailable — skip onboarding
  }
}

export default function App() {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language.startsWith('fa') ? 'fa' : 'en') as AppLanguage
  const { preference, isDark, setPreference, toggle } = useTheme()
  const reducedMotion = useReducedMotion()
  const install = useInstallPrompt()
  const basketCount = useBasketCount()

  const [needsLang, setNeedsLang] = useState(() => !hasStoredLanguage())
  const [unit, setUnitState] = useState<Unit>(readStoredUnit)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)
  // Once a sheet has been opened we keep it mounted so its exit animation can play.
  const [historyMounted, setHistoryMounted] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [basketMounted, setBasketMounted] = useState(false)

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u)
    storeUnit(u)
  }, [])

  const chooseLanguage = (l: AppLanguage) => {
    void setLanguage(l)
    setNeedsLang(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AmbientBackground />

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{t('app.name')}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{t('app.tagline')}</p>
        </div>
        <div className="mt-1 flex gap-1.5">
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
              setBasketMounted(true)
              setBasketOpen(true)
            }}
            label={t('basket.open')}
          >
            <IconBasket />
            {basketCount > 0 && (
              <span
                aria-hidden
                className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent-fill-strong)] px-1 text-[11px] font-bold leading-none text-white dark:text-[hsl(168_90%_8%)]"
              >
                {formatNumber(basketCount, lang, 0)}
              </span>
            )}
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

      <CalculatorView lang={lang} unit={unit} ready={!needsLang} />

      <footer className="mt-auto pb-2 pt-10 text-center">
        <p className="text-[12px] text-[var(--text-tertiary)]">{t('settings.privacy')}</p>
        <div className="mt-4 flex items-center justify-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}avatar-mahdi.png`}
            alt={t('dev.name')}
            width={28}
            height={28}
            loading="lazy"
            className="h-7 w-7 rounded-full object-cover ring-1 ring-[var(--separator)]"
          />
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {t('dev.craftedBy')}{' '}
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-[var(--accent-text)] underline-offset-2 hover:underline"
            >
              {t('dev.name')}
            </a>
          </span>
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)]">{t('dev.blessing')}</p>
      </footer>

      <Suspense fallback={null}>
        {(historyOpen || historyMounted) && (
          <HistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} lang={lang} />
        )}
        {(basketOpen || basketMounted) && (
          <BasketSheet open={basketOpen} onClose={() => setBasketOpen(false)} lang={lang} />
        )}
        {(settingsOpen || settingsMounted) && (
          <SettingsSheet
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            lang={lang}
            onLanguageChange={(l) => void setLanguage(l)}
            themePreference={preference}
            onThemeChange={setPreference}
            unit={unit}
            onUnitChange={setUnit}
          />
        )}
      </Suspense>

      <WelcomeLanguage open={needsLang} onChoose={chooseLanguage} />
      <InstallPrompt state={install} ready={!needsLang} />
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
      className="glass glass-ring relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-primary)]"
    >
      {children}
    </motion.button>
  )
}
