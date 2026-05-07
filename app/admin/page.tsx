'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer } from '@/lib/types'
import Nav from '@/components/Nav'

type MemberRequest = {
  id: string
  first_name: string
  last_name: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

type NotificationLog = {
  id: string
  title: string
  body: string
  total_sent: number
  sent_at: string
  opens: number
}

type NotifDetail = {
  opened: { id: string; name: string }[]
  notOpened: { id: string; name: string }[]
}

export default function AdminPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [beers, setBeers] = useState<Beer[]>([])
  const [dayNumber, setDayNumber] = useState(1)
  const [name, setName] = useState('')
  const [brewery, setBrewery] = useState('')
  const [style, setStyle] = useState('')
  const [abv, setAbv] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [requests, setRequests] = useState<MemberRequest[]>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewMsg, setReviewMsg] = useState<Record<string, string>>({})
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastBody, setBroadcastBody] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState('')
  const [notifHistory, setNotifHistory] = useState<NotificationLog[]>([])
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null)
  const [notifDetail, setNotifDetail] = useState<Record<string, NotifDetail>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    fetchBeers()
    fetchRequests()
    fetchNotifHistory()
  }, [])

  const fetchBeers = async () => {
    const { data } = await supabase.from('beers').select('*').order('day_number')
    setBeers(data || [])
  }

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('member_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  const fetchNotifHistory = async () => {
    const { data: logs } = await supabase
      .from('notification_log')
      .select('id, title, body, total_sent, sent_at')
      .order('sent_at', { ascending: false })
      .limit(20)

    if (!logs) return

    // Fetch open counts for each notification
    const { data: opens } = await supabase
      .from('notification_opens')
      .select('notification_id')

    const openCounts: Record<string, number> = {}
    for (const o of (opens || [])) {
      openCounts[o.notification_id] = (openCounts[o.notification_id] || 0) + 1
    }

    setNotifHistory(logs.map(l => ({ ...l, opens: openCounts[l.id] || 0 })))
  }

  const toggleNotifDetail = async (notifId: string) => {
    // Collapse if already open
    if (expandedNotif === notifId) {
      setExpandedNotif(null)
      return
    }
    setExpandedNotif(notifId)

    // Already loaded? Don't refetch
    if (notifDetail[notifId]) return

    // All approved members
    const { data: members } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username')
      .eq('status', 'approved')

    // Who opened this notification
    const { data: opens } = await supabase
      .from('notification_opens')
      .select('user_id')
      .eq('notification_id', notifId)

    const openedIds = new Set((opens || []).map(o => o.user_id).filter(Boolean))

    const allMembers = (members || []).map(m => ({
      id: m.id,
      name: m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username,
    }))

    setNotifDetail(prev => ({
      ...prev,
      [notifId]: {
        opened: allMembers.filter(m => openedIds.has(m.id)),
        notOpened: allMembers.filter(m => !openedIds.has(m.id)),
      },
    }))
  }

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setReviewingId(requestId)
    try {
      const res = await fetch('/api/approve-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
        },
        body: JSON.stringify({ request_id: requestId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReviewMsg(prev => ({ ...prev, [requestId]: `Error: ${data.error}` }))
      } else {
        setReviewMsg(prev => ({ ...prev, [requestId]: action === 'approve' ? '✅ Approved — invite sent' : '✗ Rejected' }))
        fetchRequests()
      }
    } catch {
      setReviewMsg(prev => ({ ...prev, [requestId]: 'Something went wrong.' }))
    }
    setReviewingId(null)
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setBroadcasting(true)
    setBroadcastResult('')
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
        },
        body: JSON.stringify({ title: broadcastTitle, body: broadcastBody }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastResult(`Error: ${data.error}`)
      else {
        setBroadcastResult(`✅ Sent to ${data.sent} member${data.sent !== 1 ? 's' : ''}`)
        setBroadcastTitle('')
        setBroadcastBody('')
        fetchNotifHistory()
      }
    } catch {
      setBroadcastResult('Something went wrong.')
    }
    setBroadcasting(false)
  }

  const loadBeerForEdit = (beer: Beer) => {
    setDayNumber(beer.day_number)
    setName(beer.name)
    setBrewery(beer.brewery)
    setStyle(beer.style || '')
    setAbv(beer.abv?.toString() || '')
    setDescription(beer.description || '')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('beers').upsert({
      day_number: dayNumber,
      name,
      brewery,
      style: style || null,
      abv: abv ? parseFloat(abv) : null,
      description: description || null,
    }, { onConflict: 'day_number' })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage(`✅ Day ${dayNumber} saved!`)
      setName('')
      setBrewery('')
      setStyle('')
      setAbv('')
      setDescription('')
      await fetchBeers()
    }

    setSaving(false)
  }

  const deleteBeer = async (id: string, dayNum: number) => {
    if (!confirm(`Delete Day ${dayNum} beer?`)) return
    await supabase.from('beers').delete().eq('id', id)
    fetchBeers()
  }

  return (
    <div className="min-h-screen bg-[#0d0b0f]">
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-orange-400">⚙️ Admin — Manage Beers</h1>
          <span className="text-sm text-gray-500">{beers.length}/31 entered</span>
        </div>

        {/* Add / Edit form */}
        <div className="bg-[#1a1520] border border-purple-900/60 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Add or Edit Beer</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Day Number *</label>
                <input
                  type="number" min={1} max={31}
                  value={dayNumber}
                  onChange={e => setDayNumber(parseInt(e.target.value))}
                  required
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">ABV %</label>
                <input
                  type="number" step="0.1" min="0" max="20"
                  value={abv}
                  onChange={e => setAbv(e.target.value)}
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="5.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Beer Name *</label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Pumpkin Spice Stout"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Brewery *</label>
              <input
                type="text" value={brewery}
                onChange={e => setBrewery(e.target.value)}
                required
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Haunted Brewing Co."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Style</label>
              <input
                type="text" value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Imperial Stout"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                placeholder="Dark, rich, and dangerously drinkable..."
              />
            </div>

            {message && (
              <p className={`text-sm ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : `Save Day ${dayNumber}`}
            </button>
          </form>
        </div>

        {/* Beer list */}
        <h2 className="text-lg font-semibold text-white mb-3">Entered Beers</h2>
        {beers.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No beers entered yet. Add your first one above.</p>
        ) : (
          <div className="space-y-2">
            {beers.map(beer => (
              <div key={beer.id} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-orange-400 font-bold w-7 text-center text-sm shrink-0">{beer.day_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{beer.name}</div>
                  <div className="text-gray-500 text-xs">{beer.brewery}{beer.style ? ` · ${beer.style}` : ''}{beer.abv ? ` · ${beer.abv}%` : ''}</div>
                </div>
                <button
                  onClick={() => loadBeerForEdit(beer)}
                  className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteBeer(beer.id, beer.day_number)}
                  className="text-xs text-red-500 hover:text-red-400 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Membership Requests */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Membership Requests</h2>
            <span className="text-sm text-gray-500">
              {requests.filter(r => r.status === 'pending').length} pending
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No membership requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">
                        {req.first_name} {req.last_name}
                      </div>
                      <div className="text-gray-500 text-xs">{req.email}</div>
                      <div className="text-gray-600 text-xs mt-0.5">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleReview(req.id, 'approve')}
                            disabled={reviewingId === req.id}
                            className="text-xs bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {reviewingId === req.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReview(req.id, 'reject')}
                            disabled={reviewingId === req.id}
                            className="text-xs bg-red-500/10 hover:bg-red-500/30 text-red-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-medium ${req.status === 'approved' ? 'text-green-500' : 'text-gray-500'}`}>
                          {req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                  {reviewMsg[req.id] && (
                    <p className="text-xs mt-2 text-gray-400">{reviewMsg[req.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcast Notification */}
        <div className="mt-12 mb-12">
          <h2 className="text-lg font-semibold text-white mb-4">Send Notification</h2>
          <div className="bg-[#1a1520] border border-purple-900/60 rounded-2xl p-6">
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Title</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  required
                  placeholder="e.g. Beer order update"
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Message</label>
                <textarea
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Your beer box ships Friday. Keep an eye out."
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              {broadcastResult && (
                <p className={`text-sm ${broadcastResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {broadcastResult}
                </p>
              )}
              <button
                type="submit"
                disabled={broadcasting}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2.5 rounded-lg transition-colors text-sm"
              >
                {broadcasting ? 'Sending...' : 'Send to All Members'}
              </button>
            </form>
          </div>

          {/* Notification History */}
          {notifHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sent History</h3>
              <div className="space-y-2">
                {notifHistory.map(n => (
                  <div key={n.id} className="bg-[#0d0b0f] border border-purple-900/40 rounded-xl overflow-hidden">
                    {/* Row — tap to expand */}
                    <button
                      onClick={() => toggleNotifDetail(n.id)}
                      className="w-full px-4 py-3 flex items-start justify-between gap-4 text-left hover:bg-purple-900/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{n.title}</p>
                        <p className="text-gray-400 text-xs truncate mt-0.5">{n.body}</p>
                        <p className="text-gray-600 text-xs mt-1">
                          {new Date(n.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-orange-400 text-sm font-bold">{n.opens} opened</p>
                        <p className="text-gray-500 text-xs">{n.total_sent} sent</p>
                        {n.total_sent > 0 && (
                          <p className="text-gray-600 text-xs">{Math.round((n.opens / n.total_sent) * 100)}%</p>
                        )}
                        <p className="text-purple-600 text-xs mt-1">{expandedNotif === n.id ? '▲' : '▼'}</p>
                      </div>
                    </button>

                    {/* Expanded breakdown */}
                    {expandedNotif === n.id && (
                      <div className="border-t border-purple-900/30 px-4 py-3 grid grid-cols-2 gap-4">
                        {!notifDetail[n.id] ? (
                          <p className="col-span-2 text-gray-500 text-xs text-center py-2">Loading...</p>
                        ) : (
                          <>
                            <div>
                              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                Opened ({notifDetail[n.id].opened.length})
                              </p>
                              {notifDetail[n.id].opened.length === 0 ? (
                                <p className="text-gray-600 text-xs">—</p>
                              ) : (
                                <ul className="space-y-1">
                                  {notifDetail[n.id].opened.map(m => (
                                    <li key={m.id} className="text-gray-300 text-xs">{m.name}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                Not Opened ({notifDetail[n.id].notOpened.length})
                              </p>
                              {notifDetail[n.id].notOpened.length === 0 ? (
                                <p className="text-gray-600 text-xs">Everyone opened it</p>
                              ) : (
                                <ul className="space-y-1">
                                  {notifDetail[n.id].notOpened.map(m => (
                                    <li key={m.id} className="text-gray-300 text-xs">{m.name}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

