/**
 * The glyphs only a lazily-loaded surface draws — sheets, the products tab, the Learning Centre.
 *
 * Kept apart from `Icons.tsx` for one reason: that module is shared between the entry chunk and
 * every lazy chunk, so Rollup hoists it into the entry, and anything declared in it is downloaded
 * before first paint whether or not the first screen draws it. Twenty-four icons for sheets a
 * shopkeeper may never open is not a cost the first screen should carry.
 *
 * Nothing imports this directly: `Icons.tsx` re-exports all of it, so the import site is unchanged.
 */

import { base, type IconProps } from './iconBase'

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.28 4.28l1.42 1.42M18.3 18.3l1.42 1.42M2.5 12h2M19.5 12h2M4.28 19.72l1.42-1.42M18.3 5.7l1.42-1.42" />
    </svg>
  )
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z" />
    </svg>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.2 7l.8 12a2 2 0 0 0 2 1.9h6a2 2 0 0 0 2-1.9l.8-12M10 11.2v5.6M14 11.2v5.6" />
    </svg>
  )
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 14.5A1.5 1.5 0 0 1 4 13V5.5A1.5 1.5 0 0 1 5.5 4H13a1.5 1.5 0 0 1 1.5 1.5" />
    </svg>
  )
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
    </svg>
  )
}

export function IconSparkle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5c.7 3.9 2.3 5.6 6.5 6.5-4.2.9-5.8 2.6-6.5 6.5-.7-3.9-2.3-5.6-6.5-6.5 4.2-.9 5.8-2.6 6.5-6.5Z" />
      <path d="M18.5 15.5c.35 1.8 1.1 2.6 3 3-1.9.4-2.65 1.2-3 3-.35-1.8-1.1-2.6-3-3 1.9-.4 2.65-1.2 3-3Z" />
    </svg>
  )
}

export function IconGitHub(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2A10 10 0 0 0 8.84 21.5c.5.08.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.16.58.67.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

export function IconShareUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 14.5V3.5M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  )
}

export function IconPlusSquare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function IconLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.5 13.5a4 4 0 0 0 6 .4l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3" />
      <path d="M13.5 10.5a4 4 0 0 0-6-.4l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" />
    </svg>
  )
}

export function IconSwap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5 20.5 16 17 19.5M20.5 16h-13" />
    </svg>
  )
}

export function IconBasketPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.3 9.5 5 20.2a1.6 1.6 0 0 0 1.6 1.8h10.8a1.6 1.6 0 0 0 1.6-1.8L17.7 9.5Z" />
      <path d="M8.5 12V6.5a3.5 3.5 0 0 1 7 0V12" />
      <path d="M12 13.6v4M10 15.6h4" />
    </svg>
  )
}

export function IconSigma(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M17.5 7V4.5h-11L12 12l-5.5 7.5h11V17" />
    </svg>
  )
}

export function IconTelegram(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M21.6 3.3 2.9 10.6c-1 .4-1 1.8 0 2.2l4.6 1.7 1.8 5.6c.3.9 1.4 1.1 2 .4l2.6-2.7 4.8 3.6c.8.6 2 .2 2.2-.9l3-15.7c.2-1.1-.9-2-2.3-1.5ZM8.4 13.9l9.7-6.2c.4-.3.9.3.5.7l-7.7 7.3-.3 3-1.6-4.8-.6-.9Z" />
    </svg>
  )
}

export function IconBookmarkPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 21 12 17l-6 4V5.4A2.4 2.4 0 0 1 8.4 3h7.2A2.4 2.4 0 0 1 18 5.4Z" />
      <path d="M12 7.6v4.2M9.9 9.7h4.2" />
    </svg>
  )
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.2" y="5" width="17.6" height="16" rx="2.6" />
      <path d="M3.2 9.8h17.6M8 3v3.6M16 3v3.6" />
    </svg>
  )
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9h9.5a5.5 5.5 0 0 1 0 11H8" />
      <path d="m7.6 5.2-3.7 3.9 3.7 3.7" />
    </svg>
  )
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 16.2V4.4M8.2 8.1 12 4.2l3.8 3.9" />
      <path d="M4.5 15v3.6A2.4 2.4 0 0 0 6.9 21h10.2a2.4 2.4 0 0 0 2.4-2.4V15" />
    </svg>
  )
}

export function IconTrendUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 16.5 5-5.2 3.4 3.4L20 7" />
      <path d="M15.4 7H20v4.6" />
    </svg>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5M12 16.2h.01" />
    </svg>
  )
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

