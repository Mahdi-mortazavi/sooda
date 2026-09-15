import { useId } from 'react'

interface SparklineProps {
  /** Costs in chronological order. Fewer than two points renders nothing. */
  values: number[]
  label: string
  width?: number
  height?: number
  className?: string
}

/**
 * The shape of a product's recorded prices, drawn as inline SVG — no chart library,
 * because one would cost more than every rate string in the app put together.
 * Time always runs left to right in both directions of text: an SVG's own coordinate
 * system is absolute, so `dir` never mirrors it.
 */
export function Sparkline({ values, label, width = 96, height = 28, className = '' }: SparklineProps) {
  const gradientId = useId()
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat series would divide by zero; draw it down the middle instead.
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const pad = 2

  const points = values.map((value, index) => {
    const x = index * stepX
    const y = pad + (1 - (value - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} ${width},${height} 0,${height}`
  const last = points[points.length - 1]

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && <circle cx={last[0]} cy={last[1]} r="2.2" fill="currentColor" />}
    </svg>
  )
}
