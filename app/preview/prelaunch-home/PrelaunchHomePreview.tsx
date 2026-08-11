'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Countdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

const displayFont = 'var(--font-display), "Modern Antiqua", Georgia, serif'
const bodyFont = 'var(--font-body), "Crimson Text", Georgia, serif'

function getOctFirstTarget() {
  const now = new Date()
  const target = new Date(now.getFullYear(), 9, 1, 0, 0, 0, 0)
  if (now.getTime() >= target.getTime()) {
    target.setFullYear(target.getFullYear() + 1)
  }
  return target
}

function buildCountdown(): Countdown {
  const diff = Math.max(0, getOctFirstTarget().getTime() - Date.now())
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function CountdownTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        border: '1px solid rgba(217, 124, 43, 0.28)',
        background: 'rgba(32, 29, 48, 0.78)',
        borderRadius: '18px',
        padding: '1rem 0.85rem',
        textAlign: 'center',
        minWidth: 82,
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.18)',
      }}
    >
      <div
        style={{
          color: 'var(--gold)',
          fontFamily: displayFont,
          fontSize: 'clamp(2rem, 8vw, 4.25rem)',
          lineHeight: 0.95,
          letterSpacing: '0.03em',
        }}
      >
        {value}
      </div>
      <div
        className="uppercase"
        style={{
          color: 'var(--text-muted)',
          fontFamily: displayFont,
          fontSize: '0.64rem',
          letterSpacing: '0.22em',
          marginTop: '0.45rem',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        className="uppercase"
        style={{
          color: 'var(--gold)',
          fontFamily: displayFont,
          fontSize: '0.7rem',
          letterSpacing: '0.28em',
          marginBottom: '0.55rem',
        }}
      >
        {eyebrow}
      </div>
      <h2
        style={{
          color: 'var(--text)',
          fontFamily: displayFont,
          fontSize: 'clamp(1.75rem, 4vw, 2.7rem)',
          lineHeight: 1.08,
          margin: 0,
        }}
      >
        {title}
      </h2>
      {intro ? (
        <p
          style={{
            color: 'var(--text-muted)',
            fontFamily: bodyFont,
            fontSize: '1.06rem',
            lineHeight: 1.7,
            marginTop: '0.75rem',
            maxWidth: 720,
          }}
        >
          {intro}
        </p>
      ) : null}
    </div>
  )
}

function StatusPill({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'muted' }) {
  return (
    <span
      className="uppercase"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        border: tone === 'gold' ? '1px solid rgba(217, 124, 43, 0.42)' : '1px solid rgba(217, 124, 43, 0.18)',
        background: tone === 'gold' ? 'rgba(217, 124, 43, 0.12)' : 'rgba(255, 255, 255, 0.035)',
        color: tone === 'gold' ? 'var(--gold)' : 'var(--text-muted)',
        borderRadius: 999,
        padding: '0.35rem 0.7rem',
        fontFamily: displayFont,
        fontSize: '0.58rem',
        letterSpacing: '0.18em',
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  )
}

function Panel({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        border: accent ? '1px solid rgba(217, 124, 43, 0.36)' : '1px solid var(--border)',
        background: accent
          ? 'linear-gradient(145deg, rgba(217, 124, 43, 0.13), rgba(32, 29, 48, 0.9) 42%, rgba(32, 29, 48, 0.72))'
          : 'rgba(32, 29, 48, 0.72)',
        borderRadius: '22px',
        padding: 'clamp(1.25rem, 3vw, 2rem)',
        boxShadow: '0 22px 60px rgba(0, 0, 0, 0.18)',
      }}
    >
      {children}
    </div>
  )
}

export default function PrelaunchHomePreview() {
  const [countdown, setCountdown] = useState<Countdown | null>(null)

  useEffect(() => {
    const tick = () => setCountdown(buildCountdown())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const checklist = [
    'Confirm your member sign-in works before the first reveal.',
    'Make room in the fridge for 31 nights of North Sound finds.',
    'Turn on notifications when you want daily reveal and pickup reminders.',
    'Choose your visibility: Hallowed full run or Oddballs daily assignment.',
  ]

  const onboardingSketch = [
    ['Invite', 'Zach sends or approves access so the member starts from the right tier: Hallowed or Oddballs.'],
    ['Account', 'Member signs in, confirms display name/email, and lands on a short membership status confirmation.'],
    ['Preferences', 'Member chooses calendar visibility and notification intent without changing the default Oddballs assignment.'],
    ['Ready', 'Member sees the prelaunch checklist, pickup memo, and what unlocks on October 1.'],
  ]

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 18% 8%, rgba(217, 124, 43, 0.14), transparent 31rem), radial-gradient(circle at 88% 18%, rgba(111, 86, 160, 0.18), transparent 28rem), var(--bg)',
        color: 'var(--text)',
      }}
    >
      <section className="container mx-auto max-w-6xl px-6" style={{ paddingTop: 'clamp(3rem, 8vw, 6.5rem)', paddingBottom: '3rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 'clamp(1.5rem, 4vw, 3rem)',
            alignItems: 'center',
          }}
        >
          <div>
            <StatusPill>Direct URL draft · not linked</StatusPill>
            <h1
              style={{
                color: 'var(--text)',
                fontFamily: displayFont,
                fontSize: 'clamp(3rem, 10vw, 6.75rem)',
                lineHeight: 0.92,
                letterSpacing: '0.025em',
                margin: '1.1rem 0 1rem',
              }}
            >
              The long dark wait before the first pour.
            </h1>
            <p
              style={{
                color: 'var(--text-muted)',
                fontFamily: bodyFont,
                fontSize: 'clamp(1.1rem, 2.6vw, 1.35rem)',
                lineHeight: 1.75,
                maxWidth: 680,
              }}
            >
              A pre-October home concept for members: countdown, pickup notes, readiness checks, route hints,
              and the ritual rules before Hallowed Hop Society XXXI begins.
            </p>
          </div>

          <Panel accent>
            <div
              className="uppercase"
              style={{
                color: 'var(--gold)',
                fontFamily: displayFont,
                fontSize: '0.72rem',
                letterSpacing: '0.26em',
                marginBottom: '1rem',
              }}
            >
              Countdown to October 1
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              <CountdownTile label="Days" value={countdown?.days ?? '—'} />
              <CountdownTile label="Hours" value={countdown?.hours ?? '—'} />
              <CountdownTile label="Minutes" value={countdown?.minutes ?? '—'} />
              <CountdownTile label="Seconds" value={countdown?.seconds ?? '—'} />
            </div>
            <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1rem', marginTop: '1.1rem', marginBottom: 0 }}>
              The calendar stays sealed until the season opens. On October 1, today&apos;s beer becomes the main ritual.
            </p>
          </Panel>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-6 py-8">
        <Panel accent>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <SectionHeading eyebrow="Latest from HHS" title="Sample pickup party memo" />
            <StatusPill>Draft memo</StatusPill>
          </div>
          <div
            style={{
              borderLeft: '3px solid var(--gold)',
              paddingLeft: '1rem',
              color: 'var(--text-muted)',
              fontFamily: bodyFont,
              fontSize: '1.08rem',
              lineHeight: 1.75,
            }}
          >
            <p style={{ marginTop: 0 }}>
              Members, keep your Saturday evening loose. The opening pickup party is the handoff point for coolers,
              route cards, and the first round of Society notes.
            </p>
            <p style={{ marginBottom: 0 }}>
              Final time and host details will be posted here once confirmed. Bring your member email, a bag or cooler,
              and enough curiosity for thirty-one nights of North Sound beer.
            </p>
          </div>
        </Panel>
      </section>

      <section className="container mx-auto max-w-6xl px-6 py-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: '1rem' }}>
          <Panel>
            <SectionHeading
              eyebrow="Before the first pour"
              title="Member checklist"
              intro="Small steps now prevent October friction later."
            />
            <ol style={{ display: 'grid', gap: '0.8rem', padding: 0, margin: 0, listStyle: 'none' }}>
              {checklist.map((item, index) => (
                <li key={item} style={{ display: 'grid', gridTemplateColumns: '2rem 1fr', gap: '0.85rem', alignItems: 'start' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2rem',
                      height: '2rem',
                      borderRadius: 999,
                      border: '1px solid rgba(217, 124, 43, 0.32)',
                      color: 'var(--gold)',
                      fontFamily: displayFont,
                      fontSize: '0.78rem',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1.05rem', lineHeight: 1.55 }}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="North Sound map"
              title="Route teaser"
              intro="The map will frame the journey from Marysville north to the border once the verified list is ready."
            />
            <div
              aria-label="North Sound map teaser with no breweries listed"
              style={{
                position: 'relative',
                minHeight: 250,
                borderRadius: '18px',
                overflow: 'hidden',
                border: '1px solid rgba(217, 124, 43, 0.2)',
                background:
                  'linear-gradient(160deg, rgba(25, 23, 38, 0.2), rgba(25, 23, 38, 0.78)), repeating-linear-gradient(35deg, rgba(217, 124, 43, 0.12) 0 1px, transparent 1px 24px), radial-gradient(circle at 35% 38%, rgba(217, 124, 43, 0.2), transparent 12rem)',
              }}
            >
              <div style={{ position: 'absolute', top: '18%', left: '28%', right: '24%', height: 2, background: 'rgba(217, 124, 43, 0.55)', transform: 'rotate(58deg)', transformOrigin: 'left center' }} />
              <div style={{ position: 'absolute', inset: '1rem', border: '1px solid rgba(217, 124, 43, 0.16)', borderRadius: '14px' }} />
              <div style={{ position: 'absolute', left: '1rem', top: '1rem' }}>
                <StatusPill tone="muted">Breweries hidden for now</StatusPill>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '1rem', maxWidth: 260, color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1rem', lineHeight: 1.55 }}>
                Pins stay dark until entries are verified and ready for the season reveal.
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-6 py-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: '1rem' }}>
          <Panel>
            <SectionHeading
              eyebrow="Season status"
              title="What resets on launch"
              intro="Before October, this screen explains the state of the season instead of pretending the calendar is open."
            />
            <div style={{ display: 'grid', gap: '0.8rem' }}>
              {[
                ['Now', 'Countdown, memos, checklist, and route teaser stay visible. Beer assignments remain sealed.'],
                ['Oct 1', 'The daily beer reveal becomes the main home experience, with ratings and notes active for members.'],
                ['After season', 'Progress, rankings, and wall context remain available while the next run returns to planning mode.'],
              ].map(([label, text]) => (
                <div key={label} style={{ display: 'grid', gap: '0.25rem' }}>
                  <StatusPill tone={label === 'Oct 1' ? 'gold' : 'muted'}>{label}</StatusPill>
                  <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1.03rem', lineHeight: 1.6, margin: 0 }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel accent>
            <SectionHeading
              eyebrow="Membership snapshot"
              title="Hallowed vs Oddballs"
              intro="Two ways through the ritual, clearly separated before the first reveal."
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div style={{ border: '1px solid rgba(217, 124, 43, 0.26)', borderRadius: '16px', padding: '1rem', background: 'rgba(25, 23, 38, 0.28)' }}>
                <StatusPill>Hallowed</StatusPill>
                <p style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: '1.55rem', lineHeight: 1.15, margin: '0.9rem 0 0.45rem' }}>
                  Full 31-night run
                </p>
                <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1rem', lineHeight: 1.55, margin: 0 }}>
                  Built for members following every reveal, rating each pour, and tracking the full Society arc.
                </p>
              </div>
              <div style={{ border: '1px solid rgba(217, 124, 43, 0.2)', borderRadius: '16px', padding: '1rem', background: 'rgba(25, 23, 38, 0.24)' }}>
                <StatusPill tone="muted">Oddballs</StatusPill>
                <p style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: '1.55rem', lineHeight: 1.15, margin: '0.9rem 0 0.45rem' }}>
                  Designated daily beer
                </p>
                <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1rem', lineHeight: 1.55, margin: 0 }}>
                  Defaults to the assigned beer first, with a clear opt-in view for the broader calendar when allowed.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-6 py-8" style={{ paddingBottom: 'clamp(4rem, 8vw, 6rem)' }}>
        <Panel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <SectionHeading
              eyebrow="Preview-only operator note"
              title="Onboarding flow sketch"
              intro="Non-public draft guidance only. This page does not change sign-in, membership, payments, preferences, or notification saves."
            />
            <StatusPill tone="muted">Not wired</StatusPill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '0.85rem' }}>
            {onboardingSketch.map(([label, text], index) => (
              <div key={label} style={{ border: '1px solid rgba(217, 124, 43, 0.18)', borderRadius: '16px', padding: '1rem', background: 'rgba(25, 23, 38, 0.24)' }}>
                <StatusPill tone={index === 0 ? 'gold' : 'muted'}>{String(index + 1).padStart(2, '0')} · {label}</StatusPill>
                <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1rem', lineHeight: 1.6, margin: '0.85rem 0 0' }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  )
}
