'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
    setLoading(false)
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
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo + Title */}
        <div className="text-center mb-10">
          <a href="/auth">
            <Image
              src="/hhs_no_circles_300dpi.webp"
              alt="HHS"
              width={100}
              height={100}
              className="mx-auto mb-4 opacity-90"
              style={{ cursor: 'pointer' }}
            />
          </a>
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            Hallowed Hop Society
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            Password Recovery
          </p>
        </div>

        {/* Card */}
        <div style={{ border: '1px solid var(--border)', padding: '2.25rem 2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🕯️</div>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '1.1rem', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                The signal has been sent.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.8, fontStyle: 'italic' }}>
                If an account exists for<br />
                <span style={{ color: 'var(--text)', fontStyle: 'normal', fontWeight: 600 }}>{email}</span><br />
                a recovery link is on its way.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '1.5rem', opacity: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontFamily: "'Modern Antiqua', serif" }}>
                Check your inbox
              </p>
            </div>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.7, fontStyle: 'italic' }}>
                Enter your email and we&#39;ll send a recovery link.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                    placeholder="your@email.com"
                    autoFocus
                  />
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
                  {loading ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Back link */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <a
            href="/auth"
            style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: "'Modern Antiqua', serif", letterSpacing: '0.1em', textDecoration: 'none', opacity: 0.5 }}
          >
            ← back to sign in
          </a>
        </div>

      </div>
    </div>
  )
}
