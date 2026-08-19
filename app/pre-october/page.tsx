'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import Link from 'next/link'
import { OCT_1_2026_UTC_MS } from '@/lib/october'

function getNativeAppMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return (
      params.get('hhs_app') === '1' ||
      !!(window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
    )
  } catch {
    return false
  }
}

export default function PreOctoberPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [nativeApp] = useState(getNativeAppMode)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  // Once Oct 1 arrives, hand off to the regular home/Today route
  useEffect(() => {
    if (Date.now() >= OCT_1_2026_UTC_MS) {
      router.replace('/')
    }
  }, [router])

  // Auth — needed to pass user prop to Nav
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // Live countdown to Oct 1 2026 Pacific midnight
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, OCT_1_2026_UTC_MS - Date.now())
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {!nativeApp && <Nav user={user} />}

      {/* ── Countdown ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem 0' }}>

        <p style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          marginBottom: '1.75rem',
        }}>
          October 2026 · The Ritual Begins In
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(1.25rem, 5vw, 3.5rem)', marginBottom: '3rem' }}>
          {[
            { val: countdown.days,    label: 'Days'    },
            { val: countdown.hours,   label: 'Hours'   },
            { val: countdown.minutes, label: 'Minutes' },
            { val: countdown.seconds, label: 'Seconds' },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--gold)',
                fontSize: 'clamp(2.75rem, 8vw, 5rem)',
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '0.04em',
              }}>
                {pad(val)}
              </div>
              <div style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--text-muted)',
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '0.5rem',
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Brewery map ── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brewery-map-north-sound.png"
          alt="North Sound Brewery Map — Hallowed Hop Society 2026 territory"
          style={{
            display: 'block',
            margin: '0 auto',
            maxWidth: '100%',
            width: '680px',
            height: 'auto',
            borderRadius: '14px',
            opacity: 0.93,
          }}
        />

      </section>

      {/* ── Join CTA — web-only ── */}
      {!nativeApp && (
        <section className="container mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <div style={{ borderTop: '3px solid var(--gold)', paddingTop: '3rem' }}>
              <h2 style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--text)',
                fontSize: '1.75rem',
                marginBottom: '2rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}>
                WANT TO JOIN THE SOCIETY?
              </h2>
              <Link
                href="/auth"
                style={{
                  background: 'var(--gold)',
                  color: 'var(--bg)',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.75rem',
                  letterSpacing: '0.2em',
                  padding: '0.875rem 2.5rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                }}
                className="uppercase tracking-widest inline-block hover:opacity-80 transition-opacity"
              >
                I Want In
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
