'use client'

import Link from 'next/link'

type Countdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

type Props = {
  countdown: Countdown
  showJoinCta?: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function HomeCountdownJoin({ countdown, showJoinCta = true }: Props) {
  return (
    <section className="container mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <p style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.3em', marginBottom: '2rem' }} className="uppercase">
          The ritual begins in
        </p>
        <div className="flex justify-center gap-8 mb-8">
          {[
            { val: countdown.days, label: 'Days' },
            { val: countdown.hours, label: 'Hours' },
            { val: countdown.minutes, label: 'Minutes' },
            { val: countdown.seconds, label: 'Seconds' },
          ].map(({ val, label }) => (
            <div key={label} className="text-center">
              <div style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--gold)', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 700, lineHeight: 1 }}>
                {pad(val)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em', marginTop: '0.5rem' }} className="uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
        {showJoinCta && (
          <div style={{ borderTop: '3px solid var(--gold)', paddingTop: '3rem' }}>
            <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.75rem', marginBottom: '2rem', fontWeight: 700, letterSpacing: '0.1em' }}>
              WANT TO JOIN THE SOCIETY?
            </h2>
            <Link
              href="/auth"
              style={{ background: 'var(--gold)', color: 'var(--bg)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.2em', padding: '0.875rem 2.5rem', fontWeight: 700, borderRadius: '8px' }}
              className="uppercase tracking-widest inline-block hover:opacity-80 transition-opacity"
            >
              I Want In
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
