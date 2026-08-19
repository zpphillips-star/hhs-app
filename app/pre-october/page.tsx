'use client'

/**
 * Pre-October landing page (temporary)
 * ─────────────────────────────────────
 * Step 1 of pre-Oct launch work.
 * Isolated route – NOT yet wired to any nav or redirect.
 * Shows an Oct 1 countdown (same typography as /about) and
 * the "Brewery Map – North Sound" apparel image beneath it.
 *
 * To wire later: replace the redirect target in LaunchHomeRedirect /
 * the Home button with `/pre-october` until Oct 1 passes.
 */

import { useEffect, useState } from 'react'
import Image from 'next/image'

const pad = (n: number) => String(n).padStart(2, '0')

function useOct1Countdown() {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const oct1 = new Date(now.getFullYear(), 9, 1) // month is 0-indexed; 9 = October
      if (now >= oct1) oct1.setFullYear(oct1.getFullYear() + 1)
      const diff = oct1.getTime() - now.getTime()
      setCountdown({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1_000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return countdown
}

export default function PreOctoberPage() {
  const countdown = useOct1Countdown()

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4rem 1.5rem 5rem',
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <Image
        src="/hhs_no_circles_300dpi.webp"
        alt="Hallowed Hop Society"
        width={80}
        height={80}
        style={{ opacity: 0.9, marginBottom: '2.5rem' }}
        priority
      />

      {/* ── Heading ───────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text)',
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          fontWeight: 900,
          letterSpacing: '0.06em',
          textAlign: 'center',
          lineHeight: 1.1,
          marginBottom: '0.6rem',
        }}
      >
        HALLOWED
        <br />
        HOP SOCIETY
      </h1>

      <p
        style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--gold)',
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          marginBottom: '3rem',
          textAlign: 'center',
        }}
      >
        October 2026
      </p>

      {/* ── Countdown ─────────────────────────────────────────────────── */}
      <p
        style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          marginBottom: '1.75rem',
          textAlign: 'center',
        }}
      >
        The ritual begins in
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'clamp(1.25rem, 4vw, 3rem)',
          marginBottom: '4rem',
        }}
      >
        {[
          { val: countdown.days, label: 'Days' },
          { val: countdown.hours, label: 'Hours' },
          { val: countdown.minutes, label: 'Minutes' },
          { val: countdown.seconds, label: 'Seconds' },
        ].map(({ val, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--gold)',
                fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {pad(val)}
            </div>
            <div
              style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--text-muted)',
                fontSize: '0.7rem',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginTop: '0.5rem',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          borderTop: '2px solid var(--border)',
          marginBottom: '3.5rem',
        }}
      />

      {/* ── Brewery Map ───────────────────────────────────────────────── */}
      <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
        <p
          style={{
            fontFamily: "'Modern Antiqua', serif",
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            marginBottom: '1.25rem',
          }}
        >
          North Sound Breweries
        </p>

        <Image
          src="/brewery-map-north-sound-v4.png"
          alt="Brewery map – North Sound region"
          width={1200}
          height={1200}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            opacity: 0.92,
          }}
          priority={false}
        />
      </div>
    </div>
  )
}
