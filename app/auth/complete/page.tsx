'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DEFAULT_HHS_PAYMENT_TIER } from '@/lib/venmo'

export default function CompleteProfilePage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        tier: DEFAULT_HHS_PAYMENT_TIER,
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

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', padding: '1rem' }}>
              <p style={{ ...labelStyle, marginBottom: '0.35rem' }}>Membership</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
                <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.95rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>
                  The Hallowed
                </span>
                <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 700 }}>
                  $150
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.5, margin: '0.4rem 0 0', fontStyle: 'italic' }}>
                Includes all 31 October beers. No tier choice is needed for the current HHS flow.
              </p>
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
