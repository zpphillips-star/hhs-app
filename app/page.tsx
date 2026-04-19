'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer, Rating } from '@/lib/types'
import StarRating from '@/components/StarRating'
import Nav from '@/components/Nav'
import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  const [beer, setBeer] = useState<Beer | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userRating, setUserRating] = useState<Rating | null>(null)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [ratingCount, setRatingCount] = useState(0)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  const today = new Date()
  const isOctober = today.getMonth() === 9
  const dayNumber = isOctober ? today.getDate() : null

  // Countdown to Oct 1
  useEffect(() => {
    if (isOctober) return
    const tick = () => {
      const now = new Date()
      const oct1 = new Date(now.getFullYear(), 9, 1)
      if (now > oct1) oct1.setFullYear(oct1.getFullYear() + 1)
      const diff = oct1.getTime() - now.getTime()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setCountdown({ days, hours, minutes, seconds })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isOctober])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const fetchBeer = async () => {
      if (!dayNumber) { setLoading(false); return }
      const { data } = await supabase.from('beers').select('*').eq('day_number', dayNumber).maybeSingle()
      setBeer(data)
      if (data) {
        const { data: ratings } = await supabase.from('ratings').select('stars').eq('beer_id', data.id)
        if (ratings && ratings.length > 0) {
          const avg = ratings.reduce((sum: number, r: { stars: number }) => sum + r.stars, 0) / ratings.length
          setAvgRating(Math.round(avg * 10) / 10)
          setRatingCount(ratings.length)
        }
      }
      setLoading(false)
    }
    fetchBeer()
  }, [dayNumber])

  useEffect(() => {
    const fetchUserRating = async () => {
      if (!user || !beer) return
      const { data } = await supabase.from('ratings').select('*').eq('user_id', user.id).eq('beer_id', beer.id).maybeSingle()
      setUserRating(data)
    }
    fetchUserRating()
  }, [user, beer])

  const handleRate = async (stars: number, notes?: string) => {
    if (!user || !beer) return
    const { data } = await supabase
      .from('ratings')
      .upsert({ user_id: user.id, beer_id: beer.id, stars, notes: notes || null }, { onConflict: 'user_id,beer_id' })
      .select().maybeSingle()
    setUserRating(data)
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Nav user={user} />

      {/* Hero section */}
      <section className="container mx-auto max-w-6xl px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: text */}
        <div>
          <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: 'clamp(2.5rem, 6vw, 5rem)', lineHeight: 1.1, fontWeight: 900 }}>
            HALLOWED<br />HOP SOCIETY
          </h1>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1rem', marginTop: '1.5rem' }}>
            As October&apos;s chill creeps in and shadows grow long, a devoted fellowship rises to honor the sacred tradition of the hop.
          </p>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1rem' }}>
            <strong>The Hallowed Hop Society</strong> is an annual gathering of beer enthusiasts who embark on a solemn (and slightly ridiculous) ritual:{' '}
            <em>31 unique beers in 31 haunted days.</em> No repeats. No excuses. Just pure, unfiltered reverence for the craft of brewing.
          </p>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1rem' }}>
            Each year brings a new theme, a new lineup of brews, and new initiates brave enough to take the oath. From spiced pumpkin ales to bone-chilling stouts, we drink not just for the flavor—but for the fellowship.
          </p>
          <blockquote style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '1.25rem', margin: '1.5rem 0', color: 'var(--text)', fontSize: '1.15rem', fontWeight: 700 }}>
            Through ritual we pour, through hops we unite.
          </blockquote>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '0.25rem' }}>
            We are a society of the sip, the story, and the sacred pour.
          </p>
          <p style={{ color: 'var(--text)', fontSize: '1.1rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>
            If you&apos;ve got a taste for adventure (and good beer), your place at the circle awaits.
          </p>
          <div className="flex gap-4 mt-6 flex-wrap">
            <Link
              href="/beers"
              style={{ background: 'var(--gold)', color: 'var(--bg)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.2em', padding: '0.75rem 1.75rem', fontWeight: 700, borderRadius: '8px' }}
              className="uppercase tracking-widest transition-opacity hover:opacity-80"
            >
              Beer Calendar
            </Link>
            {!user && (
              <Link
                href="/auth"
                style={{ border: '1px solid var(--gold)', color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.2em', padding: '0.75rem 1.75rem', borderRadius: '8px' }}
                className="uppercase tracking-widest transition-opacity hover:opacity-80"
              >
                Join the Society
              </Link>
            )}
          </div>
        </div>

        {/* Right: logo or beer */}
        <div className="flex justify-center items-center">
          {isOctober && beer ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '2rem', maxWidth: '420px', width: '100%', borderRadius: '16px' }}>
              <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.3em', marginBottom: '1.5rem' }} className="uppercase">
                Day {beer.day_number} · October {beer.day_number}
              </div>
              <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.75rem', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                {beer.name}
              </h2>
              <p style={{ color: 'var(--gold)', fontSize: '1.1rem', marginBottom: '0.75rem' }}>{beer.brewery}</p>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {beer.style}{beer.style && beer.abv ? ' · ' : ''}{beer.abv ? `${beer.abv}% ABV` : ''}
              </div>
              {beer.description && (
                <p style={{ color: 'var(--text)', fontSize: '1rem', lineHeight: 1.7, borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                  {beer.description}
                </p>
              )}
              {avgRating !== null && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--gold)' }}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</span>
                  {' '}{avgRating}/5 · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                </p>
              )}
            </div>
          ) : (
            <Image
              src="/mughhs.webp"
              alt="Hallowed Hop Society"
              width={600}
              height={600}
              className="opacity-90 max-w-full"
              style={{ maxWidth: '600px', width: '100%' }}
            />
          )}
        </div>
      </section>

      {/* Countdown or rating section */}
      <section className="container mx-auto max-w-6xl px-6 py-16">
        {!isOctober ? (
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
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
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
          </div>
        ) : isOctober && !loading && beer && user ? (
          <div className="max-w-xl mx-auto">
            <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.25rem', marginBottom: '1.5rem', letterSpacing: '0.1em' }}>
              {userRating ? 'Your Rating' : 'Rate Today&apos;s Beer'}
            </h2>
            <StarRating initialStars={userRating?.stars} initialNotes={userRating?.notes || ''} onSubmit={handleRate} />
          </div>
        ) : isOctober && !user ? (
          <div className="text-center">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Sign in to rate today&apos;s beer and track your progress.</p>
            <Link
              href="/auth"
              style={{ border: '1px solid var(--gold)', color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.2em', padding: '0.75rem 2rem' }}
              className="uppercase inline-block hover:opacity-80 transition-opacity"
            >
              Members Only
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  )
}


