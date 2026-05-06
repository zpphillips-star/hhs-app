'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'

type MemberStat = { username: string; display_name: string | null; score: number; ratings: number; posts: number; comments: number; reactions: number }
type BeerStat   = { name: string; brewery: string; day_number: number; avg: number; count: number }

const MEDALS = ['🥇', '🥈', '🥉']

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,140,0,0.35))' }} />
      <span style={{
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.6rem',
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        color: 'var(--gold)',
        whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(255,140,0,0.35))' }} />
    </div>
  )
}

export default function LeaderboardPage() {
  const [user,     setUser]     = useState<{ id: string; email?: string } | null>(null)
  const [members,  setMembers]  = useState<MemberStat[]>([])
  const [topBeers, setTopBeers] = useState<BeerStat[]>([])
  const [tab,      setTab]      = useState<'members' | 'beers'>('beers')
  const [loading,  setLoading]  = useState(true)

  // Timeliness bonus: interacting on the day a beer is featured earns +1 pt
  // Beer day_number maps to its calendar day (e.g. day_number=19 → Oct 19)
  const isSameDay = (createdAt: string, dayNumber: number | null | undefined) => {
    if (!dayNumber) return false
    return new Date(createdAt).getDate() === dayNumber
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))

    const fetchData = async () => {
      // Fetch all four interaction types + profiles in parallel
      // Note: profiles joined separately because user_id FKs point to auth.users, not profiles
      const [
        { data: ratings },
        { data: posts },
        { data: comments },
        { data: reactions },
        { data: profiles },
      ] = await Promise.all([
        supabase.from('ratings').select('user_id, beer_id, stars, created_at, beers(name, brewery, day_number)'),
        supabase.from('posts').select('user_id, beer_id, created_at, beers(day_number)'),
        supabase.from('post_comments').select('user_id, created_at, posts(beer_id, beers(day_number))'),
        supabase.from('post_reactions').select('user_id, created_at, posts(beer_id, beers(day_number))'),
        supabase.from('profiles').select('id, username, display_name'),
      ])

      // Build a profile lookup map by user id
      const profileMap: Record<string, { username: string; display_name: string | null }> = {}
      for (const p of profiles || []) {
        profileMap[p.id] = { username: p.username, display_name: p.display_name }
      }

      // Build member map — track raw counts + weighted score directly
      const memberMap: Record<string, { username: string; display_name: string | null; ratings: number; posts: number; comments: number; reactions: number; score: number }> = {}

      const ensureUser = (uid: string) => {
        if (!memberMap[uid]) {
          const p = profileMap[uid]
          memberMap[uid] = { username: p?.username || 'Unknown', display_name: p?.display_name || null, ratings: 0, posts: 0, comments: 0, reactions: 0, score: 0 }
        }
      }

      for (const r of ratings || []) {
        const beer = r.beers as { day_number?: number } | null
        ensureUser(r.user_id)
        memberMap[r.user_id].ratings++
        memberMap[r.user_id].score += 2 + (isSameDay(r.created_at, beer?.day_number) ? 1 : 0)
      }
      for (const r of posts || []) {
        const beer = r.beers as { day_number?: number } | null
        ensureUser(r.user_id)
        memberMap[r.user_id].posts++
        memberMap[r.user_id].score += 3 + (isSameDay(r.created_at, beer?.day_number) ? 1 : 0)
      }
      for (const r of comments || []) {
        const post = r.posts as { beers?: { day_number?: number } } | null
        ensureUser(r.user_id)
        memberMap[r.user_id].comments++
        memberMap[r.user_id].score += 2 + (isSameDay(r.created_at, post?.beers?.day_number) ? 1 : 0)
      }
      for (const r of reactions || []) {
        const post = r.posts as { beers?: { day_number?: number } } | null
        ensureUser(r.user_id)
        memberMap[r.user_id].reactions++
        memberMap[r.user_id].score += 1 + (isSameDay(r.created_at, post?.beers?.day_number) ? 1 : 0)
      }

      setMembers(
        Object.values(memberMap)
          .sort((a, b) => b.score - a.score)
      )

      // Beer stats (unchanged — by avg rating)
      const beerMap: Record<string, { total: number; count: number; name: string; brewery: string; day_number: number }> = {}
      for (const r of ratings || []) {
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav user={user} />

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Header */}
        <SectionDivider label="🏆 Rankings" />
        <h1 style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text)',
          fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          textAlign: 'center',
          marginBottom: '0.5rem',
          lineHeight: 1.1,
        }}>
          The Society Standings
        </h1>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.85rem',
          marginBottom: '2rem',
        }}>
          Who&apos;s drinking. What&apos;s winning.
        </p>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '1.75rem',
          gap: '4px',
        }}>
          {(['beers', 'members'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.8rem',
                letterSpacing: '0.1em',
                transition: 'all 0.15s',
                background: tab === t ? 'var(--gold)' : 'transparent',
                color: tab === t ? 'var(--bg)' : 'var(--text-muted)',
                fontWeight: tab === t ? 700 : 400,
              }}
            >
              {t === 'members' ? '👻 Members' : '🍺 Top Beers'}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <p style={{
            color: 'var(--gold)',
            fontFamily: "'Modern Antiqua', serif",
            textAlign: 'center',
            padding: '4rem 0',
          }}>
            Tallying the votes...
          </p>
        ) : tab === 'members' ? (
          !user ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem' }}>🐦‍⬛</div>
              <p style={{
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.6rem', letterSpacing: '0.5em',
                textTransform: 'uppercase', color: 'var(--gold)',
                marginBottom: '1rem',
              }}>Members Only</p>
              <p style={{
                color: 'var(--text)', fontFamily: "'Modern Antiqua', serif",
                fontSize: '1.1rem', marginBottom: '0.75rem', lineHeight: 1.4,
              }}>The rankings are sealed from outsiders.</p>
              <p style={{
                color: 'var(--text-muted)', fontSize: '0.85rem',
                lineHeight: 1.7, marginBottom: '2rem',
              }}>
                The ravens carry no word for the uninitiated. Only sworn members of the Hallowed Hop Society may witness who reigns atop the leaderboard.
              </p>
              <a href="/auth" style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                background: 'var(--gold)', color: 'var(--bg)',
                borderRadius: '10px',
                fontFamily: "'Modern Antiqua', serif",
                fontWeight: 700, fontSize: '0.875rem',
                letterSpacing: '0.1em', textDecoration: 'none',
              }}>Enter the Society</a>
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {members.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", padding: '3rem 0' }}>
                No ratings yet — the first pour awaits.
              </p>
            ) : members.map((m, i) => (
              <div key={m.username} style={{
                background: i === 0 ? 'rgba(255,140,0,0.07)' : 'var(--bg-card)',
                border: `1px solid ${i === 0 ? 'rgba(255,140,0,0.3)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '0.9rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                {/* Rank */}
                <span style={{ fontSize: '1.25rem', minWidth: '1.75rem', textAlign: 'center' }}>
                  {MEDALS[i] || (
                    <span style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, fontSize: '0.875rem' }}>
                      {i + 1}
                    </span>
                  )}
                </span>

                {/* Name + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: i === 0 ? 'var(--gold)' : 'var(--text)',
                    fontFamily: "'Modern Antiqua', serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {m.display_name || m.username}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: "'Modern Antiqua', serif" }}>
                    {m.ratings} rated · {m.posts} posts · {m.reactions} reactions
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>
                    {m.score}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: "'Modern Antiqua', serif", marginTop: '2px' }}>
                    pts
                  </div>
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {topBeers.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", padding: '3rem 0' }}>
                No beers rated yet.
              </p>
            ) : topBeers.map((b, i) => (
              <div key={b.name + b.day_number} style={{
                background: i === 0 ? 'rgba(255,140,0,0.07)' : 'var(--bg-card)',
                border: `1px solid ${i === 0 ? 'rgba(255,140,0,0.3)' : 'var(--border)'}`,
                borderRadius: '12px',
                padding: '0.9rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}>
                {/* Rank */}
                <span style={{ fontSize: '1.25rem', minWidth: '1.75rem', textAlign: 'center' }}>
                  {MEDALS[i] || (
                    <span style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, fontSize: '0.875rem' }}>
                      {i + 1}
                    </span>
                  )}
                </span>

                {/* Beer info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: i === 0 ? 'var(--gold)' : 'var(--text)',
                    fontFamily: "'Modern Antiqua', serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {b.name}
                  </div>
                  <div style={{ color: 'var(--gold)', fontSize: '0.75rem', fontFamily: "'Modern Antiqua', serif", opacity: 0.75 }}>
                    {b.brewery}{b.day_number ? ` · Day ${b.day_number}` : ''}
                  </div>
                </div>

                {/* Rating */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--gold)', fontSize: '1rem', lineHeight: 1 }}>
                    {'★'.repeat(Math.round(b.avg))}
                    <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - Math.round(b.avg))}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: "'Modern Antiqua', serif", marginTop: '2px' }}>
                    {b.avg}/5 · {b.count} {b.count === 1 ? 'rating' : 'ratings'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

