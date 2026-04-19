'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setMessage('')
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account, then sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else { router.push('/'); router.refresh() }
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
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.7rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  borderBottom: mode === m ? '2px solid var(--gold)' : '2px solid transparent',
                  color: mode === m ? 'var(--gold)' : 'var(--text-muted)',
                  background: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Join the Society'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {mode === 'signup' && (
              <div>
                <label style={labelStyle}>Oath Name (Username)</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} placeholder="Choose your society name" />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} placeholder="your@email.com" />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••" />
            </div>

            {error && <p style={{ color: '#e57373', fontSize: '0.9rem' }}>{error}</p>}
            {message && <p style={{ color: '#81c784', fontSize: '0.9rem' }}>{message}</p>}

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
              {loading ? 'One moment...' : mode === 'login' ? 'Enter the Circle' : 'Take the Oath'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

