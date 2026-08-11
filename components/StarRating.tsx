'use client'

import { useState, useEffect } from 'react'
import { formatRating } from '@/components/FractionalStars'

type Props = {
  initialStars?: number
  initialNotes?: string
  onSubmit: (stars: number, notes?: string) => Promise<void>
}

const RATING_LABELS: Record<number, string> = {
  1: "never again",
  2: "not for me",
  3: "solid, nothing special",
  4: "where can I get a six pack?",
  5: "where can I get a keg?",
}

export default function StarRating({ initialStars, onSubmit }: Props) {
  const [stars, setStars] = useState(initialStars || 0)
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(initialStars || 0)

  // Sync when initialStars loads async (e.g. after DB fetch on page load)
  useEffect(() => {
    if (initialStars) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initialStars arrives after the rating row loads.
      setStars(initialStars)
      setLastSaved(initialStars)
    }
  }, [initialStars])

  const handleClick = async (n: number) => {
    if (saving) return
    setStars(n)
    setSaving(true)
    await onSubmit(n)
    setLastSaved(n)
    setSaving(false)
  }

  const displayStars = hover || stars
  const getStarFill = (n: number) => {
    if (displayStars >= n) return '100%'
    if (displayStars <= n - 1) return '0%'
    return `${(displayStars - (n - 1)) * 100}%`
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => handleClick(n)}
            onMouseEnter={() => !saving && setHover(n)}
            onMouseLeave={() => setHover(0)}
            disabled={saving}
            aria-label={`Rate ${n} out of 5`}
            title={`Rate ${n} out of 5`}
            style={{
              fontSize: '2.25rem',
              color: 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: saving ? 'wait' : 'pointer',
              lineHeight: 1,
              transition: 'transform 0.1s, color 0.1s',
              transform: hover === n && !saving ? 'scale(1.15)' : 'scale(1)',
              padding: 0,
              position: 'relative',
            }}
          >
            <span aria-hidden="true">★</span>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: getStarFill(n),
                overflow: 'hidden',
                color: 'var(--gold)',
              }}
            >
              ★
            </span>
          </button>
        ))}
      </div>

      {/* Hint / confirmation */}
      <div style={{
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.58rem',
        letterSpacing: '0.28em',
        color: lastSaved > 0 ? 'var(--gold)' : 'var(--text-muted)',
        minHeight: '1rem',
      }}>
        {saving
          ? 'recording…'
          : lastSaved > 0
            ? `✓ rated ${formatRating(lastSaved)} / 5${RATING_LABELS[lastSaved] ? ` — ${RATING_LABELS[lastSaved]}` : ''}`
            : 'click a star to rate'}
      </div>
    </div>
  )
}

