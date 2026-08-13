'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { HHS_PAYMENT_TIERS, openHhsVenmoPayment } from '@/lib/venmo'

type Tier = keyof typeof HHS_PAYMENT_TIERS

export default function PaymentPage() {
  const [tier, setTier] = useState<Tier | null>(null)
  const [venmoClicked, setVenmoClicked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [continuing, setContinuing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/auth')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier, venmo_clicked_at')
        .eq('id', user.id)
        .single()

      if (!profile?.tier) {
        // No tier set — send back to complete
        router.push('/auth/complete')
        return
      }

      setTier(profile.tier as Tier)
      if (profile.venmo_clicked_at) setVenmoClicked(true)
      setLoading(false)
    })
  }, [router])

  const handleVenmoClick = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({
          venmo_clicked_at: new Date().toISOString(),
          payment_review_status: 'not_reviewed',
          payment_confirmed_at: null,
        })
        .eq('id', user.id)
    }
    setVenmoClicked(true)

    if (!tier) return
    openHhsVenmoPayment(tier)
  }

  const handleContinue = async () => {
    setContinuing(true)
    router.push('/preview/prelaunch-home?setup=install')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", letterSpacing: '0.1em' }}>Loading...</p>
      </div>
    )
  }

  const config = tier ? HHS_PAYMENT_TIERS[tier] : null
  if (!config) return null

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Header */}
        <div className="text-center mb-10">
          <Image src="/hhs_no_circles_300dpi.webp" alt="HHS" width={100} height={100} className="mx-auto mb-4 opacity-90" />
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            Complete Your Membership
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            One last step — send your dues via Venmo.
          </p>
        </div>

        <div style={{ border: '1px solid var(--border)', padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Order summary */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg)', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Your Order
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '1rem', color: 'var(--text)', letterSpacing: '0.08em' }}>
                    {config.label} Membership
                  </span>
                  <span style={{ display: 'block', fontFamily: "'Crimson Text', serif", fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.15rem' }}>
                    {config.beers} beers · {config.desc}
                  </span>
                </div>
                <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '1.4rem', color: 'var(--gold)', fontWeight: 700 }}>
                  ${config.amount}
                </span>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(var(--gold-rgb, 180,130,50), 0.04)' }}>
              <p style={{ fontFamily: "'Crimson Text', serif", fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.6 }}>
                🌱 Any funds beyond beer costs are donated to{' '}
                <span style={{ color: 'var(--text)', fontStyle: 'normal' }}>Vision Young Leaders Academy</span>.
              </p>
            </div>
          </div>

          {/* Venmo button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={handleVenmoClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                background: '#008CFF',
                color: '#fff',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.8rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                padding: '0.95rem',
                fontWeight: 700,
                border: 'none',
                width: '100%',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.875 2C20.875 3.625 21.312 5.297 21.312 7.406c0 6.281-5.359 14.438-9.703 14.438-1.89 0-3.515-1.719-4.171-3.25L5.765 13.5c-.578-1.547-1.219-3.297-1.219-4.734 0-.938.313-1.719.938-2.203L6.5 5.547c.375.469.875 1.344 1.594 3.672l.5 1.703c.25.859.469 1.375.469 1.375s1.109-1.328 2.172-3.234c.437-.781.703-1.656.703-2.422 0-1.234-.594-2.031-1.578-2.5L11.11 2h8.765z"/>
              </svg>
              {venmoClicked ? 'Reopen Venmo' : `Pay $${config.amount} via Venmo`}
            </button>

            <p style={{ textAlign: 'center', fontFamily: "'Crimson Text', serif", fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Pay <strong style={{ fontStyle: 'normal', color: 'var(--text)' }}>@zpphillips</strong> · ${config.amount} · Note: HHS {config.label} 2026
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* Continue */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={handleContinue}
              disabled={continuing || !venmoClicked}
              style={{
                background: venmoClicked ? 'var(--gold)' : 'transparent',
                color: venmoClicked ? 'var(--bg)' : 'var(--text-muted)',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.75rem',
                letterSpacing: '0.2em',
                padding: '0.875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: continuing || !venmoClicked ? 'not-allowed' : 'pointer',
                border: venmoClicked ? 'none' : '1px solid var(--border)',
                width: '100%',
                transition: 'all 0.3s',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {continuing ? 'Opening checklist...' : venmoClicked ? 'Continue to App Setup' : 'Pay with Venmo first'}
            </button>
            {!venmoClicked && (
              <p style={{ textAlign: 'center', fontFamily: "'Crimson Text', serif", fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Send payment first, then continue.
              </p>
            )}
          </div>

        </div>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <a
            href="/auth/complete"
            style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: "'Modern Antiqua', serif", letterSpacing: '0.1em', textDecoration: 'none', opacity: 0.5 }}
          >
            ← change tier or password
          </a>
        </div>

      </div>
    </div>
  )
}
