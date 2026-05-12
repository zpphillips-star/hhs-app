'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type BreweryOutreach = {
  id: number
  brewery_name: string
  website: string | null
  email: string | null
  recommended_beer: string | null
  status: string
  notes: string | null
  last_updated: string
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'pending',          label: 'Pending',          color: '#4a4560' },
  { key: 'initial_send',     label: 'Initial Send',     color: '#2b4a6b' },
  { key: 'follow_up',        label: 'Follow Up',        color: '#5c4a1a' },
  { key: 'in_communication', label: 'In Communication', color: '#1a4a3a' },
  { key: 'agreed',           label: 'Agreed ✓',         color: '#1a3a1a' },
  { key: 'opted_out',        label: 'Opted Out',        color: '#3a1a1a' },
]

const STATUS_BADGE: Record<string, string> = {
  pending:          '#4a4560',
  initial_send:     '#2b4a6b',
  follow_up:        '#7a6020',
  in_communication: '#1a5a46',
  agreed:           '#1a5a1a',
  opted_out:        '#5a1a1a',
}

export default function KanbanPage() {
  const [rows, setRows] = useState<BreweryOutreach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('brewery_outreach')
      .select('*')
      .order('brewery_name')
    if (err) {
      setError(err.message)
    } else {
      setRows(data ?? [])
      setLastRefresh(new Date())
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const byStatus = (status: string) => rows.filter(r => r.status === status)

  const stats = {
    total:   rows.length,
    sent:    rows.filter(r => ['initial_send','follow_up','in_communication'].includes(r.status)).length,
    inTalks: rows.filter(r => r.status === 'in_communication').length,
    agreed:  rows.filter(r => r.status === 'agreed').length,
    optedOut:rows.filter(r => r.status === 'opted_out').length,
  }

  const startEdit = (row: BreweryOutreach) => {
    setEditingId(row.id)
    setEditNotes(row.notes ?? '')
    setEditStatus(row.status)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditNotes('')
    setEditStatus('')
  }

  const saveEdit = async (id: number) => {
    setSaving(true)
    const { error: err } = await supabase
      .from('brewery_outreach')
      .update({ notes: editNotes || null, status: editStatus })
      .eq('id', id)
    if (err) {
      alert('Save failed: ' + err.message)
    } else {
      setRows(prev => prev.map(r => r.id === id ? { ...r, notes: editNotes || null, status: editStatus } : r))
      setEditingId(null)
    }
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1008', color: '#e8dcc8', fontFamily: "'Modern Antiqua', Georgia, serif" }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(217,124,43,0.25)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ color: '#d97c2b', fontSize: '0.65rem', letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Hallowed Hop Society
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e8dcc8', letterSpacing: '0.05em', margin: 0 }}>
            Brewery Outreach Tracker
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastRefresh && (
            <span style={{ color: 'rgba(232,220,200,0.4)', fontSize: '0.75rem' }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid #d97c2b',
              color: '#d97c2b',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              letterSpacing: '0.1em',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(217,124,43,0.15)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Breweries', value: stats.total, color: '#e8dcc8' },
          { label: 'Contacted',       value: stats.sent,    color: '#6ba3d4' },
          { label: 'In Talks',        value: stats.inTalks, color: '#4aad8a' },
          { label: 'Agreed',          value: stats.agreed,  color: '#d97c2b' },
          { label: 'Opted Out',       value: stats.optedOut,color: '#a05050' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', minWidth: '80px' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(232,220,200,0.5)', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ margin: '1rem 2rem', padding: '0.75rem 1rem', background: 'rgba(160,50,50,0.3)', border: '1px solid rgba(160,50,50,0.5)', borderRadius: '8px', color: '#e8a0a0', fontSize: '0.9rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* Kanban board */}
      <div style={{ padding: '1.5rem 1rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '1rem', minWidth: 'max-content', alignItems: 'flex-start' }}>
          {COLUMNS.map(col => {
            const cards = byStatus(col.key)
            return (
              <div key={col.key} style={{ width: '220px', flexShrink: 0 }}>
                {/* Column header */}
                <div style={{
                  background: col.color,
                  borderRadius: '10px 10px 0 0',
                  padding: '0.6rem 0.875rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e8dcc8' }}>
                    {col.label}
                  </span>
                  <span style={{ background: 'rgba(0,0,0,0.35)', color: '#e8dcc8', fontSize: '0.7rem', fontWeight: 700, borderRadius: '10px', padding: '0.1rem 0.5rem', minWidth: '22px', textAlign: 'center' }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(217,124,43,0.12)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  padding: '0.5rem',
                  minHeight: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  {cards.map(row => (
                    <div
                      key={row.id}
                      style={{
                        background: '#21180e',
                        border: '1px solid rgba(217,124,43,0.18)',
                        borderRadius: '8px',
                        padding: '0.625rem 0.75rem',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(217,124,43,0.5)'
                        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 12px rgba(217,124,43,0.1)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(217,124,43,0.18)'
                        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                      }}
                      onClick={() => editingId === row.id ? cancelEdit() : startEdit(row)}
                    >
                      {editingId === row.id ? (
                        /* Edit mode */
                        <div onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#d97c2b', marginBottom: '0.5rem' }}>
                            {row.brewery_name}
                          </div>
                          <label style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,220,200,0.5)', display: 'block', marginBottom: '0.2rem' }}>
                            Status
                          </label>
                          <select
                            value={editStatus}
                            onChange={e => setEditStatus(e.target.value)}
                            style={{
                              width: '100%',
                              background: '#2a1f10',
                              border: '1px solid rgba(217,124,43,0.4)',
                              color: '#e8dcc8',
                              borderRadius: '6px',
                              padding: '0.3rem 0.4rem',
                              fontSize: '0.75rem',
                              marginBottom: '0.5rem',
                              fontFamily: 'inherit',
                            }}
                          >
                            {COLUMNS.map(c => (
                              <option key={c.key} value={c.key}>{c.label.replace(' ✓','')}</option>
                            ))}
                          </select>
                          <label style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(232,220,200,0.5)', display: 'block', marginBottom: '0.2rem' }}>
                            Notes
                          </label>
                          <textarea
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            rows={3}
                            placeholder="Add notes…"
                            style={{
                              width: '100%',
                              background: '#2a1f10',
                              border: '1px solid rgba(217,124,43,0.4)',
                              color: '#e8dcc8',
                              borderRadius: '6px',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              marginBottom: '0.5rem',
                            }}
                          />
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => saveEdit(row.id)}
                              disabled={saving}
                              style={{
                                flex: 1,
                                background: '#d97c2b',
                                border: 'none',
                                color: '#1a1008',
                                borderRadius: '6px',
                                padding: '0.3rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              {saving ? '…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                flex: 1,
                                background: 'transparent',
                                border: '1px solid rgba(232,220,200,0.2)',
                                color: 'rgba(232,220,200,0.5)',
                                borderRadius: '6px',
                                padding: '0.3rem',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e8dcc8', lineHeight: 1.3, marginBottom: '0.3rem' }}>
                            {row.brewery_name}
                          </div>
                          {row.recommended_beer && (
                            <div style={{ fontSize: '0.68rem', color: '#d97c2b', marginBottom: row.notes ? '0.35rem' : 0 }}>
                              🍺 {row.recommended_beer}
                            </div>
                          )}
                          {row.notes && (
                            <div style={{
                              fontSize: '0.68rem',
                              color: 'rgba(232,220,200,0.55)',
                              lineHeight: 1.5,
                              borderTop: '1px solid rgba(217,124,43,0.1)',
                              paddingTop: '0.3rem',
                              marginTop: '0.1rem',
                            }}>
                              {row.notes}
                            </div>
                          )}
                          {row.website && (
                            <a
                              href={`https://${row.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ fontSize: '0.62rem', color: 'rgba(217,124,43,0.5)', display: 'block', marginTop: '0.35rem', textDecoration: 'none' }}
                            >
                              ↗ {row.website}
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {cards.length === 0 && (
                    <div style={{ color: 'rgba(232,220,200,0.2)', fontSize: '0.72rem', textAlign: 'center', padding: '1.5rem 0.5rem', fontStyle: 'italic' }}>
                      No breweries here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid rgba(217,124,43,0.1)', color: 'rgba(232,220,200,0.3)', fontSize: '0.7rem', letterSpacing: '0.1em', textAlign: 'center' }}>
        Click any card to edit status &amp; notes · Changes save directly to Supabase
      </div>
    </div>
  )
}
