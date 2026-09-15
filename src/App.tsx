import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AmbientBackground } from './components/AmbientBackground'
import { CalculatorView } from './components/CalculatorView'
import { IconBasket, IconClock, IconGear } from './components/Icons'
import { FeatureBoundary } from './components/StorageBoundary'
import type { ProductDraft } from './components/SaveProductSheet'
import { TabBar } from './components/TabBar'
import { useBasketCount } from './hooks/useBasketCount'
import { useCheckIn } from './hooks/useCheckIn'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useRates } from './hooks/useRates'
import { useTheme } from './hooks/useTheme'
import { LANG_STORAGE_KEY, setLanguage } from './i18n'
import { vibrate } from './lib/haptics'
import { readAnnualInflationPercent, storeAnnualInflationPercent } from './lib/inflation'
import { TELEGRAM_URL } from './lib/links'
import { formatNumber, type AppLanguage } from './lib/numbers'
import { readRoundingStep, storeRoundingStep, type RoundingStep } from './lib/rounding'
import { parseModeShareQuery, parseTabQuery, type AppTab } from './lib/share'
import { resolveLastSeenVersion, shouldShowWhatsNew, storeLastSeenVersion } from './lib/update'
import { readStoredUnit, storeUnit, type Unit } from './lib/units'

declare const __APP_VERSION__: string

// Sheets, the products tab and Dexie behind them load on demand to keep the initial bundle lean.
const HistorySheet = lazy(() => import('./components/HistorySheet').then((m) => ({ default: m.HistorySheet })))
const SettingsSheet = lazy(() => import('./components/SettingsSheet').then((m) => ({ default: m.SettingsSheet })))
const BasketSheet = lazy(() => import('./components/BasketSheet').then((m) => ({ default: m.BasketSheet })))
const ProductsView = lazy(() => import('./components/ProductsView').then((m) => ({ default: m.ProductsView })))
const WhatsNewSheet = lazy(() => import('./components/WhatsNewSheet').then((m) => ({ default: m.WhatsNewSheet })))
const SaveProductSheet = lazy(() =>
  import('./components/SaveProductSheet').then((m) => ({ default: m.SaveProductSheet })),
)
const Toast = lazy(() => import('./components/Toast').then((m) => ({ default: m.Toast })))
// Onboarding runs once and the install banner waits a couple of seconds either way,
// so neither belongs in the bytes that decide first paint.
const WelcomeLanguage = lazy(() =>
  import('./components/WelcomeLanguage').then((m) => ({ default: m.WelcomeLanguage })),
)
const InstallPrompt = lazy(() => import('./components/InstallPrompt').then((m) => ({ default: m.InstallPrompt })))
// The check-in and store-setup sheets, and the writes behind them, load only once one is opened.
const ShopSheets = lazy(() => import('./components/ShopSheets').then((m) => ({ default: m.ShopSheets })))

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
  const { preference, setPreference } = useTheme()
  const install = useInstallPrompt()
  const basketCount = useBasketCount()

  const [needsLang, setNeedsLang] = useState(() => !hasStoredLanguage())
  // A shared link carries the sender's currency; showing their Toman figure in the
  // recipient's Rial would be a tenfold error, so the link wins over the stored unit.
  const sharedUnit = useMemo(() => parseModeShareQuery(window.location.search)?.unit ?? 'none', [])
  const [unit, setUnitState] = useState<Unit>(() => (sharedUnit !== 'none' ? sharedUnit : readStoredUnit()))
  const [roundingStep, setRoundingStepState] = useState<RoundingStep>(readRoundingStep)
  const [annualInflationPercent, setAnnualInflation] = useState<number>(readAnnualInflationPercent)

  // A ?tab=products shortcut wins over whatever tab the draft remembered.
  /* The URL is the only source of truth for the tab: setTab replaceStates it, so it already
   * survives the reload a new service worker triggers. Restoring it from the draft as well
   * would let a saved 'products' tab swallow an incoming ?m=…&a=…&b=… calculation. */
  const [tab, setTabState] = useState<AppTab>(() => parseTabQuery(window.location.search) ?? 'calculator')

  // The rates file and everything derived from it. Both hooks no-op until onboarding is done.
  const rates = useRates(!needsLang)
  const checkIn = useCheckIn(rates.rates, !needsLang)

  const [checkInOpen, setCheckInOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  /* Products the check-in found had gone UP, handed to the products tab so its bulk sheet
   * opens preselected. Cleared as soon as that tab has taken them. */
  const [repriceIds, setRepriceIds] = useState<number[] | null>(null)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [basketOpen, setBasketOpen] = useState(false)
  // Once a sheet has been opened we keep it mounted so its exit animation can play.
  const [historyMounted, setHistoryMounted] = useState(false)
  const [settingsMounted, setSettingsMounted] = useState(false)
  const [basketMounted, setBasketMounted] = useState(false)

  // Hold the install banner's chunk back until the first screen has settled.
  const [installReady, setInstallReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setInstallReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  const [saveDraft, setSaveDraft] = useState<ProductDraft | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  // Kept mounted after the first toast so its slide-out can play.
  const [toastMounted, setToastMounted] = useState(false)

  // A v1.2.0 install has no stored version, so it is inferred from the keys it did leave behind.
  const [whatsNewOpen, setWhatsNewOpen] = useState(() =>
    shouldShowWhatsNew(__APP_VERSION__, resolveLastSeenVersion()),
  )
  useEffect(() => {
    storeLastSeenVersion(__APP_VERSION__)
  }, [])

  const setUnit = useCallback((u: Unit) => {
    setUnitState(u)
    storeUnit(u)
  }, [])

  const setRoundingStep = useCallback((step: RoundingStep) => {
    setRoundingStepState(step)
    storeRoundingStep(step)
  }, [])

  const onInflationChange = useCallback((percent: number | null) => {
    // Storage first: Settings reads hasInflationOverride() during render.
    storeAnnualInflationPercent(percent)
    setAnnualInflation(readAnnualInflationPercent())
  }, [])

  const setTab = useCallback((next: AppTab) => {
    setTabState(next)
    // Keep the URL shareable and shortcut-addressable without adding history entries.
    const url = next === 'products' ? `${import.meta.env.BASE_URL}?tab=products` : import.meta.env.BASE_URL
    window.history.replaceState({}, '', url)
  }, [])

  const openSettings = useCallback(() => {
    setSettingsMounted(true)
    setSettingsOpen(true)
  }, [])

  const onSaveProduct = useCallback((draft: ProductDraft) => {
    setSaveDraft(draft)
    setSaveOpen(true)
  }, [])

  /* Setup is never asked at launch — it is asked the first time the answer would actually
   * change a number on screen, which is the first visit to the products tab with something
   * saved in it. A shop with no products yet has nothing the answer could improve. */
  useEffect(() => {
    if (tab !== 'products' || checkIn.hasProfile !== false || checkIn.productCount === 0) return
    setProfileOpen(true)
  }, [tab, checkIn.hasProfile, checkIn.productCount])

  const chooseLanguage = (l: AppLanguage) => {
    void setLanguage(l)
    setNeedsLang(false)
  }

  const headerButtons = useMemo(
    () => [
      {
        key: 'basket',
        label: t('basket.open'),
        icon: <IconBasket />,
        badge: basketCount,
        onClick: () => {
          setBasketMounted(true)
          setBasketOpen(true)
        },
      },
      {
        key: 'history',
        label: t('history.open'),
        icon: <IconClock />,
        badge: 0,
        onClick: () => {
          setHistoryMounted(true)
          setHistoryOpen(true)
        },
      },
      { key: 'settings', label: t('settings.open'), icon: <IconGear />, badge: 0, onClick: openSettings },
    ],
    [t, basketCount, openSettings],
  )

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AmbientBackground />

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{t('app.name')}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{t('app.tagline')}</p>
        </div>
        <div className="mt-1 flex gap-1.5">
          {headerButtons.map((button) => (
            <HeaderButton key={button.key} onClick={button.onClick} label={button.label}>
              {button.icon}
              {button.badge > 0 && (
                <span
                  aria-hidden
                  className="absolute -end-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent-fill-strong)] px-1 text-[11px] font-bold leading-none text-white dark:text-[hsl(168_90%_8%)]"
                >
                  {formatNumber(button.badge, lang, 0)}
                </span>
              )}
            </HeaderButton>
          ))}
        </div>
      </header>

      {tab === 'calculator' ? (
        <CalculatorView
          lang={lang}
          unit={unit}
          ready={!needsLang}
          annualInflationPercent={annualInflationPercent}
          roundingStep={roundingStep}
          onOpenSettings={openSettings}
          onSaveProduct={onSaveProduct}
          rates={rates.rates}
          onProductsChanged={checkIn.reload}
          tab={tab}
        />
      ) : (
        <Suspense fallback={null}>
          <FeatureBoundary label="the products tab">
          <ProductsView
            lang={lang}
            unit={unit}
            onGoToCalculator={() => setTab('calculator')}
            rates={rates.rates}
            profile={checkIn.profile}
            checkInCount={checkIn.items.length}
            onStartCheckIn={() => setCheckInOpen(true)}
            repriceIds={repriceIds}
            onRepriceConsumed={() => setRepriceIds(null)}
            onProductsChanged={checkIn.reload}
          />
          </FeatureBoundary>
        </Suspense>
      )}

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
        <FeatureBoundary label="a sheet">
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
            roundingStep={roundingStep}
            onRoundingChange={setRoundingStep}
            annualInflationPercent={annualInflationPercent}
            onInflationChange={onInflationChange}
            onOpenStoreProfile={() => {
              setSettingsOpen(false)
              setProfileOpen(true)
            }}
            onAutoUpdateChange={rates.refresh}
            ratesUpdatedAt={rates.rates?.updatedAt ?? null}
            ratesOrigin={rates.origin}
          />
        )}
        {saveOpen && (
          <SaveProductSheet
            open={saveOpen}
            onClose={() => setSaveOpen(false)}
            draft={saveDraft}
            lang={lang}
            onSaved={() => {
              setToastMounted(true)
              setSavedToast(true)
            }}
          />
        )}
        {whatsNewOpen && !needsLang && (
          <WhatsNewSheet open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} version={__APP_VERSION__} />
        )}

        {(checkInOpen || profileOpen) && (
          <ShopSheets
            checkInOpen={checkInOpen}
            onCloseCheckIn={() => setCheckInOpen(false)}
            profileOpen={profileOpen}
            onCloseProfile={() => setProfileOpen(false)}
            items={checkIn.items}
            now={checkIn.now}
            profile={checkIn.profile}
            lang={lang}
            unit={unit}
            onChanged={checkIn.reload}
            onReprice={(ids) => {
              setCheckInOpen(false)
              setRepriceIds(ids)
              setTab('products')
            }}
          />
        )}

        {toastMounted && (
          <Toast open={savedToast} message={t('products.saved')} onDismiss={() => setSavedToast(false)} />
        )}
        </FeatureBoundary>
      </Suspense>

      <TabBar value={tab} onChange={setTab} />

      <Suspense fallback={null}>
        {needsLang && <WelcomeLanguage open={needsLang} onChoose={chooseLanguage} />}
        {installReady && <InstallPrompt state={install} ready={!needsLang} />}
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
      className="glass glass-ring relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-primary)]"
    >
      {children}
    </motion.button>
  )
}
