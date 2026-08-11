'use client'

import type { CSSProperties } from 'react'

type Props = {
  value: number
  max?: number
  size?: string | number
  style?: CSSProperties
}

const STAR_PRECISION = 8

function clampRating(value: number, max: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, value))
}

function roundToEighth(value: number) {
  return Math.round(value * STAR_PRECISION) / STAR_PRECISION
}

export function formatRating(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export default function FractionalStars({ value, max = 5, size = '1rem', style }: Props) {
  const rating = roundToEighth(clampRating(value, max))
  const label = `${formatRating(rating)} out of ${max}`

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        display: 'inline-block',
        color: 'var(--text-muted)',
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {Array.from({ length: max }, (_, index) => {
        const starNumber = index + 1
        const fill = Math.min(1, Math.max(0, rating - index))
        const fillPercent = `${fill * 100}%`

        return (
          <span key={starNumber} aria-hidden="true" style={{ position: 'relative', display: 'inline-block' }}>
            <span style={{ opacity: 0.35 }}>★</span>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                width: fillPercent,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                color: 'var(--gold)',
              }}
            >
              ★
            </span>
          </span>
        )
      })}
    </span>
  )
}
