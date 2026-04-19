'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

type MemberStat = { username: string; count: number; avg: number }
type BeerStat = { name: string; brewery: string; day_number: number; avg: number; count: number }

export default function LeaderboardPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [members, setMembers] = useState<MemberStat[]>([])
  const [topBeers, setTopBeers] = useState<BeerStat[]>([])
  const [tab, setTab] = useState<'members' | 'beers'>('members')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const fetchData = async () => {
      const { data: ratings } = await supabase
        .from('ratings')
        .select('stars, user_id, beer_id, profiles(username), beers(name, brewery, day_number)')

      if (!ratings) { setLoading(false); return }

      // Member stats
      const memberMap: Record<string, { count: number; total: number; username: string }> = {}
      for (const r of ratings) {
        const uid = r.user_id
        const username = (r.profiles as { username?: string } | null)?.username || 'Unknown'
        if (!memberMap[uid]) memberMap[uid] = { count: 0, total: 0, username }
        memberMap[uid].count++
        memberMap[uid].total += r.stars
      }
      setMembers(
        Object.values(memberMap)
          .map(m => ({ username: m.username, count: m.count, avg: Math.round(m.total / m.count * 10) / 10 }))
          .sort((a, b) => b.count - a.count || b.avg - a.avg)
      )

      // Beer stats
      const beerMap: Record<string, { total: number; count: number; name: string; brewery: string; day_number: number }> = {}
      for (const r of ratings) {
        const bid = r.beer_id
        const beer = r.beers as { name?: string; brewery?: string; day_number?: number } | null
        if (!beer?.name) continue
        if (!beerMap[bid]) beerMap[bid] = { total: 0, count: 0, name: beer.name, brewery: beer.brewery || '', day_number: beer.day_number || 0 }
        beerMap[bid].total += r.stars
        beerMap[bid].count++
      }
      setTopBeers(
        Object.values(beerMap)
          .map(b => ({ ...b, avg: Math.round(b.total / b.count * 10) / 10 }))
          .sort((a, b) => b.avg - a.avg || b.count - a.count)
      )

      setLoading(false)
    }

    fetchData()
  }, [])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-[#0d0b0f]">
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-orange-400 mb-6 text-center">🏆 Leaderboard</h1>

        <div className="flex bg-[#1a1520] rounded-lg p-1 mb-6">
          {(['members', 'beers'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-orange-500 text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'members' ? '👻 Members' : '🍺 Top Beers'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-orange-400 animate-pulse py-12">Loading...</div>
        ) : tab === 'members' ? (
          <div className="space-y-2">
            {members.length === 0 ? (
              <p className="text-center text-gray-600 py-12">No ratings yet. Be the first!</p>
            ) : members.map((m, i) => (
              <div key={m.username} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg w-7 text-center">{medals[i] || <span className="text-gray-600 font-bold text-sm">{i + 1}</span>}</span>
                <div className="flex-1">
                  <div className="text-white font-medium">{m.username}</div>
                  <div className="text-gray-500 text-xs">{m.count} beer{m.count !== 1 ? 's' : ''} rated</div>
                </div>
                <div className="text-right">
                  <div className="text-orange-400 text-sm">{'★'.repeat(Math.round(m.avg))}{'☆'.repeat(5 - Math.round(m.avg))}</div>
                  <div className="text-gray-600 text-xs">avg {m.avg}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {topBeers.length === 0 ? (
              <p className="text-center text-gray-600 py-12">No beers rated yet.</p>
            ) : topBeers.map((b, i) => (
              <div key={b.name + b.day_number} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-gray-600 font-bold w-7 text-center text-sm">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{b.name}</div>
                  <div className="text-orange-400 text-xs">{b.brewery} · Day {b.day_number}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-orange-400 text-sm">{'★'.repeat(Math.round(b.avg))}{'☆'.repeat(5 - Math.round(b.avg))}</div>
                  <div className="text-gray-600 text-xs">{b.avg}/5 · {b.count} ratings</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

