'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type FeedbackStatus = 'submitted' | 'backlog' | 'in_progress' | 'live'

interface FeedbackItem {
  id: string
  title: string
  description: string | null
  name: string | null
  email: string | null
  status: FeedbackStatus
  image_urls: string[]
  created_at: string
  updated_at: string
}

const COLUMNS: { key: FeedbackStatus; label: string; color: string; bg: string; border: string }[] = [
  { key: 'submitted',   label: 'Submitted',   color: '#a69d8d', bg: 'rgba(166,157,141,0.07)', border: 'rgba(166,157,141,0.2)' },
  { key: 'backlog',     label: 'Planned',     color: '#d97c2b', bg: 'rgba(217,124,43,0.08)',  border: 'rgba(217,124,43,0.25)'  },
  { key: 'in_progress', label: 'In Progress', color: '#e8953a', bg: 'rgba(232,149,58,0.08)',  border: 'rgba(232,149,58,0.28)'  },
  { key: 'live',        label: 'Live',        color: '#5fa65f', bg: 'rgba(95,166,95,0.07)',   border: 'rgba(95,166,95,0.2)'    },
]

const NEXT_STATUS: Record<FeedbackStatus, FeedbackStatus | null> = {
  submitted:   'backlog',
  backlog:     'in_progress',
  in_progress: 'live',
  live:        null,
}

const PREV_STATUS: Record<FeedbackStatus, FeedbackStatus | null> = {
  submitted:   null,
  backlog:     'submitted',
  in_progress: 'backlog',
  live:        'in_progress',
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

// ── Feedback card ─────────────────────────────────────────────────────────────
function FeedbackCard({
  item,
  token,
  onStatusChange,
}: {
  item: FeedbackItem
  token: string
  onStatusChange: (id: string, status: FeedbackStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const col = COLUMNS.find(c => c.key === item.status)!
  const prev = PREV_STATUS[item.status]
  const next = NEXT_STATUS[item.status]

  async function move(status: FeedbackStatus) {
    onStatusChange(item.id, status)
    await fetch(`/api/feedback?id=${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
  }

  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, marginBottom: 8,
      background: 'rgba(25,23,38,0.8)', border: `1px solid ${col.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: '#d9d8d2', lineHeight: 1.4,
            wordBreak: 'break-word' }}>
            {item.title}
          </p>
          {item.name && (
            <p style={{ fontSize: 11, color: '#7a7468', marginTop: 2 }}>— {item.name}</p>
          )}
          {item.email && (
            <p style={{ fontSize: 11, color: '#7a7468' }}>{item.email}</p>
          )}
          <p style={{ fontSize: 10, color: '#4a4560', marginTop: 3 }}>{formatDate(item.created_at)}</p>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ fontSize: 11, color: '#a69d8d', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(217,124,43,0.1)' }}>
          {item.description && (
            <p style={{ fontSize: 12, color: '#a69d8d', lineHeight: 1.5, marginBottom: 8 }}>
              {item.description}
            </p>
          )}

          {/* Images */}
          {item.image_urls && item.image_urls.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {item.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Attachment ${i+1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6,
                      border: '1px solid rgba(217,124,43,0.25)', cursor: 'pointer' }} />
                </a>
              ))}
            </div>
          )}

          {/* Move buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {prev && (
              <button
                onClick={() => move(prev)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(217,124,43,0.2)',
                  background: 'transparent', color: '#a69d8d', fontSize: 11, cursor: 'pointer' }}
              >
                ← {COLUMNS.find(c => c.key === prev)?.label}
              </button>
            )}
            {next && (
              <button
                onClick={() => move(next)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                  background: col.color, color: '#191726', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {COLUMNS.find(c => c.key === next)?.label} →
              </button>
            )}
          </div>

          {/* Direct status select */}
          <select
            value={item.status}
            onChange={e => move(e.target.value as FeedbackStatus)}
            style={{ marginTop: 6, width: '100%', padding: '6px 10px', borderRadius: 8,
              background: 'rgba(217,124,43,0.08)', border: '1px solid rgba(217,124,43,0.2)',
              color: '#d9d8d2', fontSize: 11, cursor: 'pointer', outline: 'none' }}
          >
            {COLUMNS.map(c => (
              <option key={c.key} value={c.key} style={{ background: '#201d30' }}>{c.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Main admin feedback page ──────────────────────────────────────────────────
export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsAdmin(true)
        setToken(data.session.access_token)
      }
      setAuthChecked(true)
    })
  }, [])

  const fetchItems = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/feedback')
      if (!res.ok) { setError('Failed to load feedback'); return }
      const data = await res.json()
      setItems(data.items ?? [])
    } catch {
      setError('Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authChecked) fetchItems()
  }, [authChecked, fetchItems])

  function handleStatusChange(id: string, status: FeedbackStatus) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  if (!authChecked) return null

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <p style={{ color: '#d97c2b', fontSize: 18, marginBottom: 12 }}>Admin access required</p>
          <Link href="/auth" style={{ color: '#a69d8d', fontSize: 14 }}>Sign in →</Link>
        </div>
      </div>
    )
  }

  const grouped = COLUMNS.reduce<Record<FeedbackStatus, FeedbackItem[]>>(
    (acc, c) => { acc[c.key] = items.filter(i => i.status === c.key); return acc },
    { submitted: [], backlog: [], in_progress: [], live: [] }
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', paddingBottom: '4rem' }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center',
        gap: 12, padding: '12px 20px', background: 'rgba(25,23,38,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(217,124,43,0.18)' }}>
        <Link href="/admin"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
            borderRadius: 8, color: '#a69d8d', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(217,124,43,0.18)', textDecoration: 'none', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
            fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d97c2b' }}>
            Admin · Feedback
          </span>
          <span style={{ fontSize: 11, color: '#7a7468', marginLeft: 8 }}>
            {items.length} total
          </span>
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['kanban', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: view === v ? '#d97c2b' : 'rgba(217,124,43,0.08)',
                color: view === v ? '#191726' : '#a69d8d',
                border: '1px solid rgba(217,124,43,0.2)',
                textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={fetchItems}
          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(217,124,43,0.2)', color: '#a69d8d' }}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#7a7468' }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#e87070' }}>{error}</div>
      ) : view === 'kanban' ? (
        /* ── Kanban view ── */
        <div style={{ padding: '20px 16px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 800 }}>
            {COLUMNS.map(col => (
              <div key={col.key} style={{ flex: '0 0 220px', minWidth: 220 }}>
                {/* Column header */}
                <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 10,
                  background: col.bg, border: `1px solid ${col.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
                      fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: col.color }}>
                      {col.label}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                      background: `${col.color}20`, color: col.color }}>
                      {grouped[col.key].length}
                    </span>
                  </div>
                </div>
                {/* Cards */}
                {grouped[col.key].length === 0 ? (
                  <div style={{ padding: '12px 0', textAlign: 'center', fontSize: 11, color: '#4a4560' }}>
                    Empty
                  </div>
                ) : (
                  grouped[col.key].map(item => (
                    <FeedbackCard key={item.id} item={item} token={token} onStatusChange={handleStatusChange} />
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── List view ── */
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
          {items.length === 0 ? (
            <p style={{ color: '#7a7468', textAlign: 'center', padding: 40 }}>No feedback yet.</p>
          ) : (
            items.map(item => (
              <div key={item.id} style={{ marginBottom: 12, padding: '14px 16px', borderRadius: 12,
                background: 'rgba(32,29,48,0.8)', border: '1px solid rgba(217,124,43,0.14)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#d9d8d2', marginBottom: 2 }}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p style={{ fontSize: 12, color: '#7a7468', lineHeight: 1.5, marginBottom: 4 }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: '#4a4560' }}>
                      {item.name && <span>— {item.name}</span>}
                      {item.email && <span>{item.email}</span>}
                      <span>{formatDate(item.created_at)}</span>
                      {item.image_urls?.length > 0 && <span>📎 {item.image_urls.length} image{item.image_urls.length > 1 ? 's' : ''}</span>}
                    </div>
                    {/* Images */}
                    {item.image_urls && item.image_urls.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        {item.image_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={`Attachment ${i+1}`}
                              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 5,
                                border: '1px solid rgba(217,124,43,0.25)' }} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Status badge + move */}
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                      background: `${COLUMNS.find(c => c.key === item.status)?.color}20`,
                      color: COLUMNS.find(c => c.key === item.status)?.color,
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {COLUMNS.find(c => c.key === item.status)?.label}
                    </span>
                    <select
                      value={item.status}
                      onChange={async e => {
                        const newStatus = e.target.value as FeedbackStatus
                        handleStatusChange(item.id, newStatus)
                        await fetch(`/api/feedback?id=${item.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ status: newStatus }),
                        })
                      }}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(217,124,43,0.08)', border: '1px solid rgba(217,124,43,0.2)',
                        color: '#d9d8d2', outline: 'none' }}
                    >
                      {COLUMNS.map(c => (
                        <option key={c.key} value={c.key} style={{ background: '#201d30' }}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
