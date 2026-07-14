import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 20, ...props }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

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
