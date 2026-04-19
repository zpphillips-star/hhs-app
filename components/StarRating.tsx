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
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => { setStars(n); setSaved(false) }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="text-4xl transition-transform hover:scale-110 leading-none"
            style={{ color: n <= (hover || stars) ? '#f97316' : '#4b5563' }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        placeholder="Tasting notes (optional)..."
        className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg p-3 text-gray-300 text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500 mb-3"
        rows={3}
      />

      <button
        onClick={handleSubmit}
        disabled={!stars || saving || saved}
        className="bg-orange-500 hover:bg-orange-400 disabled:bg-gray-800 disabled:text-gray-600 text-black font-bold py-2 px-5 rounded-lg transition-colors text-sm"
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Submit Rating'}
      </button>
    </div>
  )
}
