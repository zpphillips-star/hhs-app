'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Tier = 'hallowed' | 'oddballs'

export default function CompleteProfilePage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tier, setTier] = useState<Tier | null>(null)
  const [checkingLink, setCheckingLink] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [firstName, setFirstName] = useState('')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const readAuthErrorFromUrl = () => {
      if (typeof window === 'undefined') return ''
      const search = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const setupError = search.get('setup_error')
      if (setupError === 'expired') {
        return 'This approved member setup link has expired. Ask Zach to resend a fresh approval link.'
      }
      if (setupError === 'already_completed') {
        return 'This setup link has already been completed. Sign in with the password you chose, or use password reset if needed.'
      }
      if (setupError === 'not_approved' || setupError === 'profile_missing') {
        return 'We could not confirm an approved membership for this setup link. Ask Zach to resend your approved member setup link.'
      }
      if (setupError === 'link_generation_failed') {
        return 'Your membership was approved, but setup could not start. Ask Zach to resend your approved member setup link.'
      }
      if (setupError) {
        return 'This setup link is invalid. Open the latest approval email link, or ask Zach to resend it.'
      }
      return search.get('error_description') ||
        hash.get('error_description') ||
        search.get('error') ||
        hash.get('error') ||
        ''
    }

    const finishWithUser = async () => {
      const urlError = readAuthErrorFromUrl()
      if (urlError) {
        if (!cancelled) {
          setLinkError(urlError)
          setCheckingLink(false)
        }
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setLinkError('We could not verify this setup link. Open the latest approval email link, or ask Zach to resend it if it was already used.')
        setCheckingLink(false)
        return
      }
      setFirstName(user.user_metadata?.first_name || '')
      setCheckingLink(false)
    }

    finishWithUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session?.user) return
      setFirstName(session.user.user_metadata?.first_name || '')
      setLinkError('')
      setCheckingLink(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!username.trim()) {
      setError('Please choose a Society name.')
      return
    }
    if (!tier) {
      setError('Please choose your membership tier.')
      return
    }

    setLoading(true)

    // Check username availability
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (existing) {
      setError('That Society name is taken. Choose another.')
      setLoading(false)
      return
    }

    // Update password
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) {
      setError(pwErr.message)
      setLoading(false)
      return
    }

    // Upsert profile with username
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').upsert({
        id: user.id,
        username: username.trim().toLowerCase(),
        display_name: username.trim(),
        status: 'approved',
        tier,
        tier_selected_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    router.push('/auth/payment')
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontFamily: "'Crimson Text', Georgia, serif",
    outline: 'none',
    borderRadius: 'var(--radius-sm)',
  }

  const labelStyle = {
    display: 'block',
    fontFamily: "'Modern Antiqua', serif",
    fontSize: '0.65rem',
    letterSpacing: '0.2em',
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
    textTransform: 'uppercase' as const,
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-10">
          <Image src="/hhs_no_circles_300dpi.webp" alt="HHS" width={100} height={100} className="mx-auto mb-4 opacity-90" />
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            {linkError ? 'Setup Link Issue' : firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            {linkError ? 'Your membership was approved, but this link could not start setup.' : 'Choose your Society name and set a password to complete your membership.'}
          </p>
        </div>

        <div style={{ border: '1px solid var(--border)', padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          {checkingLink ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, textAlign: 'center', fontStyle: 'italic' }}>
              Verifying your invitation...
            </p>
          ) : linkError ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#e57373', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                {linkError}
              </p>
              <a
                href="/auth"
                style={{
                  display: 'inline-block',
                  background: 'var(--gold)',
                  color: 'var(--bg)',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.75rem',
                  letterSpacing: '0.2em',
                  padding: '0.875rem 1.2rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Go to Sign In
              </a>
            </div>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}>Society Name</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                style={inputStyle}
                placeholder="How you'll be known among members"
                autoFocus
              />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.5, margin: '0.4rem 0 0' }}>
                Shown on The Wall and The Rankings
              </p>
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>

            {/* Tier Selection */}
            <div>
              <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>Membership Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {([
                  {
                    key: 'hallowed' as Tier,
                    name: 'The Hallowed',
                    price: '$150',
                    count: '31 Beers',
                    desc: 'Every day of October',
                  },
                  {
                    key: 'oddballs' as Tier,
                    name: 'The Oddballs',
                    price: '$100',
                    count: '16 Beers',
                    desc: 'Odd days only',
                  },
                ] as const).map(({ key, name, price, count, desc }) => {
                  const selected = tier === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTier(key)}
                      style={{
                        padding: '1rem 0.75rem',
                        border: `2px solid ${selected ? 'var(--gold)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: selected ? 'rgba(var(--gold-rgb, 180,130,50), 0.08)' : 'var(--bg)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      <div style={{
                        fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.8rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: selected ? 'var(--gold)' : 'var(--text)',
                        fontWeight: 700,
                        marginBottom: '0.3rem',
                      }}>
                        {name}
                      </div>
                      <div style={{
                        fontFamily: "'Crimson Text', serif",
                        fontSize: '1rem',
                        color: selected ? 'var(--gold)' : 'var(--text)',
                        fontWeight: 700,
                        marginBottom: '0.2rem',
                      }}>
                        {price}
                      </div>
                      <div style={{
                        fontFamily: "'Crimson Text', serif",
                        fontSize: '1.1rem',
                        color: selected ? 'var(--gold)' : 'var(--text)',
                        fontWeight: 600,
                        marginBottom: '0.2rem',
                      }}>
                        {count}
                      </div>
                      <div style={{
                        fontFamily: "'Crimson Text', serif",
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}>
                        {desc}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p style={{ color: '#e57373', fontSize: '0.9rem' }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'var(--text-muted)' : 'var(--gold)',
                color: 'var(--bg)',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.75rem',
                letterSpacing: '0.2em',
                padding: '0.875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                border: 'none',
                width: '100%',
                transition: 'opacity 0.2s',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {loading ? 'Completing...' : 'Enter the Society'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  )
}
