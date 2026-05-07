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

type Member = {
  id: string
  first_name: string | null
  last_name: string | null
  username: string
  status: string
  created_at: string
  has_notifications: boolean
  has_pwa: boolean
  tier: string | null
  tier_selected_at: string | null
  venmo_clicked_at: string | null
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
  const [broadcastDayNumber, setBroadcastDayNumber] = useState<string>('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState('')
  const [notifHistory, setNotifHistory] = useState<NotificationLog[]>([])
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null)
  const [notifDetail, setNotifDetail] = useState<Record<string, NotifDetail>>({})
  const [members, setMembers] = useState<Member[]>([])
  const [tierSelectionOpen, setTierSelectionOpen] = useState(false)
  const [togglingTier, setTogglingTier] = useState(false)

  const [myNotifStatus, setMyNotifStatus] = useState<NotificationPermission | null>(null)
  const [enablingNotif, setEnablingNotif] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    fetchBeers()
    fetchRequests()
    fetchNotifHistory()
    fetchMembers()
    fetchTierStatus()
    if ('Notification' in window) setMyNotifStatus(Notification.permission)
  }, [])

  const enableMyNotifications = async () => {
    if (!user) return
    setEnablingNotif(true)
    try {
      const perm = await Notification.requestPermission()
      setMyNotifStatus(perm)
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        })
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), user_id: user.id }),
        })
        fetchMembers() // refresh the table
      }
    } catch (e) {
      console.error(e)
    }
    setEnablingNotif(false)
  }

  const fetchTierStatus = async () => {
    const { data } = await supabase.from('app_settings').select('tier_selection_open').eq('id', 1).single()
    setTierSelectionOpen(data?.tier_selection_open ?? false)
  }

  const toggleTierSelection = async () => {
    setTogglingTier(true)
    const newVal = !tierSelectionOpen
    await supabase.from('app_settings').update({ tier_selection_open: newVal }).eq('id', 1)
    setTierSelectionOpen(newVal)
    setTogglingTier(false)
  }

  const fetchMembers = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, username, status, created_at, has_pwa, tier, tier_selected_at, venmo_clicked_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id')

    const subSet = new Set((subs || []).map(s => s.user_id))

    setMembers((profiles || []).map(p => ({
      ...p,
      has_notifications: subSet.has(p.id),
      has_pwa: p.has_pwa || false,
      tier: p.tier || null,
      tier_selected_at: p.tier_selected_at || null,
      venmo_clicked_at: p.venmo_clicked_at || null,
    })))
  }

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
      const dayNum = broadcastDayNumber ? parseInt(broadcastDayNumber) : undefined
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          body: broadcastBody,
          ...(dayNum !== undefined && { day_number: dayNum }),
        }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastResult(`Error: ${data.error}`)
      else {
        const tierNote = dayNum !== undefined
          ? (dayNum % 2 !== 0 ? ' (Hallowed + Odd Balls)' : ' (Hallowed only)')
          : ' (everyone)'
        setBroadcastResult(`✅ Sent to ${data.sent} member${data.sent !== 1 ? 's' : ''}${tierNote}`)
        setBroadcastTitle('')
        setBroadcastBody('')
        setBroadcastDayNumber('')
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

        {/* Notification setup banner for admin */}
        {myNotifStatus !== 'granted' && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-yellow-600/40 bg-yellow-500/10 flex items-center justify-between gap-4">
            <div>
              <p className="text-yellow-400 text-sm font-semibold">🔔 You haven&apos;t enabled notifications</p>
              <p className="text-gray-400 text-xs mt-0.5">
                {myNotifStatus === 'denied'
                  ? 'Blocked in browser — go to Settings → Safari/Chrome → Notifications → allow hallowedhopsociety.com'
                  : 'Enable them so you receive test notifications too'}
              </p>
            </div>
            {myNotifStatus !== 'denied' && (
              <button
                onClick={enableMyNotifications}
                disabled={enablingNotif}
                className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 transition-colors"
              >
                {enablingNotif ? '...' : 'Enable'}
              </button>
            )}
          </div>
        )}

        {/* Members Roster */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Members</h2>
            <span className="text-sm text-gray-500">{members.length} approved</span>
          </div>

          {/* Tier Selection Control */}
          <div className={`mb-4 px-4 py-3 rounded-xl border flex items-center justify-between ${tierSelectionOpen ? 'bg-orange-500/10 border-orange-500/40' : 'bg-[#1a1520] border-purple-900/40'}`}>
            <div>
              <p className="text-white text-sm font-medium">Tier Selection</p>
              <p className="text-gray-500 text-xs">
                {tierSelectionOpen
                  ? 'Open — members will see the tier picker when they open the app'
                  : 'Closed — members see nothing until you open this'}
              </p>
            </div>
            <button
              onClick={toggleTierSelection}
              disabled={togglingTier}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${tierSelectionOpen
                ? 'bg-orange-500/20 hover:bg-orange-500/40 text-orange-400'
                : 'bg-purple-900/40 hover:bg-purple-900/60 text-purple-300'
              }`}
            >
              {togglingTier ? '...' : tierSelectionOpen ? 'Close' : 'Open'}
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No approved members yet.</p>
          ) : (
            <div className="bg-[#1a1520] border border-purple-900/40 rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-b border-purple-900/30">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Member</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider text-center w-8">Notifs</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider text-center w-8">PWA</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider text-center w-20">Tier</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider text-center w-14">Venmo</span>
              </div>
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-3 items-center ${i < members.length - 1 ? 'border-b border-purple-900/20' : ''}`}
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      {m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username}
                    </p>
                    <p className="text-gray-500 text-xs">@{m.username}</p>
                  </div>
                  <div className="text-center w-8" title="Push notifications enabled">
                    {m.has_notifications ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}
                  </div>
                  <div className="text-center w-8" title="App installed on home screen">
                    {m.has_pwa ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}
                  </div>
                  <div className="text-center w-20">
                    {m.tier
                      ? <span className={`text-xs font-semibold px-2 py-0.5 rounded ${m.tier === 'hallowed' ? 'bg-orange-500/20 text-orange-400' : 'bg-purple-500/20 text-purple-300'}`}>
                          {m.tier === 'hallowed' ? 'Hallowed' : 'Odd Balls'}
                        </span>
                      : <span className="text-gray-600 text-xs">—</span>
                    }
                  </div>
                  <div className="text-center w-14">
                    {m.venmo_clicked_at
                      ? <span className="text-green-400 text-xs">✓ sent</span>
                      : m.tier
                        ? <span className="text-yellow-600 text-xs">pending</span>
                        : <span className="text-gray-600 text-xs">—</span>
                    }
                  </div>
                </div>
              ))}
              {/* Summary row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2 border-t border-purple-900/30 bg-[#0d0b0f]/50">
                <span className="text-xs text-gray-500">{members.length} total</span>
                <span className="text-xs text-orange-400 text-center w-8">{members.filter(m => m.has_notifications).length}/{members.length}</span>
                <span className="text-xs text-orange-400 text-center w-8">{members.filter(m => m.has_pwa).length}/{members.length}</span>
                <span className="text-xs text-orange-400 text-center w-20">{members.filter(m => m.tier).length}/{members.length}</span>
                <span className="text-xs text-green-400 text-center w-14">{members.filter(m => m.venmo_clicked_at).length}/{members.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Membership Requests */}
        <div className="mb-8">
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
        <div className="mb-12">
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
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">
                  Day # <span className="normal-case text-gray-600">(optional — routes to correct tier)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={broadcastDayNumber}
                  onChange={e => setBroadcastDayNumber(e.target.value)}
                  placeholder="Leave blank to send to everyone"
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                />
                {broadcastDayNumber && (
                  <p className="text-xs mt-1.5 text-orange-400/80">
                    {parseInt(broadcastDayNumber) % 2 !== 0
                      ? '→ Odd day — sends to Hallowed (all) + Odd Balls'
                      : '→ Even day — sends to Hallowed only'}
                  </p>
                )}
                {!broadcastDayNumber && (
                  <p className="text-xs mt-1.5 text-gray-600">→ No day # — sends to all members</p>
                )}
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
                {broadcasting ? 'Sending...' : broadcastDayNumber
                  ? `Send — Day ${broadcastDayNumber} (${parseInt(broadcastDayNumber) % 2 !== 0 ? 'Hallowed + Odd Balls' : 'Hallowed only'})`
                  : 'Send to All Members'}
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

      </main>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

