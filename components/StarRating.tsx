'use client'

import { useState } from 'react'

type Props = {
  initialStars?: number
  initialNotes?: string
  onSubmit: (stars: number, notes?: string) => Promise<void>
}

export default function StarRating({ initialStars, initialNotes = '', onSubmit }: Props) {
  const [stars, setStars] = useState(initialStars || 0)
  const [hover, setHover] = useState(0)
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!initialStars)

  const handleSubmit = async () => {
    if (!stars) return
    setSaving(true)
    await onSubmit(stars, notes)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => { setStars(n); setSaved(false) }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              fontSize: '2.25rem',
              color: n <= (hover || stars) ? 'var(--gold)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
              transition: 'transform 0.1s, color 0.1s',
              transform: hover === n ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        placeholder="Tasting notes, observations, lore..."
        rows={3}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          fontFamily: "'Crimson Text', Georgia, serif",
          resize: 'vertical',
          outline: 'none',
          marginBottom: '1rem',
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={!stars || saving || saved}
        style={{
          background: saved ? 'transparent' : !stars || saving ? 'transparent' : 'var(--gold)',
          border: saved ? '1px solid var(--text-muted)' : '1px solid var(--gold)',
          color: saved ? 'var(--text-muted)' : !stars || saving ? 'var(--text-muted)' : 'var(--bg)',
          fontFamily: "'Cinzel', serif",
          fontSize: '0.7rem',
          letterSpacing: '0.2em',
          padding: '0.625rem 1.5rem',
          textTransform: 'uppercase',
          cursor: !stars || saving || saved ? 'not-allowed' : 'pointer',
        }}
      >
        {saving ? 'Recording...' : saved ? '✓ Recorded' : 'Submit Rating'}
      </button>
    </div>
  )
}
