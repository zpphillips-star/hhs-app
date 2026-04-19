'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer, Rating } from '@/lib/types'
import StarRating from '@/components/StarRating'
import Nav from '@/components/Nav'
import Link from 'next/link'

export default function HomePage() {
  const [beer, setBeer] = useState<Beer | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [userRating, setUserRating] = useState<Rating | null>(null)
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [ratingCount, setRatingCount] = useState(0)

  const today = new Date()
  const isOctober = today.getMonth() === 9
  const dayNumber = isOctober ? today.getDate() : null

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0b0f] flex items-center justify-center">
        <div className="text-orange-400 text-xl animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0b0f]">
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-400 mb-1">Hallowed Hop Society</h1>
          <p className="text-purple-400 text-sm tracking-widest uppercase">31 Beers of October</p>
        </div>

        {!isOctober ? (
          <div className="text-center py-16">
            <div className="text-8xl mb-4">🍺</div>
            <h2 className="text-2xl font-bold text-orange-400 mb-2">October is Coming</h2>
            <p className="text-gray-400 mb-6">The 31 Beers of October challenge starts October 1st. One beer per day, all month long.</p>
            <div className="flex gap-4 justify-center text-sm">
              <Link href="/beers" className="text-orange-400 hover:text-orange-300 underline">Browse Beer List</Link>
              <Link href="/leaderboard" className="text-orange-400 hover:text-orange-300 underline">Leaderboard</Link>
            </div>
          </div>
        ) : !beer ? (
          <div className="text-center py-16">
            <div className="text-8xl mb-4">🕯️</div>
            <h2 className="text-2xl font-bold text-orange-400 mb-2">Day {dayNumber} Not Yet Revealed</h2>
            <p className="text-gray-400">Check back soon — today&apos;s beer is being selected.</p>
          </div>
        ) : (
          <div>
            <div className="text-center mb-5">
              <span className="bg-orange-500 text-black font-bold text-xs px-3 py-1.5 rounded-full uppercase tracking-widest">
                Day {beer.day_number} · October {beer.day_number}
              </span>
            </div>
            <div className="bg-[#1a1520] border border-purple-900/60 rounded-2xl p-6 mb-4">
              <h2 className="text-3xl font-bold text-white mb-1">{beer.name}</h2>
              <p className="text-orange-400 text-lg mb-2">{beer.brewery}</p>
              <div className="flex gap-3 text-sm text-gray-500 mb-4">
                {beer.style && <span>{beer.style}</span>}
                {beer.abv && <><span>·</span><span>{beer.abv}% ABV</span></>}
              </div>
              {beer.description && (
                <p className="text-gray-400 text-sm leading-relaxed border-t border-purple-900/40 pt-4">{beer.description}</p>
              )}
              {avgRating !== null && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-4 pt-4 border-t border-purple-900/40">
                  <span className="text-orange-400">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</span>
                  <span>{avgRating} / 5 · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}</span>
                </div>
              )}
            </div>
            {user ? (
              <div className="bg-[#1a1520] border border-purple-900/60 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">{userRating ? '✅ Your Rating' : '⭐ Rate This Beer'}</h3>
                <StarRating initialStars={userRating?.stars} initialNotes={userRating?.notes || ''} onSubmit={handleRate} />
              </div>
            ) : (
              <div className="text-center py-8 bg-[#1a1520] border border-purple-900/60 rounded-2xl">
                <p className="text-gray-400 mb-4">Sign in to rate today&apos;s beer</p>
                <Link href="/auth" className="bg-orange-500 hover:bg-orange-400 text-black font-bold py-2.5 px-6 rounded-lg transition-colors text-sm">Sign In</Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
