'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function CompleteProfilePage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/auth')
        return
      }
      setFirstName(user.user_metadata?.first_name || '')
    })
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
      }, { onConflict: 'id' })
    }

    router.push('/')
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
            {firstName ? `Welcome, ${firstName}.` : 'Welcome.'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
            Choose your Society name and set a password to complete your membership.
          </p>
        </div>

        <div style={{ border: '1px solid var(--border)', padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
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
        </div>
      </div>
    </div>
  )
}
