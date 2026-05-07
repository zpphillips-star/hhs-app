'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Mode = 'login' | 'request'

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else { router.push('/'); router.refresh() }
    setLoading(false)
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Something went wrong.')
      else setMessage('Your request has been received. You\'ll hear from us if you\'re admitted.')
    } catch {
      setError('Something went wrong. Try again.')
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

  const tabs: { key: Mode; label: string }[] = [
    { key: 'login', label: 'Sign In' },
    { key: 'request', label: 'Request Membership' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-10">
          <Image src="/hhs_no_circles_300dpi.webp" alt="HHS" width={100} height={100} className="mx-auto mb-4 opacity-90" />
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.1em' }}>
            Hallowed Hop Society
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem', fontStyle: 'italic' }}>Members Only</p>
        </div>

        <div style={{ border: '1px solid var(--border)', padding: '2rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError(''); setMessage('') }}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  borderBottom: mode === key ? '2px solid var(--gold)' : '2px solid transparent',
                  color: mode === key ? 'var(--gold)' : 'var(--text-muted)',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sign In */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="your@email.com" />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" />
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
                {loading ? 'One moment...' : 'Enter the Circle'}
              </button>
            </form>
          )}

          {/* Request Membership */}
          {mode === 'request' && (
            <>
              {message ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '1rem', marginBottom: '0.75rem' }}>
                    Request received.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.7, fontStyle: 'italic' }}>
                    Your request has been received. You'll hear from us if you're admitted.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>First Name</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required style={inputStyle} placeholder="First" />
                    </div>
                    <div>
                      <label style={labelStyle}>Last Name</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required style={inputStyle} placeholder="Last" />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="your@email.com" />
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
                    {loading ? 'Submitting...' : 'Request to Join'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

