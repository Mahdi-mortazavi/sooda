import { useTranslation } from 'react-i18next'
import { AppIcon } from './AppIcon'
import { IconPlusSquare, IconShareUp } from './Icons'
import { Sheet } from './Sheet'

interface InstallGuideSheetProps {
  open: boolean
  onClose: () => void
}

/** The three-step Add-to-Home-Screen walkthrough for iOS, where there is no install prompt. */
export function InstallGuideSheet({ open, onClose }: InstallGuideSheetProps) {
  const { t } = useTranslation()
  return (
      <Sheet open={open} onClose={onClose} title={t('install.iosTitle')}>
        <p className="mb-5 text-[15px] leading-relaxed text-[var(--text-secondary)]">{t('install.iosIntro')}</p>
        <ol className="flex flex-col gap-3">
          <GuideStep index={1} icon={<IconShareUp size={22} />} text={t('install.iosStep1')} />
          <GuideStep index={2} icon={<IconPlusSquare size={22} />} text={t('install.iosStep2')} />
          <GuideStep index={3} icon={<span className="text-[17px] font-bold">Add</span>} text={t('install.iosStep3')} />
        </ol>
        <div className="mt-6 flex justify-center pb-2">
          <AppIcon size={64} className="rounded-[16px] opacity-90 shadow-[0_8px_24px_rgba(15,122,95,0.3)]" />
        </div>
      </Sheet>
  )
}

function GuideStep({ index, icon, text }: { index: number; icon: React.ReactNode; text: string }) {
  return (
    <li className="glass glass-ring flex items-center gap-4 rounded-2xl px-4 py-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-500/14 text-[var(--accent-text)]">
        {icon}
      </span>
      <span className="text-[15px] font-medium leading-snug">
        <span className="me-1.5 text-[var(--accent-text)]">{index}.</span>
        {text}
      </span>
    </li>
  )
}
