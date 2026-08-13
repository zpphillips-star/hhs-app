'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HomeCountdownJoin from '@/components/HomeCountdownJoin'
import { supabase } from '@/lib/supabase'
import { normalizeMembershipTier } from '@/lib/membership'
import { HHS_PAYMENT_TIERS, type HhsPaymentTier, openHhsVenmoPayment } from '@/lib/venmo'

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
  paymentConfirmedAt: string | null
}

type ChecklistKey = 'profile' | 'membership' | 'install' | 'notifications' | 'paid'

type ChecklistRow = {
  key: ChecklistKey
  label: string
  value: string
  done: boolean
  summary: string
  actionLabel?: string
}

type PaymentStatus = 'not_complete' | 'in_process' | 'confirmed'

type ProfileRow = {
  username?: string | null
  display_name?: string | null
  email?: string | null
  tier?: string | null
  status?: string | null
  has_pwa?: boolean | null
  venmo_clicked_at?: string | null
  native_membership_amount?: number | null
  payment_confirmed_at?: string | null
}

const displayFont = 'var(--font-display), "Modern Antiqua", Georgia, serif'
const bodyFont = 'var(--font-body), "Crimson Text", Georgia, serif'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

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

function canUsePushHere() {
  if (!notificationSupported()) return false
  if (isIOS() && !isPWA()) return false
  return true
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

function tierLabel(tier: string | null | undefined) {
  const normalized = normalizeMembershipTier(tier)
  if (normalized === 'hallowed') return 'The Hallowed'
  if (normalized === 'oddballs') return 'The Oddballs'
  if (tier) return tier
  return 'Not selected'
}

function tierAmount(tier: string | null | undefined) {
  const normalized = normalizeMembershipTier(tier)
  if (normalized === 'hallowed') return HHS_PAYMENT_TIERS.hallowed.amount
  if (normalized === 'oddballs') return HHS_PAYMENT_TIERS.oddballs.amount
  return null
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
  const router = useRouter()
  const [countdown, setCountdown] = useState<Countdown>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<PreviewProfile | null>(null)
  const [, setLoadingProfile] = useState(true)
  const [runningAsPwa, setRunningAsPwa] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [hasPushSubscription, setHasPushSubscription] = useState(false)
  const [activeModal, setActiveModal] = useState<ChecklistKey | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [autoOpenedInstall, setAutoOpenedInstall] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const tick = () => setCountdown(buildCountdown())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCanNativeInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const refreshLiveState = useCallback(async () => {
    const detectedPwa = isPWA()
    setRunningAsPwa(detectedPwa)
    setNotificationPermission(notificationSupported() ? Notification.permission : 'unsupported')

    const { data: { user: authUser } } = await supabase.auth.getUser()
    setUser(authUser)
    if (!authUser) {
      setProfile(null)
      setHasPushSubscription(false)
      setLoadingProfile(false)
      return
    }

    const profileSelect = 'username, display_name, email, tier, status, has_pwa, venmo_clicked_at, native_membership_amount, payment_confirmed_at'
    const fallbackProfileSelect = 'username, display_name, email, tier, status, has_pwa, venmo_clicked_at, native_membership_amount'
    const profileResult = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', authUser.id)
      .maybeSingle()
    let profileRow = profileResult.data as ProfileRow | null
    let profileError = profileResult.error
    if (profileError && /payment_confirmed_at/i.test(profileError.message)) {
      const fallback = await supabase
        .from('profiles')
        .select(fallbackProfileSelect)
        .eq('id', authUser.id)
        .maybeSingle()
      profileRow = fallback.data as ProfileRow | null
      profileError = fallback.error
    }
    const row = profileError ? null : profileRow

    if (detectedPwa && row?.has_pwa !== true) {
      await supabase.from('profiles').update({ has_pwa: true }).eq('id', authUser.id)
    }

    setProfile({
      username: row?.username ?? null,
      displayName: row?.display_name ?? null,
      email: row?.email ?? authUser.email ?? null,
      tier: row?.tier ?? null,
      status: row?.status ?? null,
      hasPwa: detectedPwa ? true : typeof row?.has_pwa === 'boolean' ? row.has_pwa : null,
      venmoClickedAt: row?.venmo_clicked_at ?? null,
      nativeMembershipAmount: row?.native_membership_amount ?? null,
      paymentConfirmedAt: row?.payment_confirmed_at ?? null,
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

  const memberUsername = profile?.username ? `@${profile.username}` : null
  const normalizedTier = normalizeMembershipTier(profile?.tier)
  const selectedTier = normalizedTier === 'hallowed' || normalizedTier === 'oddballs' ? normalizedTier : null
  const profileDone = !!user && profile?.status === 'approved' && !!profile?.username
  const membershipDone = !!selectedTier
  const installDone = runningAsPwa || profile?.hasPwa === true
  const notificationDone = notificationPermission === 'granted' && hasPushSubscription
  const paymentStatus: PaymentStatus = profile?.paymentConfirmedAt
    ? 'confirmed'
    : profile?.venmoClickedAt
      ? 'in_process'
      : 'not_complete'
  const paymentDone = paymentStatus === 'confirmed'
  const expectedAmount = profile?.nativeMembershipAmount ?? tierAmount(profile?.tier)
  const paymentValue = paymentStatus === 'confirmed'
    ? `Payment confirmed${expectedAmount ? ` · $${expectedAmount}` : ''}`
    : paymentStatus === 'in_process'
      ? `In process${expectedAmount ? ` · $${expectedAmount}` : ''}`
      : 'Not complete'

  const rows: ChecklistRow[] = useMemo(() => [
    {
      key: 'profile',
      label: 'Setup member profile',
      value: user ? memberUsername ?? 'Username missing' : 'Sign in to view',
      done: profileDone,
      summary: profileDone
        ? `Your member profile is active as ${memberUsername}.`
        : user
          ? 'Your approved member profile needs a Society username before setup is complete.'
          : 'Sign in with your approved HHS email so this page can read your member profile.',
      actionLabel: user ? 'Finish Profile Setup' : 'Sign In',
    },
    {
      key: 'membership',
      label: 'Select society membership',
      value: membershipDone ? tierLabel(profile?.tier) : 'Not selected',
      done: membershipDone,
      summary: membershipDone
        ? `Your Society membership is set to ${tierLabel(profile?.tier)}.`
        : 'Choose The Hallowed or The Oddballs in the approved member setup flow.',
      actionLabel: 'Select Membership',
    },
    {
      key: 'install',
      label: 'Install app to phone',
      value: runningAsPwa ? 'Detected from Home Screen' : profile?.hasPwa ? 'Previously detected' : canNativeInstall ? 'Install available' : 'Not detected',
      done: installDone,
      summary: 'Checks whether HHS is running in standalone/Home Screen mode and saves that detected state to your profile when possible.',
      actionLabel: canNativeInstall ? 'Install App' : 'View Install Steps',
    },
    {
      key: 'notifications',
      label: 'Enable notifications',
      value: notificationDone ? 'Enabled' : notificationPermission === 'denied' ? 'Notifications blocked' : notificationPermission === 'unsupported' ? 'Not available in this browser' : 'Not enabled',
      done: notificationDone,
      summary: notificationDone
        ? 'Notifications are enabled and HHS has a saved push subscription for your account.'
        : isIOS() && !installDone
          ? 'Install HHS to your Home Screen first; iPhone notifications can only be enabled from the installed app.'
          : 'Tap to enable notifications and save the HHS push subscription for your account.',
      actionLabel: 'Enable Notifications',
    },
    {
      key: 'paid',
      label: 'Pay membership dues',
      value: paymentValue,
      done: paymentDone,
      summary: paymentDone
        ? 'Zach has confirmed your dues as received.'
        : paymentStatus === 'in_process'
          ? 'Your Venmo handoff is recorded. This completes when Zach confirms the money was received.'
          : 'Tap to open Venmo with your selected membership and amount filled in.',
      actionLabel: paymentStatus === 'not_complete' ? 'Open Venmo' : 'Payment Status',
    },
  ], [canNativeInstall, installDone, memberUsername, membershipDone, notificationDone, notificationPermission, paymentDone, paymentStatus, paymentValue, profile?.hasPwa, profile?.tier, profileDone, runningAsPwa, user])

  const allReady = rows.every(row => row.done)
  const activeRow = rows.find(row => row.key === activeModal) ?? null

  useEffect(() => {
    if (autoOpenedInstall || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('setup') !== 'install') return
    if (!user || installDone) return
    window.setTimeout(() => {
      setAutoOpenedInstall(true)
      setActiveModal('install')
      setActionMessage('Install HHS now. If your browser shows the install button, tap it, then continue from the new Home Screen app icon.')
    }, 0)
  }, [autoOpenedInstall, installDone, user])

  const handleNativeInstall = async () => {
    const prompt = deferredPrompt.current
    if (!prompt) {
      setActionMessage(oneTapInstallUnavailableMessage())
      return
    }
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    setCanNativeInstall(false)
    if (outcome === 'accepted') {
      setActionMessage('Install accepted. Reopen HHS from the Home Screen icon so the app can verify and save the detected install.')
    } else {
      setActionMessage('Install was dismissed. You can still use the manual steps below.')
    }
  }

  const openPaymentLink = async () => {
    if (!user) {
      router.push('/auth')
      return
    }
    if (!selectedTier) {
      router.push(user ? '/auth/complete' : '/auth')
      return
    }

    const tier = HHS_PAYMENT_TIERS[selectedTier as HhsPaymentTier]
    const now = new Date().toISOString()
    await supabase
      .from('profiles')
      .update({
        venmo_clicked_at: now,
        native_membership_amount: profile?.nativeMembershipAmount ?? tier.amount,
      })
      .eq('id', user.id)

    await refreshLiveState()

    openHhsVenmoPayment(selectedTier as HhsPaymentTier)
  }

  const handleRowClick = (row: ChecklistRow) => {
    setActionMessage(null)
    if (row.key === 'profile' && !row.done) {
      router.push(user ? '/auth/complete' : '/auth')
      return
    }
    if (row.key === 'membership' && !row.done) {
      router.push(user ? '/auth/complete' : '/auth')
      return
    }
    if (row.key === 'paid' && paymentStatus === 'not_complete') {
      void openPaymentLink()
      return
    }
    if (row.key === 'install' && canNativeInstall && !row.done) {
      setActiveModal(row.key)
      void handleNativeInstall()
      return
    }
    if (row.key === 'notifications' && !row.done && canUsePushHere() && notificationPermission !== 'denied') {
      setActiveModal(row.key)
      void enableNotifications()
      return
    }
    setActiveModal(row.key)
  }

  async function enableNotifications() {
    if (!user) {
      setActionMessage('Sign in first so HHS can save the push subscription to your member profile.')
      return
    }
    if (!canUsePushHere()) {
      setActionMessage(isIOS() && !isPWA()
        ? 'On iPhone, install HHS to your Home Screen first, then open the installed app to enable notifications.'
        : 'This browser does not expose the web push APIs here. Use the platform steps below.')
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
          paddingBottom: 'clamp(4rem, 8vw, 6rem)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 'min(54rem, calc(100% - 2rem))',
            height: 1,
            margin: '0 auto clamp(1.75rem, 4vw, 2.25rem)',
            background: 'rgba(217, 124, 43, 0.28)',
          }}
        />

        <div style={{ marginBottom: '1rem' }}>
          <SectionHeading
            eyebrow="Membership Checklist"
            eyebrowColor="var(--gold)"
            title={allReady ? 'You are ready for October.' : 'Get yourself ready'}
            intro={allReady
              ? 'Everything HHS can verify is in place. Keep the app handy for the first reveal when the ritual begins.'
              : 'Tap on any row in red to complete the action.'}
          />
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
              onClick={() => handleRowClick(row)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
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
                {row.actionLabel && !row.done ? (
                  <span style={{ display: 'block', color: 'var(--gold)', fontFamily: displayFont, fontSize: '0.68rem', letterSpacing: '0.14em', marginTop: '0.35rem', textTransform: 'uppercase' }}>
                    {row.actionLabel}
                  </span>
                ) : null}
              </span>
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

            {activeRow.key === 'profile' ? (
              <p style={modalBodyStyle}>
                Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. If this is missing, use your approved member setup link to finish your Society name and membership setup.
              </p>
            ) : null}

            {activeRow.key === 'membership' ? (
              <p style={modalBodyStyle}>
                Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. If this is missing, use the approved member setup flow to choose The Hallowed or The Oddballs.
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
                <p style={modalBodyStyle}>
                  HHS no longer marks this complete from an “I did it” button. Reopen from the installed icon and the app will save the detected Home Screen state.
                </p>
              </>
            ) : null}

            {activeRow.key === 'notifications' ? (
              <>
                <p style={modalBodyStyle}>
                  Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>.
                </p>
                {activeRow.done ? (
                  <p style={{ ...modalBodyStyle, color: '#bbf7d0' }}>
                    This step is complete. HHS can verify notification permission and a saved push subscription for your account.
                  </p>
                ) : null}
                {!activeRow.done && canUsePushHere() && notificationPermission !== 'denied' ? (
                  <button type="button" onClick={enableNotifications} disabled={subscribing} style={primaryButtonStyle}>
                    {subscribing ? 'Enabling…' : 'Enable Notifications'}
                  </button>
                ) : null}
                <GuidanceSteps type="notifications" />
              </>
            ) : null}

            {activeRow.key === 'paid' ? (
              <>
                <p style={modalBodyStyle}>
                  Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>. The first tap records the Venmo handoff. This is only complete after Zach confirms the payment in the admin roster.
                </p>
                {paymentStatus === 'not_complete' ? (
                  <button type="button" onClick={openPaymentLink} style={primaryButtonStyle}>
                    Open Venmo
                  </button>
                ) : null}
              </>
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
