/** The Sooda app icon as inline SVG — zero network requests, crisp at any size. */
export function AppIcon({ size = 84, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden className={className}>
      <defs>
        <linearGradient id="ai-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0e5b4a" />
          <stop offset="0.5" stopColor="#0f7a5f" />
          <stop offset="1" stopColor="#16a37e" />
        </linearGradient>
        <radialGradient id="ai-glow" cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#7fe8c8" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#7fe8c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ai-drop" x1="256" y1="86" x2="256" y2="446" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="0.45" stopColor="#e8fff7" stopOpacity="0.3" />
          <stop offset="1" stopColor="#baf5e2" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id="ai-edge" x1="256" y1="86" x2="256" y2="446" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill="url(#ai-bg)" />
      <rect width="512" height="512" rx="115" fill="url(#ai-glow)" />
      <path
        d="M256 86 C 256 86 122 244 122 332 A 134 134 0 0 0 390 332 C 390 244 256 86 256 86 Z"
        fill="url(#ai-drop)"
        stroke="url(#ai-edge)"
        strokeWidth="7"
      />
      <ellipse cx="205" cy="212" rx="34" ry="58" transform="rotate(24 205 212)" fill="#ffffff" opacity="0.5" />
      <g stroke="#ffffff" strokeWidth="26" strokeLinecap="round">
        <line x1="206" y1="392" x2="306" y2="272" />
        <circle cx="211" cy="285" r="27" fill="none" />
        <circle cx="301" cy="379" r="27" fill="none" />
      </g>
    </svg>
  )
}
