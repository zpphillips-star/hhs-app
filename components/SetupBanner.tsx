'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function isNativeApp() {
  if (typeof window === 'undefined') return false
  if ((window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__) return true
  try { if (localStorage.getItem('__hhs_native_app__') === '1') return true } catch { /* ignore */ }
  return false
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
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Chrome'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null

type Step = 'install' | 'notify' | 'done'

export default function SetupBanner() {
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step | null>(null)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [showInstallSteps, setShowInstallSteps] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [notifBlocked, setNotifBlocked] = useState(false)

  // Don't render at all in the native app — install/PWA prompts are not applicable
  if (isNativeApp()) return null

  // Capture native install prompt (Android/desktop Chrome/Edge)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      setCanNativeInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // On every page load: check real state from Supabase + browser
  useEffect(() => {
    // Skip entirely when running inside the HHS native Android app.
    // The native app manages its own membership onboarding overlay and sets
    // window.__HHS_NATIVE_APP__ via injectedJavaScriptBeforeContentLoaded.
    if (typeof window !== 'undefined' && (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__) {
      return
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const runningAsPWA = isPWA()
      const onMobile = isIOS() || isAndroid()

      // Also check DB (used for admin tracking only, not modal logic)
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_pwa')
        .eq('id', user.id)
        .single()

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
      const notifPermission = 'Notification' in window ? Notification.permission : 'denied'
      const { data: pushSub } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      const notifDone = notifPermission === 'granted' && !!pushSub

      // Decide which step to show
      if (!installDone) {
        setStep('install')
      } else if (!notifDone) {
        setNotifBlocked(notifPermission === 'denied')
        setStep('notify')
      } else {
        setStep('done')
      }
    })
  }, [])

  // Don't render until we know what to show
  if (!userId || !step || step === 'done') return null

  const markInstalled = async () => {
    if (!userId) return
    await supabase.from('profiles').update({ has_pwa: true }).eq('id', userId)
    setStep('notify')
  }

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanNativeInstall(false)
    if (outcome === 'accepted') await markInstalled()
  }

  const handleEnableNotifications = async () => {
    if (!userId) return
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
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
            headers: { 'Content-Type': 'application/json' },
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

            {canNativeInstall ? (
              <button onClick={handleNativeInstall} style={btnPrimary}>
                Add to Home Screen
              </button>
            ) : (
              <>
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

                {/* Once they've done it manually, let them confirm */}
                {showInstallSteps && (
                  <button onClick={markInstalled} style={{ ...btnPrimary, marginTop: '0.75rem', background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', color: 'var(--gold)' }}>
                    I added it — Next →
                  </button>
                )}
              </>
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

            {notifBlocked ? (
              <div style={infoBox}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.7 }}>
                  Notifications are blocked. Go to{' '}
                  <strong style={{ color: 'var(--gold)' }}>
                    Settings → {isIOS() ? 'Safari' : getBrowserName()} → Notifications
                  </strong>{' '}
                  → allow <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong>, then reload this page.
                </p>
              </div>
            ) : (
              <button onClick={handleEnableNotifications} disabled={subscribing} style={btnPrimary}>
                {subscribing ? 'Enabling...' : 'Enable Notifications'}
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
