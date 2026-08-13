'use client'

import { useEffect, useState, type CSSProperties } from 'react'
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
  email: string | null
  auth_email: string | null
  status: string
  created_at: string
  has_notifications: boolean
  has_pwa: boolean
  tier: string | null
  tier_selected_at: string | null
  venmo_clicked_at: string | null
  native_membership_amount: number | null
  payment_review_status: PaymentReviewStatus | null
  payment_confirmed_at: string | null
  native_source: string | null
  setup_override_at: string | null
  setup_override_by: string | null
}

type MemberProfileRow = Omit<Member, 'auth_email' | 'has_notifications' | 'has_pwa' | 'payment_review_status' | 'payment_confirmed_at'> & {
  has_pwa: boolean | null
  payment_review_status?: PaymentReviewStatus | null
  payment_confirmed_at?: string | null
}

type PaymentReviewStatus = 'paid' | 'not_paid' | 'not_reviewed'
type AdminPaymentState = 'paid' | 'not_paid' | 'not_reviewed'

const MEMBER_ROSTER_GRID_STYLE: CSSProperties = {
  gridTemplateColumns: 'minmax(0, 1fr) 3rem 3rem 5.75rem 7rem 4rem 7rem 12rem',
}

function getAdminPaymentState(member: Member): AdminPaymentState {
  if (member.payment_review_status === 'paid' || member.payment_confirmed_at) return 'paid'
  if (member.payment_review_status === 'not_paid') return 'not_paid'
  return 'not_reviewed'
}

function getAdminPaymentCopy(member: Member) {
  const state = getAdminPaymentState(member)
  if (state === 'paid') {
    return {
      label: 'paid',
      color: '#4ade80',
      title: member.payment_confirmed_at ? `Confirmed: ${new Date(member.payment_confirmed_at).toLocaleDateString()}` : 'Marked paid by Zach',
    }
  }
  if (state === 'not_reviewed') {
    return {
      label: 'not reviewed',
      color: 'var(--gold)',
      title: member.venmo_clicked_at
        ? `Venmo opened: ${new Date(member.venmo_clicked_at).toLocaleDateString()}`
        : 'Payment has not been reviewed yet',
    }
  }
  return {
    label: 'not paid',
    color: '#fca5a5',
    title: member.payment_review_status === 'not_paid'
      ? 'Zach reviewed and did not receive payment'
      : 'Payment has not been received',
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
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
  const [broadcastTiers, setBroadcastTiers] = useState<string[]>(['hallowed', 'oddballs']) // default: everyone
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState('')
  const [notifHistory, setNotifHistory] = useState<NotificationLog[]>([])
  const [expandedNotif, setExpandedNotif] = useState<string | null>(null)
  const [notifDetail, setNotifDetail] = useState<Record<string, NotifDetail>>({})
  const [members, setMembers] = useState<Member[]>([])
  const [confirmingPaidId, setConfirmingPaidId] = useState<string | null>(null)
  const [updatingOverrideId, setUpdatingOverrideId] = useState<string | null>(null)
  const [tierSelectionOpen, setTierSelectionOpen] = useState(false)
  const [togglingTier, setTogglingTier] = useState(false)

  const [myNotifStatus, setMyNotifStatus] = useState<NotificationPermission | null>(null)
  const [enablingNotif, setEnablingNotif] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(() => {
      supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
      fetchBeers()
      fetchRequests()
      fetchNotifHistory()
      fetchMembers()
      fetchTierStatus()
      if ('Notification' in window) setMyNotifStatus(Notification.permission)
    })
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
          headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
          body: JSON.stringify({ subscription: sub.toJSON(), user_id: user.id }),
        })
        fetchMembers() // refresh the table
      }
    } catch (e) {
      console.error(e)
    }
    setEnablingNotif(false)
  }

  async function fetchTierStatus() {
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

  async function fetchMembers() {
    const memberSelect = 'id, first_name, last_name, username, email, status, created_at, has_pwa, tier, tier_selected_at, venmo_clicked_at, native_membership_amount, payment_review_status, payment_confirmed_at, native_source, setup_override_at, setup_override_by'
    const fallbackMemberSelect = 'id, first_name, last_name, username, email, status, created_at, has_pwa, tier, tier_selected_at, venmo_clicked_at, native_membership_amount, native_source'
    const profilesResult = await supabase
      .from('profiles')
      .select(memberSelect)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
    let profiles = profilesResult.data as MemberProfileRow[] | null
    let profilesError = profilesResult.error
    if (profilesError && /payment_review_status|payment_confirmed_at|setup_override_at|setup_override_by/i.test(profilesError.message)) {
      const fallback = await supabase
        .from('profiles')
        .select(fallbackMemberSelect)
        .eq('status', 'approved')
        .order('created_at', { ascending: true })
      profiles = fallback.data as MemberProfileRow[] | null
      profilesError = fallback.error
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id')

    const subSet = new Set((subs || []).map(s => s.user_id))

    const profileRows = profiles || []
    let authEmailById = new Map<string, string>()
    if (profileRows.length) {
      const emailRes = await fetch('/api/admin/member-auth-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ member_ids: profileRows.map(p => p.id) }),
      })
      if (emailRes.ok) {
        const emailJson = await emailRes.json().catch(() => null) as { emails?: Record<string, string | null> } | null
        authEmailById = new Map(
          Object.entries(emailJson?.emails || {})
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
        )
      }
    }

    setMembers(profileRows.map(p => ({
      ...p,
      has_notifications: subSet.has(p.id),
      has_pwa: p.has_pwa || false,
      email: p.email || null,
      auth_email: authEmailById.get(p.id) || null,
      tier: p.tier || null,
      tier_selected_at: p.tier_selected_at || null,
      venmo_clicked_at: p.venmo_clicked_at || null,
      native_membership_amount: p.native_membership_amount || null,
      payment_review_status: 'payment_review_status' in p ? p.payment_review_status || null : null,
      payment_confirmed_at: 'payment_confirmed_at' in p ? p.payment_confirmed_at || null : null,
      native_source: p.native_source || null,
      setup_override_at: 'setup_override_at' in p ? p.setup_override_at || null : null,
      setup_override_by: 'setup_override_by' in p ? p.setup_override_by || null : null,
    })))
  }

  const updateSetupOverride = async (member: Member, action: 'enable' | 'disable') => {
    const memberName = member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username
    const memberIdentifier = member.auth_email || member.email || `@${member.username}`
    const prompt = action === 'enable'
      ? `Let ${memberName} (${memberIdentifier}) into HHS now? This bypasses the setup checklist for this member only.`
      : `Remove the entry override for ${memberName} (${memberIdentifier})? They will need to complete the normal setup checklist before entering.`
    if (!confirm(prompt)) return
    setUpdatingOverrideId(member.id)
    try {
      const res = await fetch('/api/admin/setup-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ member_id: member.id, action }),
      })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        alert(json.error || 'Could not update entry access.')
      } else {
        await fetchMembers()
      }
    } finally {
      setUpdatingOverrideId(null)
    }
  }

  const updatePaymentConfirmation = async (member: Member, action: PaymentReviewStatus) => {
    const memberName = member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username
    const memberIdentifier = member.email ? member.email : `@${member.username}`
    const memberLabel = `${memberName} (${memberIdentifier})`
    const prompt = action === 'paid'
      ? `Mark ${memberLabel} as paid? Only do this after Zach confirms receipt.`
      : action === 'not_paid'
        ? `Mark ${memberLabel} as not paid? Their membership choice and Venmo attempt will stay on file so they can retry payment.`
        : `Move ${memberLabel} back to not reviewed? Use this when a Venmo attempt still needs Zach’s verification.`
    if (!confirm(prompt)) return
    setConfirmingPaidId(member.id)
    try {
      const res = await fetch('/api/admin/payment-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ member_id: member.id, action }),
      })
      const json = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        alert(json.error || 'Could not update payment status.')
      } else {
        await fetchMembers()
      }
    } finally {
      setConfirmingPaidId(null)
    }
  }

  const markPaymentPaid = (member: Member) => updatePaymentConfirmation(member, 'paid')
  const markPaymentNotPaid = (member: Member) => updatePaymentConfirmation(member, 'not_paid')
  const markPaymentNotReviewed = (member: Member) => updatePaymentConfirmation(member, 'not_reviewed')

  async function fetchBeers() {
    const { data } = await supabase.from('beers').select('*').order('day_number')
    setBeers(data || [])
  }

  async function fetchRequests() {
    const { data } = await supabase
      .from('member_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  async function fetchNotifHistory() {
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
      const sendToAll = broadcastTiers.length === 2 || broadcastTiers.length === 0
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          body: broadcastBody,
          tiers: sendToAll ? undefined : broadcastTiers,
        }),
      })
      const data = await res.json()
      if (!res.ok) setBroadcastResult(`Error: ${data.error}`)
      else {
        const who = sendToAll ? 'everyone' : broadcastTiers.map(t => t === 'hallowed' ? 'The Hallowed' : 'Odd Balls').join(' + ')
        setBroadcastResult(`✅ Sent to ${data.sent} member${data.sent !== 1 ? 's' : ''} (${who})`)
        setBroadcastTitle('')
        setBroadcastBody('')
        setBroadcastTiers(['hallowed', 'oddballs'])
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
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--text-muted)' }}>Hallowed Hop Society</p>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>Admin</h1>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{beers.length}/31 beers</span>
        </div>

        {/* Feedback quick link */}
        <div className="mb-6">
          <a
            href="/admin/feedback"
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ border: '1px solid rgba(217,124,43,0.22)', background: 'rgba(217,124,43,0.06)',
              color: 'var(--text)', textDecoration: 'none' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>💬 Feedback Board</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Review &amp; triage member suggestions</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--gold)', opacity: 0.7, flexShrink: 0 }}>
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        {/* Notification setup banner for admin */}
        {myNotifStatus !== 'granted' && (
          <div className="mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-4" style={{ border: '1px solid rgba(217,124,43,0.3)', background: 'rgba(217,124,43,0.08)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--gold)' }}>🔔 You haven&apos;t enabled notifications</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {myNotifStatus === 'denied'
                  ? 'Blocked in browser — go to Settings → Safari/Chrome → Notifications → allow hallowedhopsociety.com'
                  : 'Enable them so you receive test notifications too'}
              </p>
            </div>
            {myNotifStatus !== 'denied' && (
              <button
                onClick={enableMyNotifications}
                disabled={enablingNotif}
                className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                style={{ background: 'rgba(217,124,43,0.15)', color: 'var(--gold)' }}
              >
                {enablingNotif ? '...' : 'Enable'}
              </button>
            )}
          </div>
        )}

        {/* Members Roster */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>Members</h2>
            </div>
            <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{members.length} approved</span>
          </div>

          {/* Tier Selection Control */}
          <div className="mb-4 px-4 py-3 rounded-xl flex items-center justify-between" style={{
            border: tierSelectionOpen ? '1px solid rgba(217,124,43,0.4)' : '1px solid var(--border)',
            background: tierSelectionOpen ? 'rgba(217,124,43,0.08)' : 'var(--bg-card)',
          }}>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Tier Selection</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {tierSelectionOpen
                  ? 'Open — members will see the tier picker when they open the app'
                  : 'Closed — members see nothing until you open this'}
              </p>
            </div>
            <button
              onClick={toggleTierSelection}
              disabled={togglingTier}
              className="text-xs font-bold px-4 py-2 rounded-lg transition-colors"
              style={{ background: 'rgba(217,124,43,0.15)', color: 'var(--gold)' }}
            >
              {togglingTier ? '...' : tierSelectionOpen ? 'Close' : 'Open'}
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No approved members yet.</p>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Header row */}
              <div className="grid gap-3 px-4 py-2" style={{ ...MEMBER_ROSTER_GRID_STYLE, borderBottom: '1px solid var(--border)' }}>
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Member</span>
                <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Push</span>
                <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Install</span>
                 <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Tier</span>
                 <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Paid</span>
                 <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Due</span>
                 <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Entry</span>
                 <span className="text-xs uppercase tracking-wider text-center" style={{ color: 'var(--text-muted)' }}>Payment</span>
              </div>
              {members.map((m, i) => {
                const paymentCopy = getAdminPaymentCopy(m)
                const activePaymentStatus = m.payment_review_status === 'paid' || m.payment_confirmed_at
                  ? 'paid'
                  : m.payment_review_status === 'not_paid'
                    ? 'not_paid'
                    : 'not_reviewed'
                return (
                <div
                  key={m.id}
                  className="grid gap-3 px-4 py-3 items-center"
                  style={i < members.length - 1
                    ? { ...MEMBER_ROSTER_GRID_STYLE, borderBottom: '1px solid rgba(217,124,43,0.08)' }
                    : MEMBER_ROSTER_GRID_STYLE}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {m.auth_email || m.email || `@${m.username}`}
                      {m.auth_email && m.email && m.auth_email.toLowerCase() !== m.email.toLowerCase() && (
                        <span className="ml-1" title={`Profile email: ${m.email}`}>profile: {m.email}</span>
                      )}
                      {m.native_source && <span className="ml-1 px-1 rounded" style={{ background: 'rgba(217,124,43,0.12)', color: 'var(--gold)', fontSize: '0.65rem' }}>native</span>}
                    </p>
                  </div>
                  <div className="text-center" title="Push notifications enabled">
                    {m.has_notifications ? <span className="text-green-400">✓</span> : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                  </div>
                  <div className="text-center" title="App installed on home screen">
                    {m.has_pwa ? <span className="text-green-400">✓</span> : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>}
                  </div>
                  <div className="text-center">
                    {m.tier
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'rgba(217,124,43,0.15)', color: 'var(--gold)' }}>
                          {m.tier === 'hallowed' ? 'Hallowed' : 'Odd Balls'}
                        </span>
                      : <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                    }
                  </div>
                  <div className="text-center">
                    <span className="text-xs" style={{ color: paymentCopy.color }} title={paymentCopy.title}>{paymentCopy.label}</span>
                  </div>
                   <div className="text-center">
                     {m.native_membership_amount
                      ? <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>${m.native_membership_amount}</span>
                      : m.tier
                        ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>${m.tier === 'hallowed' ? 150 : 100}</span>
                      : <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</span>
                     }
                   </div>
                   <div className="text-center">
                     <button
                       type="button"
                       onClick={() => updateSetupOverride(m, m.setup_override_at ? 'disable' : 'enable')}
                       disabled={updatingOverrideId === m.id}
                       className="text-[0.68rem] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                       title={m.setup_override_at ? `Manual entry opened ${new Date(m.setup_override_at).toLocaleDateString()}` : 'Bypass setup checklist for this member'}
                       style={{
                         background: m.setup_override_at ? 'rgba(74,222,128,0.22)' : 'rgba(217,124,43,0.1)',
                         color: m.setup_override_at ? '#4ade80' : 'var(--gold)',
                         border: m.setup_override_at ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(217,124,43,0.25)',
                       }}
                     >
                       {updatingOverrideId === m.id ? '...' : m.setup_override_at ? 'Remove override' : 'Let them in'}
                     </button>
                   </div>
                   <div className="text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => markPaymentPaid(m)}
                          disabled={confirmingPaidId === m.id}
                          className="text-[0.68rem] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          style={{
                            background: activePaymentStatus === 'paid' ? 'rgba(74,222,128,0.22)' : 'rgba(74,222,128,0.1)',
                            color: '#4ade80',
                            border: activePaymentStatus === 'paid' ? '1px solid rgba(74,222,128,0.45)' : '1px solid transparent',
                          }}
                        >
                          {confirmingPaidId === m.id ? '...' : 'Paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => markPaymentNotPaid(m)}
                          disabled={confirmingPaidId === m.id}
                          className="text-[0.68rem] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          style={{
                            background: activePaymentStatus === 'not_paid' ? 'rgba(248,113,113,0.2)' : 'rgba(248,113,113,0.1)',
                            color: '#fca5a5',
                            border: activePaymentStatus === 'not_paid' ? '1px solid rgba(248,113,113,0.4)' : '1px solid transparent',
                          }}
                        >
                          {confirmingPaidId === m.id ? '...' : 'Not Paid'}
                        </button>
                        <button
                          type="button"
                          onClick={() => markPaymentNotReviewed(m)}
                          disabled={confirmingPaidId === m.id}
                          className="text-[0.68rem] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          style={{
                            background: activePaymentStatus === 'not_reviewed' ? 'rgba(217,124,43,0.22)' : 'rgba(217,124,43,0.1)',
                            color: 'var(--gold)',
                            border: activePaymentStatus === 'not_reviewed' ? '1px solid rgba(217,124,43,0.45)' : '1px solid transparent',
                          }}
                        >
                          {confirmingPaidId === m.id ? '...' : 'Not Reviewed'}
                        </button>
                    </div>
                  </div>
                </div>
                )
              })}
              {/* Summary row */}
              <div className="grid gap-3 px-4 py-2" style={{ ...MEMBER_ROSTER_GRID_STYLE, borderTop: '1px solid var(--border)', background: 'rgba(25,23,38,0.5)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{members.length} total</span>
                <span className="text-xs text-center" style={{ color: 'var(--gold)' }}>{members.filter(m => m.has_notifications).length}/{members.length}</span>
                <span className="text-xs text-center" style={{ color: 'var(--gold)' }}>{members.filter(m => m.has_pwa).length}/{members.length}</span>
                <span className="text-xs text-center" style={{ color: 'var(--gold)' }}>{members.filter(m => m.tier).length}/{members.length}</span>
                <span className="text-xs text-green-400 text-center">{members.filter(m => getAdminPaymentState(m) === 'paid').length}/{members.length}</span>
                 <span className="text-xs text-center" style={{ color: 'var(--gold)' }}>
                   ${members.reduce((sum, m) => sum + (m.native_membership_amount || (m.tier === 'hallowed' ? 150 : m.tier === 'oddballs' ? 100 : 0)), 0)}
                 </span>
                 <span className="text-xs text-center" style={{ color: 'var(--gold)' }}>{members.filter(m => m.setup_override_at).length} opened</span>
                  <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{members.filter(m => getAdminPaymentState(m) === 'not_reviewed').length} need check</span>
              </div>
            </div>
          )}
        </div>

        {/* Membership Requests */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>Membership Requests</h2>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {requests.filter(r => r.status === 'pending').length} pending
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No membership requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="rounded-xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {req.first_name} {req.last_name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{req.email}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleReview(req.id, 'approve')}
                            disabled={reviewingId === req.id}
                            className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: 'rgba(217,124,43,0.15)', color: 'var(--gold)' }}
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
                        <span className={`text-xs font-medium ${req.status === 'approved' ? 'text-green-500' : ''}`} style={req.status !== 'approved' ? { color: 'var(--text-muted)' } : {}}>
                          {req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                  {reviewMsg[req.id] && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{reviewMsg[req.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Broadcast Notification */}
        <div className="mb-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--text-muted)' }}>Send Notification</h2>
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <form onSubmit={handleBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Title</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  required
                  placeholder="e.g. Beer order update"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Message</label>
                <textarea
                  value={broadcastBody}
                  onChange={e => setBroadcastBody(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Your beer box ships Friday. Keep an eye out."
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Send To</label>
                <div className="flex gap-2">
                  {[
                    { id: 'hallowed', label: 'The Hallowed' },
                    { id: 'oddballs', label: 'Odd Balls' },
                  ].map(tier => {
                    const active = broadcastTiers.includes(tier.id)
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setBroadcastTiers(prev =>
                          active
                            ? prev.filter(t => t !== tier.id)
                            : [...prev, tier.id]
                        )}
                        className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                        style={active
                          ? { background: 'var(--gold)', color: 'var(--bg)' }
                          : { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                        }
                      >
                        {tier.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                  {broadcastTiers.length === 2 || broadcastTiers.length === 0
                    ? '→ Both selected — sends to all members'
                    : `→ Sends to ${broadcastTiers.map(t => t === 'hallowed' ? 'The Hallowed' : 'Odd Balls').join(' only')}`}
                </p>
              </div>
              {broadcastResult && (
                <p className={`text-sm ${broadcastResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                  {broadcastResult}
                </p>
              )}
              <button
                type="submit"
                disabled={broadcasting}
                className="w-full font-bold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40"
                style={{ background: 'var(--gold)', color: 'var(--bg)' }}
              >
                {broadcasting ? 'Sending...' : broadcastTiers.length === 1
                  ? `Send to ${broadcastTiers[0] === 'hallowed' ? 'The Hallowed' : 'Odd Balls'}`
                  : 'Send to Selected Members'}
              </button>
            </form>
          </div>

          {/* Notification History */}
          {notifHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-muted)' }}>Sent History</h3>
              <div className="space-y-2">
                {notifHistory.map(n => (
                  <div key={n.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    {/* Row — tap to expand */}
                    <button
                      onClick={() => toggleNotifDetail(n.id)}
                      className="w-full px-4 py-3 flex items-start justify-between gap-4 text-left transition-colors"
                      style={{ background: 'transparent' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{n.title}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.body}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                          {new Date(n.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{n.opens} opened</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{n.total_sent} sent</p>
                        {n.total_sent > 0 && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{Math.round((n.opens / n.total_sent) * 100)}%</p>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>{expandedNotif === n.id ? '▲' : '▼'}</p>
                      </div>
                    </button>

                    {/* Expanded breakdown */}
                    {expandedNotif === n.id && (
                      <div className="px-4 py-3 grid grid-cols-2 gap-4" style={{ borderTop: '1px solid var(--border)' }}>
                        {!notifDetail[n.id] ? (
                          <p className="col-span-2 text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>Loading...</p>
                        ) : (
                          <>
                            <div>
                              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                Opened ({notifDetail[n.id].opened.length})
                              </p>
                              {notifDetail[n.id].opened.length === 0 ? (
                                <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>—</p>
                              ) : (
                                <ul className="space-y-1">
                                  {notifDetail[n.id].opened.map(m => (
                                    <li key={m.id} className="text-xs" style={{ color: 'var(--text)' }}>{m.name}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                Not Opened ({notifDetail[n.id].notOpened.length})
                              </p>
                              {notifDetail[n.id].notOpened.length === 0 ? (
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Everyone opened it</p>
                              ) : (
                                <ul className="space-y-1">
                                  {notifDetail[n.id].notOpened.map(m => (
                                    <li key={m.id} className="text-xs" style={{ color: 'var(--text)' }}>{m.name}</li>
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
        <div className="rounded-2xl p-6 mb-8" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: 'var(--text-muted)' }}>Add or Edit Beer</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Day Number *</label>
                <input
                  type="number" min={1} max={31}
                  value={dayNumber}
                  onChange={e => setDayNumber(parseInt(e.target.value))}
                  required
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ABV %</label>
                <input
                  type="number" step="0.1" min="0" max="20"
                  value={abv}
                  onChange={e => setAbv(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  placeholder="5.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Beer Name *</label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="Pumpkin Spice Stout"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Brewery *</label>
              <input
                type="text" value={brewery}
                onChange={e => setBrewery(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="Haunted Brewing Co."
              />
            </div>

            <div>
              <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Style</label>
              <input
                type="text" value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="Imperial Stout"
              />
            </div>

            <div>
              <label className="block text-xs mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="Dark, rich, and dangerously drinkable..."
              />
            </div>

            {message && (
              <p className={`text-sm ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full font-bold py-2.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: 'var(--gold)', color: 'var(--bg)' }}
            >
              {saving ? 'Saving...' : `Save Day ${dayNumber}`}
            </button>
          </form>
        </div>

        {/* Beer list */}
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: 'var(--text-muted)' }}>Entered Beers</h2>
        {beers.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No beers entered yet. Add your first one above.</p>
        ) : (
          <div className="space-y-2">
            {beers.map(beer => (
              <div key={beer.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <span className="font-bold w-7 text-center text-sm shrink-0" style={{ color: 'var(--gold)' }}>{beer.day_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{beer.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{beer.brewery}{beer.style ? ` · ${beer.style}` : ''}{beer.abv ? ` · ${beer.abv}%` : ''}</div>
                </div>
                <button
                  onClick={() => loadBeerForEdit(beer)}
                  className="text-xs shrink-0"
                  style={{ color: 'var(--gold)', opacity: 0.7 }}
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

