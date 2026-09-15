/**
 * The glyphs the first screen draws.
 *
 * Only these ten. The other twenty-four live in `SheetIcons.tsx` and are re-exported at the bottom
 * of this file, so every component keeps importing from `./Icons` and nothing else had to change —
 * but Rollup sees that the entry graph never reads those bindings and leaves that module out of the
 * first-paint chunk. Before the split all thirty-four rode into the entry because this module is
 * shared between it and the lazy sheets, and the icons a settings sheet needs were being
 * downloaded by a shopkeeper who had not opened one.
 *
 * Adding an icon: if the calculator, the tab bar or the header draws it, it belongs here. If only
 * a sheet, the products tab or the Learning Centre does, it belongs next door.
 */

import { base, type IconProps } from './iconBase'

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function IconGear(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10.05 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01c.26.63.87 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09c-.69 0-1.3.41-1.51 1.04Z" />
    </svg>
  )
}

export function IconPercent(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18.5 5.5l-13 13" />
      <circle cx="7.25" cy="7.25" r="2.55" />
      <circle cx="16.75" cy="16.75" r="2.55" />
    </svg>
  )
}

export function IconTag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 12.6V5.2a1.7 1.7 0 0 1 1.7-1.7h7.4a2 2 0 0 1 1.4.6l6.6 6.6a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-7.5-7.5a1.7 1.7 0 0 1-.6-1.6Z" />
      <circle cx="8.3" cy="8.3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconScale(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 20.5h10M12 4v16.5M12 4l-6 3M12 4l6 3" />
      <path d="M3.5 13.5 6 7l2.5 6.5a2.7 2.7 0 0 1-5 0ZM15.5 13.5 18 7l2.5 6.5a2.7 2.7 0 0 1-5 0Z" />
    </svg>
  )
}

export function IconTagReverse(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.5 12.6V5.2a1.7 1.7 0 0 0-1.7-1.7h-7.4a2 2 0 0 0-1.4.6L3.4 10.7a2 2 0 0 0 0 2.8l6.2 6.2a2 2 0 0 0 2.8 0l7.5-7.5a1.7 1.7 0 0 0 .6-1.6Z" />
      <circle cx="15.7" cy="8.3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconBasket(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.3 9.5 5 20.2a1.6 1.6 0 0 0 1.6 1.8h10.8a1.6 1.6 0 0 0 1.6-1.8L17.7 9.5Z" />
      <path d="M8.5 12V6.5a3.5 3.5 0 0 1 7 0V12" />
    </svg>
  )
}

export function IconBox(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 8.2v7.6a1.6 1.6 0 0 1-.83 1.4l-7.4 4.1a1.6 1.6 0 0 1-1.54 0l-7.4-4.1A1.6 1.6 0 0 1 3 15.8V8.2a1.6 1.6 0 0 1 .83-1.4l7.4-4.1a1.6 1.6 0 0 1 1.54 0l7.4 4.1A1.6 1.6 0 0 1 21 8.2Z" />
      <path d="M3.4 7.3 12 12l8.6-4.7M12 12v9.6" />
    </svg>
  )
}

export function IconCalculator(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="2.8" width="15" height="18.4" rx="2.6" />
      <path d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" />
    </svg>
  )
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h12.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M3.5 9.8V6.9A1.9 1.9 0 0 1 5.4 5h10.3" />
      <circle cx="16.8" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/* The lazy twenty-four. Re-exported, not re-declared: the import site stays `./Icons` everywhere,
 * while the module itself only reaches the chunks that actually draw one of them. */
export {
  IconSun,
  IconMoon,
  IconTrash,
  IconCopy,
  IconCheck,
  IconClose,
  IconSearch,
  IconDownload,
  IconSparkle,
  IconGitHub,
  IconShareUp,
  IconPlusSquare,
  IconLink,
  IconSwap,
  IconBasketPlus,
  IconSigma,
  IconTelegram,
  IconBookmarkPlus,
  IconCalendar,
  IconUndo,
  IconUpload,
  IconTrendUp,
  IconAlert,
  IconTarget,
} from './SheetIcons'
