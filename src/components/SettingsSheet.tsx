import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import type { ThemePreference } from '../hooks/useTheme'
import { clearHistory } from '../lib/db'
import { vibrate } from '../lib/haptics'
import type { AppLanguage } from '../lib/numbers'
import { GITHUB_URL, TELEGRAM_URL } from '../lib/links'
import { UNITS, unitShortLabel, type Unit } from '../lib/units'
import { IconGitHub, IconMoon, IconSparkle, IconSun, IconTelegram, IconTrash } from './Icons'
import { SegmentedControl } from './SegmentedControl'
import { Sheet } from './Sheet'

declare const __APP_VERSION__: string

interface SettingsSheetProps {
  open: boolean
  onClose: () => void
  lang: AppLanguage
  onLanguageChange: (lang: AppLanguage) => void
  themePreference: ThemePreference
  onThemeChange: (pref: ThemePreference) => void
  unit: Unit
  onUnitChange: (unit: Unit) => void
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
}: SettingsSheetProps) {
  const { t } = useTranslation()
  const [confirmingErase, setConfirmingErase] = useState(false)

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
            <span className="text-[13px] text-[var(--text-tertiary)]">
              {t('settings.version')} {__APP_VERSION__}
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
