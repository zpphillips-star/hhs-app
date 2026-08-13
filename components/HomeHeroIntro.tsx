'use client'

import type { ReactNode } from 'react'
import AboutHHSContent from '@/components/AboutHHSContent'

type Props = {
  media: ReactNode
  showAbout?: boolean
}

export default function HomeHeroIntro({ media, showAbout = true }: Props) {
  return (
    <section className="hhs-hero">
      <style>{`
        .hhs-hero { max-width: 860px; margin: 0 auto; padding: 4rem 2rem 2rem; }
        .hhs-hero-img { float: right; width: 44%; height: auto; opacity: 0.9; margin-left: 2rem; margin-bottom: 1rem; }
        .hhs-hero-imgwrap { float: right; width: 42%; margin-left: 2rem; margin-bottom: 1.5rem; }
        @media (max-width: 767px) {
          .hhs-hero { padding: 2rem 1.25rem 1.5rem; }
          .hhs-hero-img { float: right; width: 50%; margin-left: 1rem; margin-bottom: 0.75rem; }
          .hhs-hero-imgwrap { float: right; width: 50%; margin-left: 1rem; margin-bottom: 0.75rem; }
        }
      `}</style>

      <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.05, fontWeight: 900, marginBottom: '1.5rem' }}>
        HALLOWED<br />HOP SOCIETY
      </h1>

      {media}
      {showAbout ? <AboutHHSContent /> : null}
      <div style={{ clear: 'both' }} />
    </section>
  )
}
