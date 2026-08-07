'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import AboutHHSContent from '@/components/AboutHHSContent'
import { supabase } from '@/lib/supabase'

type User = { id: string; email?: string }

export default function AboutPage() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Nav user={user} />
      <section className="hhs-hero">
        <style>{`
          .hhs-hero { max-width: 860px; margin: 0 auto; padding: 4rem 2rem 2rem; }
          .hhs-hero-img { float: right; width: 44%; height: auto; opacity: 0.9; margin-left: 2rem; margin-bottom: 1rem; }
          @media (max-width: 767px) {
            .hhs-hero { padding: 2rem 1.25rem 1.5rem; }
            .hhs-hero-img { float: right; width: 50%; margin-left: 1rem; margin-bottom: 0.75rem; }
          }
        `}</style>
        <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1.05, fontWeight: 900, marginBottom: '1.5rem' }}>
          ABOUT<br />HHS
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mughhs.webp"
          alt="Hallowed Hop Society"
          className="hhs-hero-img"
          style={{ opacity: 0.9 }}
        />
        <AboutHHSContent />
        <div style={{ clear: 'both' }} />
      </section>
    </div>
  )
}
