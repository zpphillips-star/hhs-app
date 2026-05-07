'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const TIERS = [
  {
    id: 'hallowed',
    name: 'The Hallowed',
    price: 150,
    beers: 31,
    description: 'All 31 beers of October — one revealed every day.',
    venmoNote: 'HHS The Hallowed Membership',
  },
  {
    id: 'oddballs',
    name: 'Odd Balls',
    price: 100,
    beers: 16,
    description: '16 beers on odd days — same ritual, half the run.',
    venmoNote: 'HHS Odd Balls Membership',
  },
] as const

type TierId = 'hallowed' | 'oddballs'

export default function TierSelectionModal({ userId, onComplete }: { userId: string; onComplete?: () => void }) {
  const [selected, setSelected] = useState<TierId | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [venmoClicked, setVenmoClicked] = useState(false)

  const tier = TIERS.find(t => t.id === selected)

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    await supabase.from('profiles').update({
      tier: selected,
      tier_selected_at: new Date().toISOString(),
    }).eq('id', userId)
    setSaving(false)
    setConfirmed(true)
  }

  const handleVenmo = async () => {
    if (!tier) return
    // Log the click
    await supabase.from('profiles').update({
      venmo_clicked_at: new Date().toISOString(),
    }).eq('id', userId)
    setVenmoClicked(true)

    // Try Venmo app deep link first, fall back to web
    const note = encodeURIComponent(tier.venmoNote)
    const appLink = `venmo://paycharge?txn=pay&recipients=zpphillips&amount=${tier.price}&note=${note}`
    const webLink = `https://venmo.com/zpphillips?txn=pay&amount=${tier.price}&note=${note}`

    // Attempt app link; after short delay open web as fallback
    window.location.href = appLink
    setTimeout(() => { window.open(webLink, '_blank') }, 1500)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(200,151,58,0.3)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>

        {/* ── PRE-CONFIRM: choose a tier ── */}
        {!confirmed && (
          <>
            <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.6rem' }}>
              Choose Your Membership
            </p>
            <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Select your tier.
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              This locks in your October membership. Choose carefully — it can&apos;t be changed after you confirm.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {TIERS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  style={{
                    textAlign: 'left',
                    padding: '1rem 1.25rem',
                    background: selected === t.id ? 'rgba(200,151,58,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected === t.id ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                    <span style={{ fontFamily: "'Modern Antiqua', serif", color: selected === t.id ? 'var(--gold)' : 'var(--text)', fontSize: '1rem', fontWeight: 700 }}>
                      {t.name}
                    </span>
                    <span style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 700, marginLeft: '1rem' }}>
                      ${t.price}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {t.beers} beers &nbsp;·&nbsp; {t.description}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selected || saving}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: selected ? 'var(--gold)' : 'var(--border)',
                border: 'none',
                borderRadius: '10px',
                color: selected ? 'var(--bg)' : 'var(--text-muted)',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.9rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: selected ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              {saving ? 'Locking in...' : selected ? `Confirm — ${TIERS.find(t => t.id === selected)?.name}` : 'Select a tier above'}
            </button>
          </>
        )}

        {/* ── POST-CONFIRM: pay via Venmo ── */}
        {confirmed && tier && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍺</div>
              <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                {tier.name} — ${tier.price}
              </p>
              <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Now complete your payment.
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Tap below to open Venmo. The amount and recipient are pre-filled — just confirm and send.
              </p>
            </div>

            <button
              onClick={handleVenmo}
              style={{
                width: '100%',
                padding: '0.9rem',
                background: '#008CFF',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                marginBottom: '0.75rem',
              }}
            >
              Pay ${tier.price} on Venmo →
            </button>

            {venmoClicked && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Venmo opened. Once you&apos;ve sent the payment, you&apos;re all set — your spot is reserved.
              </p>
            )}

            {!venmoClicked && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Your tier is locked in. Payment completes your membership.
              </p>
            )}
          </>
        )}

      </div>
    </div>
  )
}
