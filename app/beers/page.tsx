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

  // Calculate what day of week Oct 1 falls on this year
  const year = today.getFullYear()
  const oct1DayOfWeek = new Date(year, 9, 1).getDay() // 0=Sun, 6=Sat

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Build calendar grid cells: empty slots before Oct 1, then 31 days
  const calendarCells: (number | null)[] = [
    ...Array(oct1DayOfWeek).fill(null),
    ...slots,
  ]
  // Pad to complete last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const headerStyle = {
    fontFamily: "'Modern Antiqua', serif",
    color: 'var(--text)',
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    fontWeight: 900,
    lineHeight: 1.1,
    marginBottom: '0.4rem',
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Nav user={user} />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 2rem' }}>

        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={headerStyle}>31 Beers of October</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
            {beers.length} of 31 beers entered
          </p>
        </div>

        {loading ? (
          <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", textAlign: 'center', padding: '3rem 0' }}>
            Loading the sacred list...
          </p>
        ) : (
          <>
            {/* ── CALENDAR VIEW (desktop) ── */}
            <div className="hhs-calendar-view">
              {/* Month header */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--gold)', fontSize: '1.1rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                  October {year}
                </span>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                {dayHeaders.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', color: 'var(--gold)', textTransform: 'uppercase', padding: '0.4rem 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {calendarCells.map((day, idx) => {
                  if (!day) return (
                    <div key={`empty-${idx}`} style={{ background: 'transparent', minHeight: '100px', borderRadius: '10px' }} />
                  )
                  const beer = beerMap[day]
                  const isToday = day === todayDay
                  const isPast = todayDay ? day < todayDay : false

                  return (
                    <div key={day} style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: '10px',
                      padding: '0.6rem',
                      minHeight: '100px',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: isToday ? '0 0 0 1px var(--gold)' : 'none',
                      opacity: isPast && !isToday ? 0.6 : 1,
                    }}>
                      {/* Day number */}
                      <div style={{
                        fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: isToday ? 'var(--gold)' : 'var(--text)',
                        marginBottom: '0.35rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span>{day}</span>
                        {isToday && (
                          <span style={{ background: 'var(--gold)', color: 'var(--bg)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', padding: '0.1rem 0.4rem', borderRadius: '999px' }}>
                            TODAY
                          </span>
                        )}
                      </div>

                      {beer ? (
                        <>
                          <div style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Modern Antiqua', serif", lineHeight: 1.3, marginBottom: '0.2rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {beer.name}
                          </div>
                          <div style={{ color: 'var(--gold)', fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {beer.brewery}
                          </div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic', marginTop: 'auto' }}>
                          To be revealed...
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── LIST VIEW (mobile) ── */}
            <div className="hhs-list-view">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {slots.map(day => {
                  const beer = beerMap[day]
                  const isToday = day === todayDay
                  const isPast = todayDay ? day < todayDay : false

                  return (
                    <div key={day} style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      boxShadow: isToday ? '0 0 0 1px var(--gold)' : 'none',
                      opacity: isPast && !isToday ? 0.65 : 1,
                    }}>
                      <div style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '1.25rem', fontWeight: 700, width: '2rem', textAlign: 'center', flexShrink: 0, color: isToday ? 'var(--gold)' : isPast ? 'var(--text-muted)' : 'var(--border)' }}>
                        {day}
                      </div>
                      {beer ? (
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text)', fontWeight: 600, fontFamily: "'Modern Antiqua', serif", fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {beer.name}
                          </div>
                          <div style={{ color: 'var(--gold)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {beer.brewery}
                          </div>
                          {(beer.style || beer.abv) && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {beer.style}{beer.style && beer.abv ? ' · ' : ''}{beer.abv ? `${beer.abv}% ABV` : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ flex: 1, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                          To be revealed...
                        </div>
                      )}
                      {isToday && (
                        <span style={{ background: 'var(--gold)', color: 'var(--bg)', fontSize: '0.65rem', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, letterSpacing: '0.1em', padding: '0.25rem 0.6rem', borderRadius: '999px', flexShrink: 0 }}>
                          TODAY
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

