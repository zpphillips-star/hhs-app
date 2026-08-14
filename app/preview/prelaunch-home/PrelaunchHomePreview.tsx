'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import HomeCountdownJoin from '@/components/HomeCountdownJoin'
import { supabase } from '@/lib/supabase'
import { normalizeMembershipTier } from '@/lib/membership'
import { HHS_APP_HOME_ROUTE } from '@/lib/routes'
import { HHS_PAYMENT_TIERS, type HhsPaymentTier, openHhsVenmoPayment } from '@/lib/venmo'
import {
  NotificationPermissionRecovery,
  canUseWebPushHere,
  detectNotificationBrowser,
  getNotificationPermissionState,
  type NotificationPermissionState,
} from '@/components/NotificationPermissionRecovery'

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
  paymentReviewStatus: PaymentReviewStatus | null
  paymentConfirmedAt: string | null
  setupOverrideAt: string | null
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
type PaymentReviewStatus = 'paid' | 'not_paid' | 'not_reviewed'
type InAppBrowser = 'gmail-android' | 'gmail-ios' | 'webview' | null

type ProfileRow = {
  username?: string | null
  display_name?: string | null
  email?: string | null
  tier?: string | null
  status?: string | null
  has_pwa?: boolean | null
  venmo_clicked_at?: string | null
  native_membership_amount?: number | null
  payment_review_status?: PaymentReviewStatus | null
  payment_confirmed_at?: string | null
  setup_override_at?: string | null
}

type ChosenMembership = {
  tier: HhsPaymentTier
  amount: number
}

const displayFont = 'var(--font-display), "Modern Antiqua", Georgia, serif'
const bodyFont = 'var(--font-body), "Crimson Text", Georgia, serif'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type InstallPromptWindow = Window & {
  __hhsInstallPrompt?: BeforeInstallPromptEvent | null
  __hhsInstallPromptListenerAttached?: boolean
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

function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return null
  const ua = navigator.userAgent
  const referrer = document.referrer
  const androidGmailReferrer = referrer.startsWith('android-app://com.google.android.gm')
  const androidWebView = /Android/i.test(ua) && (/; wv\)?/i.test(ua) || /\bwv\)/i.test(ua))
  // Gmail can leave a stale android-app:// referrer after "open in Chrome"; only
  // treat it as Gmail when the current UA is still a WebView.
  if (androidGmailReferrer && androidWebView) return 'gmail-android'
  if (/GSA\//.test(ua) && isIOS()) return 'gmail-ios'
  if (androidWebView || /FBAN|FBAV|Instagram/.test(ua)) return 'webview'
  return null
}

function oneTapInstallUnavailableMessage() {
  const browser = getBrowserName()
  if (browser === 'Chrome') {
    return 'Chrome has not offered the one-tap install button here. That can happen if HHS is already installed, this page was opened inside another app, or Chrome has not made the prompt available yet. Use the steps below.'
  }
  return `${browser} has not offered a one-tap install button here. Use the steps below.`
}

function canProbeForNativeInstall() {
  return typeof window !== 'undefined' && isAndroid() && !isPWA() && !detectInAppBrowser()
}

function canRefreshForNativeInstall() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return canProbeForNativeInstall() && (/Chrome\/|EdgA\//.test(ua)) && !/SamsungBrowser|OPR\/|Opera|Firefox|FBAN|FBAV|Instagram|; wv\)?|\bwv\)/i.test(ua)
}

function getCachedInstallPrompt() {
  if (typeof window === 'undefined') return null
  return (window as InstallPromptWindow).__hhsInstallPrompt ?? null
}

function setCachedInstallPrompt(prompt: BeforeInstallPromptEvent | null) {
  if (typeof window === 'undefined') return
  ;(window as InstallPromptWindow).__hhsInstallPrompt = prompt
}

function ensureInstallPromptCapture() {
  if (typeof window === 'undefined') return
  const installWindow = window as InstallPromptWindow
  if (installWindow.__hhsInstallPromptListenerAttached) return
  installWindow.__hhsInstallPromptListenerAttached = true
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    installWindow.__hhsInstallPrompt = e as BeforeInstallPromptEvent
  })
}

ensureInstallPromptCapture()

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

function membershipFromProfile(profile: Pick<PreviewProfile, 'tier' | 'nativeMembershipAmount'> | null | undefined): ChosenMembership | null {
  const normalized = normalizeMembershipTier(profile?.tier)
  if (normalized === 'hallowed' || normalized === 'oddballs') {
    return {
      tier: normalized,
      amount: profile?.nativeMembershipAmount ?? HHS_PAYMENT_TIERS[normalized].amount,
    }
  }

  if (profile?.nativeMembershipAmount === HHS_PAYMENT_TIERS.hallowed.amount) {
    return { tier: 'hallowed', amount: HHS_PAYMENT_TIERS.hallowed.amount }
  }
  if (profile?.nativeMembershipAmount === HHS_PAYMENT_TIERS.oddballs.amount) {
    return { tier: 'oddballs', amount: HHS_PAYMENT_TIERS.oddballs.amount }
  }

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
    const inAppBrowser = detectInAppBrowser()
    if (inAppBrowser) {
      return (
        <ol style={modalListStyle}>
          <li>
            {inAppBrowser === 'gmail-android'
              ? 'You are still inside Gmail’s in-app browser. Tap the browser icon or menu and choose Open in Chrome.'
              : inAppBrowser === 'gmail-ios'
                ? 'You are still inside Gmail. Choose Open in Safari from the Gmail browser controls.'
              : 'You are inside an in-app browser. Open this page in Safari, Chrome, Edge, or Samsung Internet before installing.'}
          </li>
          <li>After the real browser opens, return to this setup page and tap the install button if it appears.</li>
          <li>If no one-tap install appears, use the browser menu to install HHS or add it to your Home Screen.</li>
          <li>Then open <strong>HHS</strong> from the new Home Screen app icon.</li>
        </ol>
      )
    }
    if (isIOS()) {
      return (
        <ol style={modalListStyle}>
          <li>Use Safari. iOS only allows Home Screen installs from Safari.</li>
          <li>Tap the Share button at the bottom of Safari.</li>
          <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
          <li>Open <strong>HHS</strong> from the new Home Screen icon so the app can detect the install.</li>
        </ol>
      )
    }
    if (isAndroid()) {
      return (
        <ol style={modalListStyle}>
          <li>Use Chrome, Edge, or Samsung Internet if possible.</li>
          <li>Tap the browser menu (⋮ or ···).</li>
          <li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Open <strong>HHS</strong> from the installed Home Screen icon.</li>
        </ol>
      )
    }
    return (
      <ol style={modalListStyle}>
        <li>Desktop browsers may show an install option, but HHS setup is meant to finish on your phone.</li>
        <li>If no install button is shown here, open hallowedhopsociety.com on your phone and add HHS to your Home Screen there.</li>
        <li>After installing on your phone, open <strong>HHS</strong> from the Home Screen icon.</li>
      </ol>
    )
  }

  if (isIOS()) {
    return (
      <ol style={modalListStyle}>
        <li>Install HHS to your Home Screen first; iOS web push works from the installed app.</li>
        <li>Open HHS from the Home Screen icon, not an in-browser tab.</li>
        <li>Tap <strong>Enable Notifications</strong> and approve the system prompt.</li>
      <li>If blocked, open iOS Settings → Notifications → HHS and allow notifications, then return.</li>
      </ol>
    )
  }
  return (
    <ol style={modalListStyle}>
      <li>Tap <strong>Enable Notifications</strong> and approve the browser permission prompt.</li>
      <li>If blocked, open {getBrowserName()} settings → Site settings → Notifications.</li>
      <li>Allow hallowedhopsociety.com, then return here. The row will re-check automatically.</li>
    </ol>
  )
}

export default function PrelaunchHomePreview() {
  const router = useRouter()
  const [countdown, setCountdown] = useState<Countdown>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<PreviewProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [runningAsPwa, setRunningAsPwa] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(() => !!getCachedInstallPrompt())
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>('unsupported')
  const [hasPushSubscription, setHasPushSubscription] = useState(false)
  const [activeModal, setActiveModal] = useState<ChecklistKey | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [autoOpenedInstall, setAutoOpenedInstall] = useState(false)
  const [installPromptChecking, setInstallPromptChecking] = useState(false)
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(getCachedInstallPrompt())
  const installPromptCheckTimer = useRef<number | null>(null)
  const activeModalRef = useRef<ChecklistKey | null>(null)

  useEffect(() => {
    const tick = () => setCountdown(buildCountdown())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    ensureInstallPromptCapture()
    const syncCachedPrompt = window.setTimeout(() => {
      const cachedPrompt = getCachedInstallPrompt()
      if (cachedPrompt) {
        deferredPrompt.current = cachedPrompt
        setCanNativeInstall(true)
        setInstallPromptChecking(false)
      }
    }, 0)

    const handler = (e: Event) => {
      e.preventDefault()
      const prompt = e as BeforeInstallPromptEvent
      setCachedInstallPrompt(prompt)
      deferredPrompt.current = prompt
      setCanNativeInstall(true)
      setInstallPromptChecking(false)
      if (activeModalRef.current === 'install') {
        setActionMessage('The browser install prompt is ready. Tap Install HHS to this phone, then open HHS from the new Home Screen app icon.')
      }
      if (installPromptCheckTimer.current) {
        window.clearTimeout(installPromptCheckTimer.current)
        installPromptCheckTimer.current = null
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => {
      window.clearTimeout(syncCachedPrompt)
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const startInstallPromptCheck = useCallback(() => {
    if (typeof window === 'undefined') return
    if (installPromptCheckTimer.current) {
      window.clearTimeout(installPromptCheckTimer.current)
      installPromptCheckTimer.current = null
    }
    const cachedPrompt = deferredPrompt.current ?? getCachedInstallPrompt()
    if (cachedPrompt) {
      deferredPrompt.current = cachedPrompt
      setCanNativeInstall(true)
      setInstallPromptChecking(false)
      return
    }
    if (!canProbeForNativeInstall()) {
      setInstallPromptChecking(false)
      return
    }
    setInstallPromptChecking(true)
    installPromptCheckTimer.current = window.setTimeout(() => {
      setInstallPromptChecking(false)
      if (activeModalRef.current === 'install') {
        setActionMessage(oneTapInstallUnavailableMessage())
      }
      installPromptCheckTimer.current = null
    }, 2500)
  }, [])

  useEffect(() => {
    const initialCheck = window.setTimeout(startInstallPromptCheck, 0)

    const checkWhenPageReturns = () => {
      if (document.visibilityState === 'hidden') return
      startInstallPromptCheck()
    }

    window.addEventListener('focus', checkWhenPageReturns)
    window.addEventListener('pageshow', checkWhenPageReturns)
    document.addEventListener('visibilitychange', checkWhenPageReturns)

    return () => {
      window.clearTimeout(initialCheck)
      if (installPromptCheckTimer.current) window.clearTimeout(installPromptCheckTimer.current)
      window.removeEventListener('focus', checkWhenPageReturns)
      window.removeEventListener('pageshow', checkWhenPageReturns)
      document.removeEventListener('visibilitychange', checkWhenPageReturns)
    }
  }, [startInstallPromptCheck])

  useEffect(() => {
    activeModalRef.current = activeModal
  }, [activeModal])

  const refreshLiveState = useCallback(async () => {
    const detectedPwa = isPWA()
    setRunningAsPwa(detectedPwa)
    setNotificationPermission(getNotificationPermissionState())

    const { data: { user: authUser } } = await supabase.auth.getUser()
    setUser(authUser)
    if (!authUser) {
      setProfile(null)
      setHasPushSubscription(false)
      setLoadingProfile(false)
      return
    }

    const profileSelect = 'username, display_name, email, tier, status, has_pwa, venmo_clicked_at, native_membership_amount, payment_review_status, payment_confirmed_at, setup_override_at'
    const fallbackProfileSelect = 'username, display_name, email, tier, status, has_pwa, venmo_clicked_at, native_membership_amount'
    const profileResult = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', authUser.id)
      .maybeSingle()
    let profileRow = profileResult.data as ProfileRow | null
    let profileError = profileResult.error
    if (profileError && /payment_review_status|payment_confirmed_at|setup_override_at/i.test(profileError.message)) {
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
      paymentReviewStatus: row?.payment_review_status ?? null,
      paymentConfirmedAt: row?.payment_confirmed_at ?? null,
      setupOverrideAt: row?.setup_override_at ?? null,
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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshLiveState()
    }

    window.addEventListener('focus', refreshWhenVisible)
    window.addEventListener('pageshow', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      window.removeEventListener('pageshow', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshLiveState])

  const memberUsername = profile?.username ? `@${profile.username}` : null
  const chosenMembership = useMemo(
    () => membershipFromProfile({
      tier: profile?.tier ?? null,
      nativeMembershipAmount: profile?.nativeMembershipAmount ?? null,
    }),
    [profile?.nativeMembershipAmount, profile?.tier],
  )
  const selectedTier = chosenMembership?.tier ?? null
  const profileDone = !!user && profile?.status === 'approved' && !!profile?.username
  const membershipDone = !!chosenMembership
  const installDone = runningAsPwa || profile?.hasPwa === true
  const notificationDone = notificationPermission === 'granted' && hasPushSubscription
  const paymentStatus: PaymentStatus = profile?.paymentReviewStatus === 'paid' || profile?.paymentConfirmedAt
    ? 'confirmed'
    : profile?.paymentReviewStatus === 'not_paid'
      ? 'not_complete'
    : profile?.venmoClickedAt
      ? 'in_process'
      : 'not_complete'
  const paymentDone = paymentStatus === 'confirmed'
  const expectedAmount = chosenMembership?.amount ?? tierAmount(profile?.tier)
  const paymentValue = paymentStatus === 'confirmed'
    ? `Payment confirmed${expectedAmount ? ` · $${expectedAmount}` : ''}`
    : paymentStatus === 'in_process'
      ? `Awaiting Zach’s verification${expectedAmount ? ` · $${expectedAmount}` : ''}`
      : 'Payment not received'
  const setupOverrideActive = profile?.status === 'approved' && !!profile?.setupOverrideAt

  useEffect(() => {
    if (paymentStatus !== 'in_process') return
    const id = window.setInterval(() => {
      void refreshLiveState()
    }, 15000)
    return () => window.clearInterval(id)
  }, [paymentStatus, refreshLiveState])

  const rows: ChecklistRow[] = useMemo(() => [
    {
      key: 'profile',
      label: 'Setup member profile',
      value: user ? memberUsername ?? 'Username missing' : 'Sign in to view',
      done: setupOverrideActive || profileDone,
      summary: setupOverrideActive && !profileDone
        ? 'Zach has opened entry for your account while the profile detail is finished.'
        : profileDone
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
      done: setupOverrideActive || membershipDone,
      summary: setupOverrideActive && !membershipDone
        ? 'Zach has opened entry for your account while membership details are finalized.'
        : membershipDone
        ? `Your Society membership is set to ${tierLabel(selectedTier)}.`
        : 'Choose The Hallowed or The Oddballs in the approved member setup flow.',
      actionLabel: 'Select Membership',
    },
    {
      key: 'install',
      label: 'Install app to phone',
      value: runningAsPwa
        ? 'Detected from Home Screen'
        : profile?.hasPwa
          ? 'Previously detected'
          : canNativeInstall
            ? 'Install available'
            : installPromptChecking
              ? 'Checking install availability'
              : 'Not detected',
      done: setupOverrideActive || installDone,
      summary: setupOverrideActive && !installDone
        ? 'Zach has opened entry for your account without requiring Home Screen install detection first.'
        : installDone
        ? 'HHS has detected the installed Home Screen app state.'
        : installPromptChecking
          ? 'HHS is waiting briefly for the browser install prompt to become available after the page returned from another app.'
          : 'Install HHS to your Home Screen, then open it from the new app icon so HHS can detect and save the install.',
      actionLabel: canNativeInstall ? 'Install HHS' : installPromptChecking ? 'Checking install' : 'Open install guide',
    },
    {
      key: 'notifications',
      label: 'Enable notifications',
      value: notificationDone ? 'Enabled' : notificationPermission === 'denied' ? 'Notifications blocked' : notificationPermission === 'unsupported' ? 'Not available in this browser' : 'Not enabled',
      done: setupOverrideActive || notificationDone,
      summary: setupOverrideActive && !notificationDone
        ? 'Zach has opened entry for your account without requiring notifications first.'
        : notificationDone
        ? 'Notifications are enabled and HHS has a saved push subscription for your account.'
        : isIOS() && !installDone
          ? 'Install HHS to your Home Screen first; iPhone notifications can only be enabled from the installed app.'
          : 'Tap to enable notifications and save the HHS push subscription for your account.',
      actionLabel: 'Enable Notifications',
    },
    {
      key: 'paid',
      label: 'Pay membership dues',
      value: paymentStatus === 'not_complete' && chosenMembership
        ? `Payment not received · $${chosenMembership.amount}`
        : paymentValue,
      done: setupOverrideActive || paymentDone,
      summary: setupOverrideActive && !paymentDone
        ? 'Zach has opened entry for your account while payment review stays separate.'
        : paymentDone
        ? 'Zach has confirmed your dues as received.'
        : paymentStatus === 'in_process'
          ? 'You attempted to send payment. Zach now needs to verify the payment was received.'
        : chosenMembership
          ? `Tap to open Venmo with ${tierLabel(chosenMembership.tier)} and $${chosenMembership.amount} filled in.`
          : 'Choose your membership first, then return here to send dues.',
      actionLabel: paymentStatus === 'not_complete' ? 'Open Venmo' : 'Payment Status',
    },
  ], [canNativeInstall, chosenMembership, installDone, installPromptChecking, memberUsername, membershipDone, notificationDone, notificationPermission, paymentDone, paymentStatus, paymentValue, profile?.hasPwa, profile?.tier, profileDone, runningAsPwa, selectedTier, setupOverrideActive, user])

  const allReady = setupOverrideActive || rows.every(row => row.done)
  const activeRow = rows.find(row => row.key === activeModal) ?? null

  useEffect(() => {
    if (!user || allReady) return
    const id = window.setInterval(() => {
      void refreshLiveState()
    }, 8000)
    return () => window.clearInterval(id)
  }, [allReady, refreshLiveState, user])

  useEffect(() => {
    if (autoOpenedInstall || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('setup') !== 'install') return
    if (!user || installDone) return
      window.setTimeout(() => {
        setAutoOpenedInstall(true)
        activeModalRef.current = 'install'
        setActiveModal('install')
        startInstallPromptCheck()
        const installPromptReady = !!(deferredPrompt.current ?? getCachedInstallPrompt())
        setActionMessage(installPromptReady
          ? 'Next step: install HHS to this phone. Tap the install button below, then open HHS from the new Home Screen app icon.'
          : installPromptChecking || canProbeForNativeInstall()
          ? 'Next step: install HHS to this phone. HHS is waiting briefly for the browser install prompt after returning to this page; the install button will appear automatically if the browser exposes it.'
          : 'Next step: install HHS to this phone. Use the guided button or platform steps below, then open HHS from the new Home Screen app icon.')
      }, 0)
  }, [autoOpenedInstall, installDone, installPromptChecking, startInstallPromptCheck, user])

  const handleNativeInstall = async () => {
    const prompt = deferredPrompt.current ?? getCachedInstallPrompt()
    if (!prompt) {
      startInstallPromptCheck()
      setActionMessage(oneTapInstallUnavailableMessage())
      return
    }
    deferredPrompt.current = prompt
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    setCachedInstallPrompt(null)
    setCanNativeInstall(false)
    if (outcome === 'accepted') {
      setActionMessage('Install accepted. Reopen HHS from the Home Screen icon so the app can verify and save the detected install.')
    } else {
      setActionMessage('Install was dismissed. You can still use the manual steps below.')
    }
  }

  const openPaymentLink = async () => {
    const activeUser = user ?? (await supabase.auth.getUser()).data.user
    if (!activeUser) {
      router.push('/auth')
      return
    }

    if (loadingProfile) {
      setActionMessage('One moment — HHS is reading your membership before opening Venmo.')
      await refreshLiveState()
    }

    const { data: latestProfile, error: latestProfileError } = await supabase
      .from('profiles')
      .select('tier, native_membership_amount')
      .eq('id', activeUser.id)
      .maybeSingle()

    const latestMembership = latestProfileError
      ? chosenMembership
      : membershipFromProfile({
          tier: latestProfile?.tier ?? profile?.tier ?? null,
          nativeMembershipAmount: latestProfile?.native_membership_amount ?? profile?.nativeMembershipAmount ?? null,
        })

    if (!latestMembership) {
      router.push('/auth/complete')
      return
    }

    const now = new Date().toISOString()
    const paymentUpdate = {
      venmo_clicked_at: now,
      native_membership_amount: latestMembership.amount,
      payment_review_status: 'not_reviewed' as PaymentReviewStatus,
      payment_confirmed_at: null,
    }
    const paymentUpdateResult = await supabase
      .from('profiles')
      .update(paymentUpdate)
      .eq('id', activeUser.id)
    const paymentUpdateError = paymentUpdateResult.error && /payment_review_status|payment_confirmed_at/i.test(paymentUpdateResult.error.message)
      ? (await supabase
          .from('profiles')
          .update({
            venmo_clicked_at: now,
            native_membership_amount: latestMembership.amount,
          })
          .eq('id', activeUser.id)).error
      : paymentUpdateResult.error

    if (paymentUpdateError) {
      setActionMessage('Venmo is opening, but HHS could not save the payment attempt yet. After sending dues, check back here or tell Zach.')
    } else {
      setProfile(prev => prev
        ? {
            ...prev,
            tier: latestMembership.tier,
            venmoClickedAt: now,
            nativeMembershipAmount: latestMembership.amount,
            paymentReviewStatus: 'not_reviewed',
            paymentConfirmedAt: null,
          }
        : prev)
      setActionMessage(null)
    }

    openHhsVenmoPayment(latestMembership.tier)
    window.setTimeout(() => {
      if (installDone) return
      startInstallPromptCheck()
      setActiveModal('install')
      setActionMessage(canProbeForNativeInstall()
        ? 'After sending dues, install HHS to this phone. HHS is checking whether this browser can show the one-tap install button; it will appear here automatically if available.'
        : 'After sending dues, install HHS to this phone. Use the platform steps below, then open HHS from the new Home Screen app icon.')
    }, 1200)
    void refreshLiveState()
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
    if (row.key === 'paid' && !row.done && paymentStatus === 'not_complete') {
      void openPaymentLink()
      return
    }
    if (row.key === 'install' && !row.done) {
      activeModalRef.current = 'install'
      setActiveModal(row.key)
      startInstallPromptCheck()
      const installPromptReady = canNativeInstall || !!(deferredPrompt.current ?? getCachedInstallPrompt())
      if (installPromptReady) {
        setActionMessage('This browser can install HHS directly. Tap the install button below, then open HHS from the new Home Screen app icon.')
      } else if (installPromptChecking || canProbeForNativeInstall()) {
        setActionMessage('One moment — HHS is waiting for this browser to report whether one-tap install is available. If it appears, the install button will show here automatically.')
      } else {
        setActionMessage('Use the instructions below to add HHS to your Home Screen, then open HHS from the new app icon.')
      }
      return
    }
    if (row.key === 'notifications' && !row.done && canUseWebPushHere() && notificationPermission !== 'denied') {
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
    const currentPermission = getNotificationPermissionState()
    setNotificationPermission(currentPermission)
    if (!canUseWebPushHere() || currentPermission === 'unsupported') {
      setActionMessage(isIOS() && !isPWA()
        ? 'On iPhone, install HHS to your Home Screen first, then open the installed app to enable notifications.'
        : 'This browser does not expose the web push APIs here. Use the platform steps below.')
      return
    }
    if (currentPermission === 'denied') {
      setActionMessage('Notifications are blocked in browser settings. Use the recovery steps below, then return to HHS.')
      return
    }
    setSubscribing(true)
    setActionMessage(null)
    try {
      const perm = currentPermission === 'granted' ? 'granted' : await Notification.requestPermission()
      setNotificationPermission(perm)
      if (perm !== 'granted') {
        setActionMessage(perm === 'denied' ? 'Notifications are blocked in browser settings. Use the recovery steps below, then return to HHS.' : 'Notification permission was not granted.')
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

        {allReady ? (
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: 'clamp(1.65rem, 4vw, 2.55rem)', lineHeight: 1.08, margin: 0 }}>
              Congratulations
            </h2>
            <p style={{ color: 'var(--text-muted)', fontFamily: bodyFont, fontSize: '1.06rem', lineHeight: 1.7, margin: '0.75rem 0 1rem', maxWidth: 760 }}>
              You&apos;ve successfully completed the difficult setup journey.
            </p>
            <button type="button" onClick={() => router.push(HHS_APP_HOME_ROUTE)} style={primaryButtonStyle}>
              you may now enter the Hallowed Hop Society
            </button>

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
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <SectionHeading
                eyebrow="Membership Checklist"
                eyebrowColor="var(--gold)"
                title="Must complete prior to entry"
                intro="Complete each red row before entering the member app. Install must be completed from real Home Screen app detection, not a manual checkbox."
              />
            </div>

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
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
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
              {activeRow.key === 'install' && !activeRow.done ? null : <CheckIcon done={activeRow.done} />}
              <div>
                <h3 id="prelaunch-modal-title" style={{ color: 'var(--text)', fontFamily: displayFont, fontSize: '1.45rem', lineHeight: 1.1, margin: 0 }}>
                  {activeRow.label}
                </h3>
                <p style={{
                  color: activeRow.key === 'install' ? 'var(--gold)' : 'var(--text-muted)',
                  fontFamily: bodyFont,
                  fontSize: '0.96rem',
                  lineHeight: 1.5,
                  margin: '0.35rem 0 0',
                }}>
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
                {detectInAppBrowser() ? (
                  <p style={{ ...modalBodyStyle, border: '1px solid rgba(248,113,113,0.28)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(239,68,68,0.08)' }}>
                    HHS can only be installed from a real browser. This looks like an in-app browser, so follow the first step below to open Safari, Chrome, Edge, or Samsung Internet.
                  </p>
                ) : null}
                {canNativeInstall ? (
                  <button type="button" onClick={handleNativeInstall} style={primaryButtonStyle}>
                    Install HHS to this phone
                  </button>
                ) : null}
                <GuidanceSteps type="install" />
                {!canNativeInstall && canRefreshForNativeInstall() ? (
                  <div style={{ border: '1px solid rgba(217,124,43,0.22)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(217,124,43,0.08)', marginTop: '0.85rem' }}>
                    <p style={{ ...modalBodyStyle, marginBottom: '0.75rem' }}>
                      If this is your first time opening HHS in Chrome or Edge and the install button is missing, the browser may still be finishing its first PWA installability check. Refresh once, then reopen this install step.
                    </p>
                    <button type="button" onClick={() => window.location.reload()} style={secondaryButtonStyle}>
                      Refresh install check
                    </button>
                  </div>
                ) : null}
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
                {!activeRow.done && canUseWebPushHere() && notificationPermission !== 'denied' && notificationPermission !== 'unsupported' ? (
                  <button type="button" onClick={enableNotifications} disabled={subscribing} style={primaryButtonStyle}>
                    {subscribing ? 'Enabling…' : notificationPermission === 'granted' ? 'Finish Enabling Notifications' : 'Enable Notifications'}
                  </button>
                ) : null}
                {!activeRow.done && (notificationPermission === 'denied' || !canUseWebPushHere() || notificationPermission === 'unsupported') ? (
                  <NotificationPermissionRecovery
                    permission={notificationPermission === 'denied' ? 'denied' : 'unsupported'}
                    browser={detectNotificationBrowser()}
                    style={{ border: '1px solid rgba(217,124,43,0.22)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(217,124,43,0.08)', marginBottom: '1rem' }}
                  />
                ) : null}
                <GuidanceSteps type="notifications" />
              </>
            ) : null}

            {activeRow.key === 'paid' ? (
              <>
                <p style={modalBodyStyle}>
                  Current value: <strong style={{ color: 'var(--text)' }}>{activeRow.value}</strong>.
                </p>
                {paymentStatus === 'confirmed' ? (
                  <p style={{ ...modalBodyStyle, color: '#bbf7d0' }}>
                    Zach has verified your membership dues were received. This step is complete.
                  </p>
                ) : paymentStatus === 'in_process' ? (
                  <p style={modalBodyStyle}>
                    You attempted to send payment. Zach now needs to verify the payment was received. If Zach cannot confirm it, this step will reopen so you can send dues again.
                  </p>
                ) : (
                  <p style={modalBodyStyle}>
                    Tap Open Venmo to send your membership dues to Zach. HHS records that you started payment, and Zach confirms this step after the payment is received.
                  </p>
                )}
                {paymentStatus === 'not_complete' ? (
                  <button type="button" onClick={openPaymentLink} style={primaryButtonStyle}>
                    Open Venmo
                  </button>
                ) : null}
              </>
            ) : null}

            {actionMessage && activeRow.key !== 'install' ? (
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
