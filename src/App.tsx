import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { readMonthlyInflationPercent, storeMonthlyInflationPercent } from './lib/inflation'
import { TELEGRAM_URL } from './lib/links'
import { formatNumber, type AppLanguage } from './lib/numbers'
import { readRoundingStep, storeRoundingStep, type RoundingStep } from './lib/rounding'
import { parseModeShareQuery, parseTabQuery, type AppTab } from './lib/share'
import { resolveLastSeenVersion, shouldShowWhatsNew, storeLastSeenVersion } from './lib/update'
import { readStoredUnit, storeUnit, type Unit } from './lib/units'
import { emitTour } from './learn/coach/events'
import type { TourDestination } from './learn/coach/types'
import {
  LearnContext,
  hasOnboarded,
  parseLearnQuery,
  tipAllowed,
  type LearnApi,
  type LearnRequest,
} from './learn/ui/entry'
import { RepositoryContext, type RepositoryValue } from './learn/ui/repositoryContext'

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
/* The whole tutorial — the centre, onboarding, the coach, the sandbox, the progress store — is
 * behind this one boundary. A shopkeeper who never opens a lesson never downloads a byte of it. */
const LearnHost = lazy(() => import('./learn/ui/LearnHost').then((m) => ({ default: m.LearnHost })))

function hasStoredLanguage(): boolean {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY)
    return v === 'en' || v === 'fa'
  } catch {
    return true // storage unavailable — skip onboarding
  }
}

/**
 * What the tutorial was asked for on this load, decided once.
 *
 * `?learn` wins, because the user tapped a link or a home-screen shortcut on purpose. Otherwise
 * onboarding is offered only on a genuinely fresh install: `resolveLastSeenVersion()` is null only
 * when no Sooda key of any kind was left behind, which is exactly how an upgrading user is told
 * apart from a new one — they must never be shown a first-run flow for an app they already use.
 */
function initialLearnRequest(): LearnRequest | null {
  const query = parseLearnQuery(window.location.search)
  if (query !== null) return query === '' ? { kind: 'center' } : { kind: 'lesson', id: query }
  return resolveLastSeenVersion() === null && !hasOnboarded() ? { kind: 'onboarding' } : null
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
  const [monthlyInflationPercent, setMonthlyInflation] = useState<number>(readMonthlyInflationPercent)

  // A ?tab=products shortcut wins over whatever tab the draft remembered.
  /* The URL is the only source of truth for the tab: setTab replaceStates it, so it already
   * survives the reload a new service worker triggers. Restoring it from the draft as well
   * would let a saved 'products' tab swallow an incoming ?m=…&a=…&b=… calculation. */
  const [tab, setTabState] = useState<AppTab>(() => parseTabQuery(window.location.search) ?? 'calculator')

  /* ---- the tutorial ---- */

  const [learnRequest, setLearnRequest] = useState<LearnRequest | null>(initialLearnRequest)
  /* Non-null only while a lesson is running. Providing it swaps the repository every product and
   * observation write goes through, so practice cannot reach the shopkeeper's own data. */
  const [practice, setPractice] = useState<RepositoryValue | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  /* A step may ask for a mode before it runs; the calculator owns `mode`, so the request is passed
   * down and cleared once it has been applied. */
  const [requestedMode, setRequestedMode] = useState<string | null>(null)
  /* The products tab owns the detail and bulk sheets, so a step that asks for one is relayed
   * there rather than reached into. Cleared by the tab once it has acted. */
  const [tourSheet, setTourSheet] = useState<string | null>(null)

  const learnApi = useMemo<LearnApi>(
    () => ({
      open: (lesson) => setLearnRequest(lesson === undefined ? { kind: 'center' } : { kind: 'lesson', id: lesson }),
      tip: (id) => {
        // Cheap enough to ask on every use: one localStorage read and a JSON parse, no chunk.
        if (tipAllowed(id)) setTip(id)
      },
    }),
    [],
  )


  // The rates file and everything derived from it. Both hooks no-op until onboarding is done.
  const rates = useRates(!needsLang)
  /* Pointed at the demo shop during a lesson: `computeCheckIn` reads products and observations,
   * and left on the real source it would have the tutorial's check-in ask about — and judge the
   * learner against — the shopkeeper's own products. The badge stays off while a source is given. */
  const checkIn = useCheckIn(rates.rates, !needsLang, practice?.repository)

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
    /* `?learn` has been read into state by now, so it comes out of the address bar — left there,
     * every later reload (including the one a new service worker triggers) reopens the centre. */
    if (parseLearnQuery(window.location.search) !== null) {
      window.history.replaceState({}, '', import.meta.env.BASE_URL)
    }
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
    storeMonthlyInflationPercent(percent)
    setMonthlyInflation(readMonthlyInflationPercent())
  }, [])

  const setTab = useCallback((next: AppTab) => {
    setTabState(next)
    emitTour({ type: 'action', name: 'switch-tab' })
    // Keep the URL shareable and shortcut-addressable without adding history entries.
    const url = next === 'products' ? `${import.meta.env.BASE_URL}?tab=products` : import.meta.env.BASE_URL
    window.history.replaceState({}, '', url)
  }, [])

  const openSettings = useCallback(() => {
    setSettingsMounted(true)
    setSettingsOpen(true)
    emitTour({ type: 'sheet:open', sheet: 'settings' })
  }, [])

  /**
   * Puts the app where a lesson step needs it before that step runs — the coach's `navigate`.
   *
   * A step that names a sheet means that sheet on its own, so every other one is closed in the
   * same pass: left open, the last step's drawer would sit on top of the target this one points
   * at. The products tab owns two of the sheets itself and is told which one through `tourSheet`.
   */
  const navigateForTour = useCallback(async (to: TourDestination): Promise<void> => {
    if (to.tab !== undefined) setTab(to.tab)
    if (to.mode !== undefined) setRequestedMode(to.mode)
    if (to.sheet !== undefined) {
      const sheet = to.sheet
      if (sheet === 'history') setHistoryMounted(true)
      if (sheet === 'settings') setSettingsMounted(true)
      setHistoryOpen(sheet === 'history')
      setSettingsOpen(sheet === 'settings')
      /* Not the basket: it is reached by the header button, which is a target of its own. */
      setBasketOpen(false)
      setCheckInOpen(sheet === 'check-in')
      setProfileOpen(sheet === 'store-profile')
      setTourSheet(sheet)
    }
    /* Two frames: one for the state to land, one for the sheet to mount, so the target is
     * measurable when the coach looks. It retries a missing target anyway — this avoids the miss. */
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }, [setTab])

  const closeLearn = useCallback(() => setLearnRequest(null), [])
  const clearRequestedMode = useCallback(() => setRequestedMode(null), [])

  /* Leaving practice puts the real shop back, and with it the real badge: the check-in was reading
   * the demo store a moment ago, so the count on the app icon has to be recomputed from scratch. */
  const wasPractising = useRef(false)
  useEffect(() => {
    const practising = practice !== null
    if (wasPractising.current && !practising) checkIn.reload()
    wasPractising.current = practising
  }, [practice, checkIn])

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
          emitTour({ type: 'sheet:open', sheet: 'basket' })
        },
        tour: 'btn-basket-open',
      },
      {
        key: 'history',
        label: t('history.open'),
        icon: <IconClock />,
        badge: 0,
        onClick: () => {
          setHistoryMounted(true)
          setHistoryOpen(true)
          emitTour({ type: 'sheet:open', sheet: 'history' })
        },
      },
      {
        key: 'settings',
        label: t('settings.open'),
        icon: <IconGear />,
        badge: 0,
        onClick: openSettings,
        tour: 'btn-settings',
      },
    ],
    [t, basketCount, openSettings],
  )

  return (
    /* The repository every product and observation write goes through. `practice` is non-null only
     * while a lesson is running, and swapping it here is what keeps the demo shop off the
     * shopkeeper's own data — see the plan's repository-injection rule. */
    <RepositoryContext.Provider value={practice}>
    <LearnContext.Provider value={learnApi}>
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-28 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AmbientBackground />

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{t('app.name')}</h1>
          <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{t('app.tagline')}</p>
        </div>
        <div className="mt-1 flex gap-1.5">
          {headerButtons.map((button) => (
            <HeaderButton key={button.key} onClick={button.onClick} label={button.label} tour={button.tour}>
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
          /* Remounted when practice starts or ends: a calculator carrying the shopkeeper's typed
           * figures into a lesson — or the lesson's figures back out — would be the tutorial
           * leaking in the one direction the sandbox cannot police. */
          key={practice === null ? 'real' : 'practice'}
          lang={lang}
          unit={unit}
          ready={!needsLang}
          practiceDb={practice?.db ?? null}
          requestedMode={requestedMode}
          onModeApplied={clearRequestedMode}
          /* A lesson pins both, so its figures cannot move when a maintainer updates a CPI
           * number or the shopkeeper has rounding switched off. Neither is ever stored. */
          monthlyInflationPercent={practice?.pinned?.monthlyInflationPercent ?? monthlyInflationPercent}
          roundingStep={practice?.pinned?.roundingStep ?? roundingStep}
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
            tourSheet={tourSheet}
            onTourSheetHandled={() => setTourSheet(null)}
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
          <HistorySheet
            open={historyOpen}
            onClose={() => {
              setHistoryOpen(false)
              emitTour({ type: 'sheet:close', sheet: 'history' })
            }}
            lang={lang}
          />
        )}
        {(basketOpen || basketMounted) && (
          <BasketSheet
            open={basketOpen}
            onClose={() => {
              setBasketOpen(false)
              emitTour({ type: 'sheet:close', sheet: 'basket' })
            }}
            lang={lang}
          />
        )}
        {(settingsOpen || settingsMounted) && (
          <SettingsSheet
            open={settingsOpen}
            onClose={() => {
              setSettingsOpen(false)
              emitTour({ type: 'sheet:close', sheet: 'settings' })
            }}
            lang={lang}
            onLanguageChange={(l) => void setLanguage(l)}
            themePreference={preference}
            onThemeChange={setPreference}
            unit={unit}
            onUnitChange={setUnit}
            roundingStep={roundingStep}
            onRoundingChange={setRoundingStep}
            monthlyInflationPercent={monthlyInflationPercent}
            onInflationChange={onInflationChange}
            onOpenStoreProfile={() => {
              setSettingsOpen(false)
              setProfileOpen(true)
            }}
            onAutoUpdateChange={rates.refresh}
            install={install}
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

      {/* Held back until the language is known: the very first screen is the language choice, and
        * onboarding written in the wrong one would be a worse welcome than none. */}
      {!needsLang && (learnRequest !== null || tip !== null) ? (
        <Suspense fallback={null}>
          <FeatureBoundary label="the tutorial">
            <LearnHost
              request={learnRequest}
              onPractice={setPractice}
              navigate={navigateForTour}
              tip={tip}
              onTipDismiss={() => setTip(null)}
              onClose={closeLearn}
            />
          </FeatureBoundary>
        </Suspense>
      ) : null}
    </div>
    </LearnContext.Provider>
    </RepositoryContext.Provider>
  )
}

function HeaderButton({
  onClick,
  label,
  tour,
  children,
}: {
  onClick: () => void
  label: string
  /** The `data-tour` name from `src/learn/lessons/targets.ts`, when a lesson points at it. */
  tour?: string | undefined
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.button
      type="button"
      data-tour={tour}
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
