'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  // Supabase sends the recovery token via URL hash.
  // onAuthStateChange fires a PASSWORD_RECOVERY event when the token is valid.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

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

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/'), 2500)
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
          <Image
            src="/hhs_no_circles_300dpi.webp"
            alt="HHS"
            width={100}
            height={100}
            className="mx-auto mb-4 opacity-90"
          />
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            Hallowed Hop Society
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            Choose a new password
          </p>
        </div>

        {/* Card */}
        <div style={{ border: '1px solid var(--border)', padding: '2.25rem 2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍺</div>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '1.1rem', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                Password updated.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.8, fontStyle: 'italic' }}>
                Sending you back to the Society...
              </p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '1rem' }}>
                Verifying your recovery link...
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.6 }}>
                If nothing happens, your link may have expired.{' '}
                <a href="/auth/forgot-password" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                  Request a new one.
                </a>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={inputStyle}
                  placeholder="At least 8 characters"
                  autoFocus
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
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
