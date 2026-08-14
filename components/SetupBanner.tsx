'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  NotificationPermissionRecovery,
  canUseWebPushHere,
  detectNotificationBrowser,
  getNotificationPermissionState,
  type NotificationPermissionState,
} from '@/components/NotificationPermissionRecovery'

function isPWA() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

// FIX 2: Detect native app via injected flag or localStorage — suppress entire
// install/setup UI when running inside the HHS React Native WebView.
function isNativeApp() {
  if (typeof window === 'undefined') return false
  if ((window as unknown as Record<string, unknown>).__HHS_NATIVE_APP__) return true
  try { return localStorage.getItem('__hhs_native_app__') === '1' } catch { return false }
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
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Chrome'
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
type InstallPromptWindow = Window & {
  __hhsInstallPrompt?: BeforeInstallPromptEvent | null
}
function getCachedInstallPrompt() {
  if (typeof window === 'undefined') return null
  return (window as InstallPromptWindow).__hhsInstallPrompt ?? null
}
function setCachedInstallPrompt(prompt: BeforeInstallPromptEvent | null) {
  if (typeof window === 'undefined') return
  ;(window as InstallPromptWindow).__hhsInstallPrompt = prompt
}
function canRefreshForNativeInstall() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return isAndroid() && !isPWA() && (/Chrome\/|EdgA\//.test(ua)) && !/SamsungBrowser|OPR\/|Opera|Firefox|FBAN|FBAV|Instagram|; wv\)?|\bwv\)/i.test(ua)
}

type Step = 'install' | 'notify' | 'done'

export default function SetupBanner() {
  const pathname = usePathname()
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [canNativeInstall, setCanNativeInstall] = useState(() => !!getCachedInstallPrompt())
  const [showInstallSteps, setShowInstallSteps] = useState(false)
  const [installAccepted, setInstallAccepted] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [notifBlocked, setNotifBlocked] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() => getNotificationPermissionState())
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(getCachedInstallPrompt())
  const isNative = isNativeApp()
  const suppressOnRoute =
    pathname === '/welcome' ||
    pathname === '/admin' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/preview')

  // Capture native install prompt (Android/desktop Chrome/Edge)
  useEffect(() => {
    const syncCachedPrompt = () => {
      const cachedPrompt = getCachedInstallPrompt()
      if (!cachedPrompt) return
      deferredPrompt.current = cachedPrompt
      setCanNativeInstall(true)
    }
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setCachedInstallPrompt(deferredPrompt.current)
      setCanNativeInstall(true)
    }
    syncCachedPrompt()
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('hhs-beforeinstallprompt', syncCachedPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('hhs-beforeinstallprompt', syncCachedPrompt)
    }
  }, [])

  const evaluateSetupState = useCallback(async () => {
    if (isNative || suppressOnRoute) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const runningAsPWA = isPWA()
      const onMobile = isIOS() || isAndroid()

      // Also check DB (used for admin tracking only, not modal logic)
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_pwa, venmo_clicked_at, native_membership_amount')
        .eq('id', user.id)
        .single()

      // This global reminder is only allowed after the payment/Venmo step.
      // New members coming from the approval email complete username/password/tier
      // before payment, so do not interrupt those auth/payment pages with install UI.
      const paymentStarted = !!profile?.venmo_clicked_at || !!profile?.native_membership_amount
      if (!paymentStarted) return

      // If running as PWA right now → installed. Write it to DB if not already set.
      // If NOT running as PWA on mobile → they deleted it (or never installed). Reset DB.
      let installDone = runningAsPWA
      if (runningAsPWA && !profile?.has_pwa) {
        supabase.from('profiles').update({ has_pwa: true }).eq('id', user.id).then(() => {})
      } else if (!runningAsPWA && onMobile && profile?.has_pwa) {
        // They deleted the app — reset the flag so admin dashboard reflects reality
        supabase.from('profiles').update({ has_pwa: false }).eq('id', user.id).then(() => {})
        installDone = false
      } else if (!onMobile) {
        // Desktop — skip the install step entirely, not applicable
        installDone = true
      }

      // Check notifications: browser permission + push subscription in DB
      const currentPermission = getNotificationPermissionState()
      setNotifPermission(currentPermission)
      setNotifBlocked(currentPermission === 'denied')
      const { data: pushSub } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      const notifDone = currentPermission === 'granted' && !!pushSub

      // Decide which step to show
      if (!installDone) {
        setStep('install')
      } else if (!notifDone) {
        setStep('notify')
      } else {
        setStep('done')
      }
    })
  }, [isNative, suppressOnRoute])

  // On every page load: check real state from Supabase + browser.
  useEffect(() => {
    void evaluateSetupState()
  }, [evaluateSetupState])

  // Browser notification settings can change while HHS is backgrounded. Re-check
  // on return so a blocked user who fixes site settings gets the enable button
  // back without needing a reload.
  useEffect(() => {
    if (isNative || suppressOnRoute) return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void evaluateSetupState()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [evaluateSetupState, isNative, suppressOnRoute])

  // Don't render until we know what to show; never render inside native app
  if (isNative || suppressOnRoute || !userId || !step || step === 'done') return null

  const markInstalled = async () => {
    if (!userId) return
    if (isPWA()) {
      await supabase.from('profiles').update({ has_pwa: true }).eq('id', userId)
      setStep('notify')
      return
    }
    setInstallAccepted(true)
  }

  const handleNativeInstall = async () => {
    const prompt = deferredPrompt.current
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    setCachedInstallPrompt(null)
    setCanNativeInstall(false)
    if (outcome === 'accepted') setInstallAccepted(true)
  }

  const handleEnableNotifications = async () => {
    if (!userId) return
    const currentPermission = getNotificationPermissionState()
    setNotifPermission(currentPermission)
    setNotifBlocked(currentPermission === 'denied')
    if (!canUseWebPushHere() || currentPermission === 'denied' || currentPermission === 'unsupported') return
    setSubscribing(true)
    try {
      const perm = currentPermission === 'granted' ? 'granted' : await Notification.requestPermission()
      setNotifPermission(perm)
      if (perm === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready
          const existing = await reg.pushManager.getSubscription()
          const sub = existing || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
          })
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({ subscription: sub.toJSON(), user_id: userId }),
          })
          setStep('done')
        } catch { setStep('done') }
      } else if (perm === 'denied') {
        setNotifBlocked(true)
      }
    } catch { /* silent */ }
    setSubscribing(false)
  }

  return (
    <>
      {/* Dark overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }} />

      {/* Centered modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: 'min(420px, 92vw)',
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,140,0,0.3)',
        borderRadius: '18px',
        padding: '2rem 1.75rem',
        boxShadow: '0 32px 96px rgba(0,0,0,0.8)',
      }}>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {(['install', 'notify'] as Step[]).map((s, i) => (
            <div key={s} style={{
              height: '4px',
              width: step === s ? '1.5rem' : '0.4rem',
              borderRadius: '99px',
              background: (step === 'notify' && i === 0) ? 'var(--gold)'
                : step === s ? 'var(--gold)'
                : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.4rem', textAlign: 'center' }}>
          {step === 'install' ? 'Step 1 of 2' : 'Step 2 of 2'}
        </p>

        {/* ── STEP 1: INSTALL ── */}
        {step === 'install' && (
          <>
            <h2 style={heading}>Add to Home Screen</h2>
            <p style={body}>
              Install the app on your phone so you can receive notifications when your beer drops.
            </p>

            {installAccepted && (
              <div style={{ ...infoBox, borderColor: 'rgba(74,222,128,0.28)', background: 'rgba(34,197,94,0.09)' }}>
                <p style={{ color: '#bbf7d0', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>
                  Install started. Open <strong>HHS</strong> from the new Home Screen app icon. When it opens there, HHS will detect the install and continue with notifications.
                </p>
              </div>
            )}

            {canNativeInstall && !installAccepted ? (
              <button onClick={handleNativeInstall} style={btnPrimary}>
                Add to Home Screen
              </button>
            ) : (
              !installAccepted && <>
                <button
                  onClick={() => setShowInstallSteps(s => !s)}
                  style={btnPrimary}
                >
                  {showInstallSteps ? 'Hide Steps ↑' : 'Show me how →'}
                </button>

                {showInstallSteps && (
                  <div style={infoBox}>
                    {isIOS() ? (
                      <>
                        <InstallStep n={1} text="Tap the Share button at the bottom of Safari" />
                        <InstallStep n={2} text={'Tap "Add to Home Screen"'} />
                        <InstallStep n={3} text="Tap Add — then reopen from your Home Screen and continue" />
                      </>
                    ) : isAndroid() ? (
                      <>
                        <InstallStep n={1} text={`Tap the menu (⋮ or ···) in ${getBrowserName()}`} />
                        <InstallStep n={2} text={'"Add to Home screen" or "Install app"'} />
                        <InstallStep n={3} text="Tap Add — then reopen from your home screen and continue" />
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
                        Open <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong> on your phone to install.
                      </p>
                    )}
                  </div>
                )}
                {canRefreshForNativeInstall() && (
                  <button onClick={() => window.location.reload()} style={{ ...btnPrimary, background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', color: 'var(--gold)' }}>
                    Refresh install check
                  </button>
                )}

                {/* Once they've done it manually, let them confirm */}
                {showInstallSteps && (
                  <button onClick={markInstalled} style={{ ...btnPrimary, marginTop: '0.75rem', background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', color: 'var(--gold)' }}>
                    I installed it — check again →
                  </button>
                )}
              </>
            )}
            {installAccepted && (
              <button onClick={() => setStep(null)} style={{ ...btnPrimary, marginTop: '0.75rem', background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', color: 'var(--gold)' }}>
                I’ll open HHS from the app icon
              </button>
            )}
          </>
        )}

        {/* ── STEP 2: NOTIFICATIONS ── */}
        {step === 'notify' && (
          <>
            <h2 style={heading}>Enable Notifications</h2>
            <p style={body}>
              Get notified the moment each beer is revealed — just for you, based on your membership.
            </p>

            {notifBlocked || !canUseWebPushHere() || notifPermission === 'unsupported' ? (
              <div style={infoBox}>
                <NotificationPermissionRecovery
                  permission={notifPermission === 'denied' ? 'denied' : 'unsupported'}
                  browser={detectNotificationBrowser()}
                />
              </div>
            ) : (
              <button onClick={handleEnableNotifications} disabled={subscribing} style={btnPrimary}>
                {subscribing ? 'Enabling...' : notifPermission === 'granted' ? 'Finish Enabling Notifications' : 'Enable Notifications'}
              </button>
            )}
          </>
        )}

      </div>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InstallStep({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.45rem', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.8rem', minWidth: '1rem', flexShrink: 0 }}>{n}.</span>
      <span style={{ color: 'var(--text)', fontSize: '0.83rem', lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const heading: React.CSSProperties = {
  fontFamily: "'Modern Antiqua', serif",
  fontSize: '1.3rem',
  color: 'var(--text)',
  textAlign: 'center',
  marginBottom: '0.6rem',
}

const body: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.88rem',
  textAlign: 'center',
  marginBottom: '1.5rem',
  lineHeight: 1.7,
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem',
  background: 'var(--gold)',
  border: 'none',
  borderRadius: '10px',
  color: 'var(--bg)',
  fontFamily: "'Modern Antiqua', serif",
  fontSize: '0.85rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  cursor: 'pointer',
  textTransform: 'uppercase',
  marginBottom: '0.5rem',
}

const infoBox: React.CSSProperties = {
  background: 'rgba(255,140,0,0.07)',
  border: '1px solid rgba(255,140,0,0.2)',
  borderRadius: '10px',
  padding: '1rem',
  marginBottom: '0.75rem',
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
