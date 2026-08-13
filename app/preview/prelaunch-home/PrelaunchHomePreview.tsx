'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import HomeCountdownJoin from '@/components/HomeCountdownJoin'
import { supabase } from '@/lib/supabase'
import { normalizeMembershipTier } from '@/lib/membership'

type Countdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

type PreviewProfile = {
  username: string | null
  displayName: string | null
  email: string | null
  tier: string | null
  status: string | null
  hasPwa: boolean | null
  venmoClickedAt: string | null
  nativeMembershipAmount: number | null
}

type ChecklistKey = 'username' | 'membership' | 'install' | 'notifications' | 'paid'

type ChecklistRow = {
  key: ChecklistKey
  label: string
  value: string
  done: boolean
  source: 'live' | 'action'
  summary: string
}

const displayFont = 'var(--font-display), "Modern Antiqua", Georgia, serif'
const bodyFont = 'var(--font-body), "Crimson Text", Georgia, serif'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null

function getOctFirstTarget() {
  const now = new Date()
  const target = new Date(now.getFullYear(), 9, 1, 0, 0, 0, 0)
  if (now.getTime() >= target.getTime()) target.setFullYear(target.getFullYear() + 1)
  return target
}

function buildCountdown(): Countdown {
  const diff = Math.max(0, getOctFirstTarget().getTime() - Date.now())
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  }
}

function isPWA() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

function getBrowserName() {
  if (typeof navigator === 'undefined') return 'your browser'
  const ua = navigator.userAgent
  if (/Edg\/|EdgA\//.test(ua)) return 'Edge'
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet'
  if (/OPR\/|Opera/.test(ua)) return 'Opera'
  if (/Firefox/.test(ua)) return 'Firefox'
  if (/CriOS|Chrome/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  return 'your browser'
}

function oneTapInstallUnavailableMessage() {
  const browser = getBrowserName()
  if (browser === 'Chrome') {
    return 'Chrome has not offered the one-tap install button here. That can happen if HHS is already installed, this page was opened inside another app, or Chrome has not made the prompt available yet. Use the steps below.'
  }
  return `${browser} has not offered a one-tap install button here. Use the steps below.`
}

function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

function tierLabel(tier: string | null | undefined) {
  const normalized = normalizeMembershipTier(tier)
  if (normalized === 'hallowed') return 'The Hallowed'
  if (normalized === 'oddballs') return 'Oddballs'
  if (tier) return tier
  return 'Not selected'
}

function CheckIcon({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '2rem',
        height: '2rem',
        borderRadius: 999,
        flex: '0 0 auto',
        border: done ? '1px solid rgba(74, 222, 128, 0.55)' : '1px solid rgba(248, 113, 113, 0.55)',
        background: done ? 'rgba(34, 197, 94, 0.13)' : 'rgba(239, 68, 68, 0.12)',
        color: done ? '#4ade80' : '#f87171',
        fontFamily: 'Arial, sans-serif',
        fontSize: '1.05rem',
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {done ? '✓' : '×'}
    </span>
  )
}

function StatusPill({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'green' | 'red' | 'muted' }) {
  const palette = {
    gold: ['rgba(217, 124, 43, 0.42)', 'rgba(217, 124, 43, 0.12)', 'var(--gold)'],
    green: ['rgba(74, 222, 128, 0.42)', 'rgba(34, 197, 94, 0.12)', '#4ade80'],
    red: ['rgba(248, 113, 113, 0.42)', 'rgba(239, 68, 68, 0.12)', '#f87171'],
    muted: ['var(--border)', 'rgba(255, 255, 255, 0.035)', 'var(--text-muted)'],
  }[tone]

  return (
    <span
      className="uppercase"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        border: `1px solid ${palette[0]}`,
        background: palette[1],
        color: palette[2],
        borderRadius: 999,
        padding: '0.35rem 0.7rem',
        fontFamily: displayFont,
        fontSize: '0.58rem',
        letterSpacing: '0.18em',
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  )
}

function SectionHeading({ eyebrow, title, intro, eyebrowColor = 'var(--text-muted)' }: { eyebrow: string; title: string; intro?: string; eyebrowColor?: string }) {
  return (
    <div style={{ marginBottom: '1.35rem' }}>
      <div
        className="uppercase"
        style={{
          color: eyebrowColor,
          fontFamily: displayFont,
          fontSize: '0.7rem',
          letterSpacing: '0.28em',
          marginBottom: '0.55rem',
        }}
      >
        {eyebrow}
      </div>
      <h2 style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: 'clamp(1.65rem, 4vw, 2.55rem)', lineHeight: 1.08, margin: 0 }}>
        {title}
      </h2>
      {intro ? (
        <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1.06rem', lineHeight: 1.7, marginTop: '0.75rem', maxWidth: 760 }}>
          {intro}
        </p>
      ) : null}
    </div>
  )
}

function GuidanceSteps({ type }: { type: 'install' | 'notifications' }) {
  if (type === 'install') {
    if (isIOS()) {
      return (
        <ol style={modalListStyle}>
          <li>Open this page in Safari. iOS only allows Home Screen installs from Safari.</li>
          <li>Tap the Share button at the bottom of Safari.</li>
          <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
          <li>Reopen HHS from the new Home Screen icon so the app can detect standalone mode.</li>
        </ol>
      )
    }
    if (isAndroid()) {
      return (
        <ol style={modalListStyle}>
          <li>Use Chrome, Edge, or Samsung Internet if possible.</li>
          <li>Tap the browser menu (⋮ or ···).</li>
          <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Reopen HHS from the installed icon.</li>
        </ol>
      )
    }
    return (
      <ol style={modalListStyle}>
        <li>Desktop install prompts only appear in supported browsers when the PWA criteria are met.</li>
        <li>If no install button is shown, open hallowedhopsociety.com on your phone and add it to your Home Screen there.</li>
      </ol>
    )
  }

  if (isIOS()) {
    return (
      <ol style={modalListStyle}>
        <li>Install HHS to your Home Screen first; iOS web push works from the installed app.</li>
        <li>Open HHS from the Home Screen icon, not an in-browser tab.</li>
        <li>Tap <strong>Enable Notifications</strong> and approve the system prompt.</li>
        <li>If blocked, open iOS Settings → Notifications → HHS/Safari and allow notifications, then return.</li>
      </ol>
    )
  }
  return (
    <ol style={modalListStyle}>
      <li>Tap <strong>Enable Notifications</strong> and approve the browser permission prompt.</li>
      <li>If blocked, open {getBrowserName()} settings → Site settings → Notifications.</li>
      <li>Allow hallowedhopsociety.com, reload this page, and tap the row again.</li>
    </ol>
  )
}

export default function PrelaunchHomePreview() {
  const [countdown, setCountdown] = useState<Countdown>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<PreviewProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [runningAsPwa, setRunningAsPwa] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [hasPushSubscription, setHasPushSubscription] = useState(false)
  const [activeModal, setActiveModal] = useState<ChecklistKey | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    const tick = () => setCountdown(buildCountdown())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      setCanNativeInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const refreshLiveState = useCallback(async () => {
    setRunningAsPwa(isPWA())
    setNotificationPermission(notificationSupported() ? Notification.permission : 'unsupported')

    const { data: { user: authUser } } = await supabase.auth.getUser()
    setUser(authUser)
    if (!authUser) {
      setProfile(null)
      setHasPushSubscription(false)
      setLoadingProfile(false)
      return
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('username, display_name, email, tier, status, has_pwa, venmo_clicked_at, native_membership_amount')
      .eq('id', authUser.id)
      .maybeSingle()

    setProfile({
      username: profileRow?.username ?? null,
      displayName: profileRow?.display_name ?? null,
      email: profileRow?.email ?? authUser.email ?? null,
      tier: profileRow?.tier ?? null,
      status: profileRow?.status ?? null,
      hasPwa: typeof profileRow?.has_pwa === 'boolean' ? profileRow.has_pwa : null,
      venmoClickedAt: profileRow?.venmo_clicked_at ?? null,
      nativeMembershipAmount: profileRow?.native_membership_amount ?? null,
    })

    const { data: pushSub } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('user_id', authUser.id)
      .maybeSingle()

    setHasPushSubscription(!!pushSub)
    setLoadingProfile(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refreshLiveState)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoadingProfile(true)
      refreshLiveState()
    })
    return () => subscription.unsubscribe()
  }, [refreshLiveState])

  const displayName = profile?.displayName || profile?.username || user?.email || 'Not signed in'
  const membershipDone = !!user && (normalizeMembershipTier(profile?.tier) === 'hallowed' || normalizeMembershipTier(profile?.tier) === 'oddballs' || profile?.status === 'approved')
  const installDone = runningAsPwa || profile?.hasPwa === true
  const notificationDone = notificationPermission === 'granted' && hasPushSubscription
  const paidDone = !!profile?.nativeMembershipAmount || !!profile?.venmoClickedAt

  const rows: ChecklistRow[] = useMemo(() => [
    {
      key: 'username',
      label: 'Member profile',
      value: user ? displayName : 'Sign in to view',
      done: !!user && displayName !== 'Not signed in',
      source: user ? 'live' : 'action',
      summary: user ? 'Shows the name or email from your signed-in HHS account.' : 'Sign in with your approved HHS email so this page can show your member profile.',
    },
    {
      key: 'membership',
      label: 'Society membership',
      value: membershipDone ? tierLabel(profile?.tier) : user ? 'Membership needs confirmation' : 'Sign in to confirm',
      done: membershipDone,
      source: user ? 'live' : 'action',
      summary: 'Confirms your HHS tier or approved member status from your account.',
    },
    {
      key: 'install',
      label: 'Home Screen app',
      value: runningAsPwa ? 'Installed on this device' : profile?.hasPwa ? 'Added to your profile' : canNativeInstall ? 'Install available' : 'Add HHS to your Home Screen',
      done: installDone,
      source: user || runningAsPwa ? 'live' : 'action',
      summary: 'Checks whether HHS is running from your Home Screen and whether your account has saved that setup.',
    },
    {
      key: 'notifications',
      label: 'Reveal notifications',
      value: notificationDone ? 'Enabled for reveals' : notificationPermission === 'denied' ? 'Notifications blocked' : notificationPermission === 'unsupported' ? 'Not available in this browser' : 'Enable reveal alerts',
      done: notificationDone,
      source: user ? 'live' : 'action',
      summary: 'Checks browser notification permission and the saved HHS push subscription for your account.',
    },
    {
      key: 'paid',
      label: 'Membership payment',
      value: paidDone
        ? profile?.nativeMembershipAmount ? `$${profile.nativeMembershipAmount} recorded` : 'Venmo handoff recorded'
        : 'Payment not confirmed here',
      done: paidDone,
      source: user ? 'live' : 'action',
      summary: 'Shows the available payment signals on your member profile; final reconciliation remains with HHS.',
    },
  ], [canNativeInstall, displayName, installDone, membershipDone, notificationDone, notificationPermission, paidDone, profile, runningAsPwa, user])

  const allReady = rows.every(row => row.done)
  const activeRow = rows.find(row => row.key === activeModal) ?? null

  const markInstalled = async () => {
    if (!user) {
      setActionMessage('Sign in first so HHS can save the Home Screen status to your profile.')
      return
    }
    await supabase.from('profiles').update({ has_pwa: true }).eq('id', user.id)
    setActionMessage('Saved Home Screen status to your profile. Reopen from the icon for the device check.')
    await refreshLiveState()
  }

  const handleNativeInstall = async () => {
    if (!deferredPrompt) {
      setActionMessage(oneTapInstallUnavailableMessage())
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanNativeInstall(false)
    if (outcome === 'accepted') await markInstalled()
    else setActionMessage('Install was dismissed. You can still use the manual steps below.')
  }

  const enableNotifications = async () => {
    if (!user) {
      setActionMessage('Sign in first so HHS can save the push subscription to your member profile.')
      return
    }
    if (!notificationSupported()) {
      setActionMessage('This browser does not expose the web push APIs here. Use the platform steps below.')
      return
    }
    setSubscribing(true)
    setActionMessage(null)
    try {
      const perm = await Notification.requestPermission()
      setNotificationPermission(perm)
      if (perm !== 'granted') {
        setActionMessage(perm === 'denied' ? 'Notifications are blocked. Use browser settings, then reload.' : 'Notification permission was not granted.')
        return
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setActionMessage('Notifications cannot be enabled because the public push key is not configured.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ subscription: sub.toJSON(), user_id: user.id }),
      })
      if (!res.ok) throw new Error('Subscription save failed')
      setActionMessage('Notifications are enabled and the push subscription was saved.')
      await refreshLiveState()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Could not enable notifications from this browser.')
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 88% 18%, rgba(111, 86, 160, 0.18), transparent 28rem), var(--bg)',
        color: 'var(--text)',
      }}
    >
      <section style={{ paddingTop: 'clamp(0.5rem, 2vw, 1rem)' }}>
        <HomeCountdownJoin countdown={countdown} showJoinCta={false} compact />
      </section>

      <section
        className="container mx-auto max-w-6xl px-6 py-8"
        style={{
          borderTop: '1px solid rgba(217, 124, 43, 0.28)',
          paddingBottom: 'clamp(4rem, 8vw, 6rem)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <SectionHeading
            eyebrow="Membership Checklist"
            eyebrowColor="var(--gold)"
            title={allReady ? 'You are ready for October.' : 'Get yourself ready'}
            intro={allReady
              ? 'Everything HHS can verify is in place. Keep the app handy for the first reveal when the ritual begins.'
              : 'Tap on any row in red to complete the action.'}
          />
          <StatusPill tone={allReady ? 'green' : 'muted'}>{allReady ? 'Ready' : loadingProfile ? 'Checking' : 'To do'}</StatusPill>
        </div>

        {allReady ? (
          <div style={{ border: '1px solid rgba(74, 222, 128, 0.34)', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '16px', padding: '1rem', marginBottom: '1rem', color: '#bbf7d0', fontFamily: bodyFont, fontSize: '1.05rem', lineHeight: 1.6 }}>
            Congrats — your launch setup is complete. Keep HHS on your Home Screen and watch for the first reveal.
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {rows.map(row => (
            <button
              key={row.key}
              type="button"
              onClick={() => { setActiveModal(row.key); setActionMessage(null) }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                gap: '0.85rem',
                alignItems: 'center',
                textAlign: 'left',
                width: '100%',
                border: `1px solid ${row.done ? 'rgba(74, 222, 128, 0.28)' : 'rgba(248, 113, 113, 0.22)'}`,
                background: row.done ? 'rgba(34, 197, 94, 0.07)' : 'rgba(25, 23, 38, 0.48)',
                borderRadius: '16px',
                padding: '0.95rem',
                cursor: 'pointer',
                color: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              <CheckIcon done={row.done} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--text)', fontFamily: displayFont, fontSize: '1.02rem', fontWeight: 700 }}>
                  {row.label}
                </span>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '0.95rem', lineHeight: 1.45 }}>
                  {row.value}
                </span>
              </span>
              <StatusPill tone={row.source === 'live' ? 'green' : 'muted'}>{row.source === 'live' ? 'Live' : 'Action'}</StatusPill>
            </button>
          ))}
        </div>
      </section>

      {activeRow ? (
        <div role="dialog" aria-modal="true" aria-labelledby="prelaunch-modal-title">
          <button
            type="button"
            aria-label="Close setup guidance"
            onClick={() => setActiveModal(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, border: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(5px)', cursor: 'default' }}
          />
          <div style={{ position: 'fixed', zIndex: 41, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(460px, 92vw)', maxHeight: '86vh', overflow: 'auto', background: 'var(--bg-card)', border: '1px solid rgba(217,124,43,0.34)', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 32px 96px rgba(0,0,0,0.75)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <CheckIcon done={activeRow.done} />
              <div>
                <h3 id="prelaunch-modal-title" style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: '1.45rem', lineHeight: 1.1, margin: 0 }}>
                  {activeRow.label}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '0.96rem', lineHeight: 1.5, margin: '0.35rem 0 0' }}>
                  {activeRow.summary}
                </p>
              </div>
            </div>

            {activeRow.key === 'username' ? (
              <p style={modalBodyStyle}>
                Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. If this is red, sign in with your approved HHS email and return to this page.
              </p>
            ) : null}

            {activeRow.key === 'membership' ? (
              <p style={modalBodyStyle}>
                Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. Pick or confirm The Hallowed / Oddballs in Membership if available; otherwise Zach may need to update the profile tier/status.
              </p>
            ) : null}

            {activeRow.key === 'install' ? (
              <>
                <p style={modalBodyStyle}>
                  Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>.
                </p>
                {canNativeInstall ? (
                  <button type="button" onClick={handleNativeInstall} style={primaryButtonStyle}>
                    Add to Home Screen
                  </button>
                ) : null}
                <GuidanceSteps type="install" />
                <button type="button" onClick={markInstalled} style={secondaryButtonStyle}>
                  I added it — save status
                </button>
              </>
            ) : null}

            {activeRow.key === 'notifications' ? (
              <>
                <p style={modalBodyStyle}>
                  Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>.
                </p>
                {notificationSupported() && notificationPermission !== 'denied' ? (
                  <button type="button" onClick={enableNotifications} disabled={subscribing} style={primaryButtonStyle}>
                    {subscribing ? 'Enabling…' : 'Enable Notifications'}
                  </button>
                ) : null}
                <GuidanceSteps type="notifications" />
              </>
            ) : null}

            {activeRow.key === 'paid' ? (
              <p style={modalBodyStyle}>
                Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. HHS can only show the payment signals available on your profile here; it does not verify bank settlement. If you paid and this is red, Zach needs to reconcile the roster/payment source.
              </p>
            ) : null}

            {actionMessage ? (
              <p style={{ ...modalBodyStyle, border: '1px solid rgba(217,124,43,0.22)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(217,124,43,0.08)' }}>
                {actionMessage}
              </p>
            ) : null}

            <button type="button" onClick={() => setActiveModal(null)} style={{ ...secondaryButtonStyle, marginTop: '0.75rem' }}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

const modalBodyStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: bodyFont,
  fontSize: '1rem',
  lineHeight: 1.65,
  margin: '0 0 1rem',
}

const modalListStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: bodyFont,
  fontSize: '1rem',
  lineHeight: 1.65,
  margin: '0 0 1rem',
  paddingLeft: '1.25rem',
}

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '10px',
  background: 'var(--gold)',
  color: 'var(--bg)',
  cursor: 'pointer',
  fontFamily: displayFont,
  fontSize: '0.82rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  marginBottom: '1rem',
  padding: '0.85rem 1rem',
  textTransform: 'uppercase',
}

const secondaryButtonStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(217,124,43,0.38)',
  borderRadius: '10px',
  background: 'transparent',
  color: 'var(--gold)',
  cursor: 'pointer',
  fontFamily: displayFont,
  fontSize: '0.78rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  padding: '0.8rem 1rem',
  textTransform: 'uppercase',
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
