import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { ThemePreference } from '../hooks/useTheme'
import { applyBackup, backupFilename, buildBackup, validateBackup, type BackupFile } from '../lib/backup'
import { formatDate } from '../lib/dates'
import { clearHistory } from '../lib/db'
import { vibrate } from '../lib/haptics'
import { INFLATION_DEFAULT, hasInflationOverride, inflationSourceLabel } from '../lib/inflation'
import { formatNumber, parseAmount, type AppLanguage } from '../lib/numbers'
import { ROUNDING_STEPS, type RoundingStep } from '../lib/rounding'
import { GITHUB_URL, TELEGRAM_URL } from '../lib/links'
import { UNITS, unitShortLabel, type Unit } from '../lib/units'
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconGitHub,
  IconMoon,
  IconSparkle,
  IconSun,
  IconTelegram,
  IconTrash,
  IconUpload,
} from './Icons'
import { NumberField } from './NumberField'
import { SegmentedControl } from './SegmentedControl'
import { Sheet } from './Sheet'

declare const __APP_VERSION__: string

/* Same shape as downloadCsv in lib/csv.ts, which hard-codes the CSV mime type. */
function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  lang: AppLanguage
  onLanguageChange: (lang: AppLanguage) => void
  themePreference: ThemePreference
  onThemeChange: (pref: ThemePreference) => void
  unit: Unit
  onUnitChange: (unit: Unit) => void
  roundingStep: RoundingStep
  onRoundingChange: (step: RoundingStep) => void
  annualInflationPercent: number
  /** null resets to the bundled default. */
  onInflationChange: (percent: number | null) => void
}

export function SettingsSheet({
  open,
  onClose,
  lang,
  onLanguageChange,
  themePreference,
  onThemeChange,
  unit,
  onUnitChange,
  roundingStep,
  onRoundingChange,
  annualInflationPercent,
  onInflationChange,
}: SettingsSheetProps) {
  const { t } = useTranslation()
  const [confirmingErase, setConfirmingErase] = useState(false)

  // The field holds a canonical ASCII string; it re-seeds whenever the committed percent changes.
  const [inflationText, setInflationText] = useState(() => String(annualInflationPercent))
  const [seededPercent, setSeededPercent] = useState(annualInflationPercent)
  const [inflationError, setInflationError] = useState<string | null>(null)
  if (seededPercent !== annualInflationPercent) {
    setSeededPercent(annualInflationPercent)
    setInflationText(String(annualInflationPercent))
    setInflationError(null)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null)
  const [backupInvalid, setBackupInvalid] = useState(false)
  const [backupRestored, setBackupRestored] = useState(false)
  const [confirmingReplace, setConfirmingReplace] = useState(false)

  /* At or below −100 %/yr the annual growth factor collapses to zero and every downstream
     figure turns into NaN, so such an entry is refused rather than stored. */
  const commitInflation = () => {
    const parsed = parseAmount(inflationText)
    if (!Number.isFinite(parsed) || parsed <= -100) {
      setInflationError(t('errors.invalid'))
      return
    }
    setInflationError(null)
    if (parsed !== annualInflationPercent) onInflationChange(parsed)
  }

  const resetInflation = () => {
    vibrate()
    setInflationError(null)
    setSeededPercent(INFLATION_DEFAULT.annualPercent)
    setInflationText(String(INFLATION_DEFAULT.annualPercent))
    onInflationChange(null)
  }

  const exportBackup = async () => {
    vibrate()
    const file = await buildBackup()
    downloadJson(JSON.stringify(file, null, 2), backupFilename())
  }

  const readBackupFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    // Reset immediately, or re-picking the same file fires no change event at all.
    input.value = ''
    if (!file) return
    setBackupRestored(false)
    setConfirmingReplace(false)
    setPendingBackup(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      setBackupInvalid(true)
      return
    }
    const check = validateBackup(parsed)
    if (!check.ok) {
      setBackupInvalid(true)
      return
    }
    setBackupInvalid(false)
    setPendingBackup(check.data)
  }

  const restoreBackup = async (mode: 'merge' | 'replace') => {
    if (!pendingBackup) return
    vibrate()
    await applyBackup(pendingBackup, mode)
    setPendingBackup(null)
    setConfirmingReplace(false)
    setBackupRestored(true)
  }

  const sourceDate = formatDate(Date.parse(INFLATION_DEFAULT.updatedAt), lang)

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <div className="flex flex-col gap-5">
        <section aria-label={t('settings.language')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.language')}
          </h3>
          <SegmentedControl<AppLanguage>
            layoutId="settings-lang"
            ariaLabel={t('settings.language')}
            value={lang}
            onChange={onLanguageChange}
            options={[
              { value: 'en', label: 'English' },
              { value: 'fa', label: 'فارسی' },
            ]}
          />
        </section>

        <section aria-label={t('settings.theme')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.theme')}
          </h3>
          <SegmentedControl<ThemePreference>
            layoutId="settings-theme"
            ariaLabel={t('settings.theme')}
            value={themePreference}
            onChange={onThemeChange}
            options={[
              {
                value: 'light',
                label: (
                  <>
                    <IconSun size={16} /> {t('settings.themeLight')}
                  </>
                ),
              },
              {
                value: 'dark',
                label: (
                  <>
                    <IconMoon size={16} /> {t('settings.themeDark')}
                  </>
                ),
              },
              {
                value: 'system',
                label: (
                  <>
                    <IconSparkle size={16} /> {t('settings.themeSystem')}
                  </>
                ),
              },
            ]}
          />
        </section>

        <section aria-label={t('settings.unit')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.unit')}
          </h3>
          <SegmentedControl<Unit>
            layoutId="settings-unit"
            ariaLabel={t('settings.unit')}
            value={unit}
            onChange={onUnitChange}
            size="sm"
            options={UNITS.map((u) => ({ value: u, label: unitShortLabel(u, lang) }))}
          />
        </section>

        <section aria-label={t('settings.inflation')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.inflation')}
          </h3>
          <p className="mb-2 px-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {t('settings.inflationHint')}
          </p>
          <div
            className="glass glass-ring rounded-2xl"
            onBlur={commitInflation}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              commitInflation()
            }}
          >
            <NumberField
              id="settings-inflation"
              label={t('settings.inflationCustom')}
              value={inflationText}
              onChange={setInflationText}
              placeholder={t('fields.percentPlaceholder')}
              lang={lang}
              unit={t('fields.percentUnit')}
              error={inflationError}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[13px] text-[var(--text-tertiary)]">
            {INFLATION_DEFAULT.confidence === 'secondary' ? <IconAlert size={14} className="shrink-0" /> : null}
            <a
              href={INFLATION_DEFAULT.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[var(--accent-text)]"
            >
              {t('settings.inflationSource', { source: inflationSourceLabel(lang), date: sourceDate })}
            </a>
          </p>
          {hasInflationOverride() && (
            <button
              type="button"
              onClick={resetInflation}
              className="mt-2.5 rounded-xl bg-black/8 px-4 py-2 text-[14px] font-semibold text-[var(--text-secondary)] dark:bg-white/12"
            >
              {t('settings.inflationReset')}
            </button>
          )}
        </section>

        <section aria-label={t('settings.rounding')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.rounding')}
          </h3>
          <SegmentedControl<string>
            layoutId="settings-rounding"
            ariaLabel={t('settings.rounding')}
            value={String(roundingStep)}
            size="sm"
            onChange={(value) => {
              const step = ROUNDING_STEPS.find((s) => String(s) === value)
              if (step !== undefined) onRoundingChange(step)
            }}
            options={ROUNDING_STEPS.map((step) => ({
              value: String(step),
              label: step === 0 ? t('settings.roundingNone') : formatNumber(step, lang, 0),
            }))}
          />
          <p className="mt-2 px-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {t('settings.roundingHint')}
          </p>
        </section>

        <section aria-label={t('settings.backup')}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {t('settings.backup')}
          </h3>
          <p className="mb-2 px-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {t('settings.backupHint')}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void exportBackup()}
              className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
            >
              <IconDownload size={18} />
              {t('settings.backupExport')}
            </button>
            <button
              type="button"
              onClick={() => {
                vibrate()
                fileInputRef.current?.click()
              }}
              className="glass glass-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-semibold text-[var(--accent-text)]"
            >
              <IconUpload size={18} />
              {t('settings.backupImport')}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label={t('settings.backupImport')}
            onChange={(e) => void readBackupFile(e.currentTarget)}
          />

          {backupInvalid && (
            <p role="alert" className="mt-2.5 px-1 text-[13px] font-medium text-loss-600 dark:text-loss-400">
              {t('settings.backupInvalid')}
            </p>
          )}

          {backupRestored && (
            <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-[var(--accent-text)]">
              <IconCheck size={15} />
              {t('settings.backupDone')}
            </p>
          )}

          {pendingBackup && (
            <div className="mt-3 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void restoreBackup('merge')}
                className="glass glass-ring flex w-full flex-col items-start rounded-2xl px-4 py-3 text-start"
              >
                <span className="text-[15px] font-semibold text-[var(--accent-text)]">{t('settings.backupMerge')}</span>
                <span className="text-[13px] text-[var(--text-secondary)]">{t('settings.backupMergeHint')}</span>
              </button>
              {confirmingReplace ? (
                <div className="glass glass-ring flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                  <span className="text-[15px] font-semibold">{t('actions.areYouSure')}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void restoreBackup('replace')}
                      className="rounded-xl bg-loss-600 px-4 py-2 text-[14px] font-semibold text-white"
                    >
                      {t('settings.backupReplace')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReplace(false)}
                      className="rounded-xl bg-black/8 px-4 py-2 text-[14px] font-semibold text-[var(--text-secondary)] dark:bg-white/12"
                    >
                      {t('actions.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingReplace(true)}
                  className="glass glass-ring flex w-full flex-col items-start rounded-2xl px-4 py-3 text-start"
                >
                  <span className="text-[15px] font-semibold text-loss-600 dark:text-loss-400">
                    {t('settings.backupReplace')}
                  </span>
                  <span className="text-[13px] text-[var(--text-secondary)]">{t('settings.backupReplaceHint')}</span>
                </button>
              )}
            </div>
          )}
        </section>

        <section aria-label={t('settings.clearData')}>
          {confirmingErase ? (
            <div className="glass glass-ring flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <span className="text-[15px] font-semibold">{t('actions.areYouSure')}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    vibrate()
                    void clearHistory().then(() => setConfirmingErase(false))
                  }}
                  className="rounded-xl bg-loss-600 px-4 py-2 text-[14px] font-semibold text-white"
                >
                  {t('actions.delete')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingErase(false)}
                  className="rounded-xl bg-black/8 px-4 py-2 text-[14px] font-semibold text-[var(--text-secondary)] dark:bg-white/12"
                >
                  {t('actions.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingErase(true)}
              className="glass glass-ring flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-loss-500/14 text-loss-600 dark:text-loss-400">
                <IconTrash size={18} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-loss-600 dark:text-loss-400">
                  {t('settings.clearData')}
                </span>
                <span className="block text-[13px] text-[var(--text-secondary)]">{t('settings.clearDataHint')}</span>
              </span>
            </button>
          )}
        </section>

        <section aria-label={t('settings.about')} className="glass glass-ring rounded-2xl p-4">
          <div className="flex items-center gap-3.5">
            <img
              src={`${import.meta.env.BASE_URL}avatar-mahdi.png`}
              alt={t('dev.name')}
              width={52}
              height={52}
              loading="lazy"
              className="h-13 w-13 rounded-[16px] object-cover ring-1 ring-[var(--separator)]"
            />
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-tight">{t('dev.name')}</p>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{t('dev.role')}</p>
            </div>
          </div>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500/14 py-2.5 text-[14px] font-bold text-[var(--accent-text)] transition-colors hover:bg-accent-500/22"
          >
            <IconTelegram size={17} />
            {t('dev.contact')}
          </a>
          <p className="mt-3 text-center text-[12.5px] text-[var(--text-tertiary)]">{t('dev.blessing')}</p>
          <p className="mt-3 border-t border-[var(--separator)] pt-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {t('settings.privacy')}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-[var(--separator)] pt-3">
            <span className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
              <span>
                {t('settings.version')} {__APP_VERSION__}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-accent-500/14 px-2 py-0.5 text-[12px] font-semibold text-[var(--accent-text)]">
                <IconCheck size={13} />
                {t('settings.upToDate')}
              </span>
            </span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent-text)]"
            >
              <IconGitHub size={16} />
              {t('settings.sourceCode')}
            </a>
          </div>
        </section>
      </div>
    </Sheet>
  )
}
