'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Beer, Rating } from '@/lib/types'
import StarRating from '@/components/StarRating'
import FractionalStars, { formatRating } from '@/components/FractionalStars'
import Nav from '@/components/Nav'
import Link from 'next/link'
import { BeersPageContent } from '@/components/BeersPageContent'
import HomeHeroIntro from '@/components/HomeHeroIntro'
import HomeCountdownJoin from '@/components/HomeCountdownJoin'
import HomeMemberSignIn from '@/components/HomeMemberSignIn'
import { isBeforeOctober2026 } from '@/lib/october'

function getNativeHomeView() {
  if (typeof window === 'undefined') return { appMode: false, view: '' }
  try {
    const params = new URLSearchParams(window.location.search)
    const appMode =
      params.get('hhs_app') === '1' ||
      (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
    return { appMode, view: params.get('hhs_view') || '' }
  } catch {
    return { appMode: false, view: '' }
  }
}

export default function HomePage() {
  const router = useRouter()
  const [nativeView] = useState(getNativeHomeView)
  const [beer, setBeer] = useState<Beer | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
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
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthChecked(true)
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
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/beer-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ beer_id: beer.id, stars, notes: notes || null }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.error ?? 'Failed to save rating'); return }
    setUserRating(json.rating)
  }

  // Authenticated members: redirect to pre-October page before Oct 1 2026;
  // on/after Oct 1 fall through to the full Today/home view.
  if (authChecked && user) {
    if (isBeforeOctober2026()) {
      router.replace('/pre-october')
      return null
    }
    return <BeersPageContent forceTodayOnly />
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {!nativeView.appMode && <Nav user={user} />}

      <HomeHeroIntro
        media={isOctober && beer ? (
          <div className="hhs-hero-imgwrap">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '2rem', borderRadius: '16px' }}>
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
              {(beer.beer_fact || beer.brewery_fact) && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}>
                  {beer.beer_fact && (
                    <div>
                      <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        The Beer
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>
                        {beer.beer_fact}
                      </p>
                    </div>
                  )}
                  {beer.beer_fact && beer.brewery_fact && (
                    <div style={{ borderTop: '1px solid var(--border)' }} />
                  )}
                  {beer.brewery_fact && (
                    <div>
                      <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        The Brewery
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>
                        {beer.brewery_fact}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {avgRating !== null && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <FractionalStars value={avgRating} />
                  {' '}{formatRating(avgRating)}/5 · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                </p>
              )}
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/mughhs.webp"
            alt="Hallowed Hop Society"
            className="hhs-hero-img"
            style={{ opacity: 0.9 }}
          />
        )}
      />

      {/* Countdown or rating section */}
      {!isOctober ? (
        <HomeCountdownJoin countdown={countdown} showJoinCta={!nativeView.appMode} />
      ) : isOctober && !loading && beer && user ? (
        <section className="container mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-xl mx-auto">
            <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.25rem', marginBottom: '1.5rem', letterSpacing: '0.1em' }}>
              {userRating ? 'Your Rating' : 'Rate Today&apos;s Beer'}
            </h2>
            <StarRating initialStars={userRating?.stars} initialNotes={userRating?.notes || ''} onSubmit={handleRate} />
          </div>
        </section>
      ) : isOctober && !user ? (
        <section className="container mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Sign in to rate today&apos;s beer and track your progress.</p>
            {!nativeView.appMode && <Link
              href="/auth"
              style={{ border: '1px solid var(--gold)', color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.2em', padding: '0.75rem 2rem' }}
              className="uppercase inline-block hover:opacity-80 transition-opacity"
            >
              Members Only
            </Link>}
          </div>
        </section>
      ) : null}

      {!user && !nativeView.appMode && (
        <HomeMemberSignIn />
      )}
    </div>
  )
}


