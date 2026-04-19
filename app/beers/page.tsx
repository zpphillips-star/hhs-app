'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer } from '@/lib/types'
import Nav from '@/components/Nav'

export default function BeersPage() {
  const [beers, setBeers] = useState<Beer[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    supabase.from('beers').select('*').order('day_number').then(({ data }) => {
      setBeers(data || [])
      setLoading(false)
    })
  }, [])

  const slots = Array.from({ length: 31 }, (_, i) => i + 1)
  const beerMap = Object.fromEntries(beers.map(b => [b.day_number, b]))

  const today = new Date()
  const isOctober = today.getMonth() === 9
  const todayDay = isOctober ? today.getDate() : null

  return (
    <div className="min-h-screen bg-[#0d0b0f]">
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-orange-400">🍺 31 Beers of October</h1>
          <p className="text-gray-500 text-sm mt-1">{beers.length} of 31 beers entered</p>
        </div>

        {loading ? (
          <div className="text-center text-orange-400 animate-pulse py-12">Loading beers...</div>
        ) : (
          <div className="space-y-2">
            {slots.map(day => {
              const beer = beerMap[day]
              const isToday = day === todayDay
              const isPast = todayDay ? day < todayDay : false

              return (
                <div
                  key={day}
                  className={`bg-[#1a1520] border rounded-xl p-4 flex items-center gap-4 transition-colors ${
                    isToday ? 'border-orange-500' : 'border-purple-900/40 hover:border-purple-700'
                  }`}
                >
                  <div className={`text-xl font-bold w-7 text-center shrink-0 ${
                    isToday ? 'text-orange-400' : isPast ? 'text-gray-500' : 'text-gray-700'
                  }`}>
                    {day}
                  </div>

                  {beer ? (
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">{beer.name}</div>
                      <div className="text-orange-400 text-sm truncate">{beer.brewery}</div>
                      {(beer.style || beer.abv) && (
                        <div className="text-gray-600 text-xs">
                          {beer.style}{beer.style && beer.abv ? ' · ' : ''}{beer.abv ? `${beer.abv}% ABV` : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 text-gray-700 italic text-sm">To be revealed...</div>
                  )}

                  {isToday && (
                    <span className="text-xs bg-orange-500 text-black font-bold px-2 py-0.5 rounded-full shrink-0">TODAY</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
