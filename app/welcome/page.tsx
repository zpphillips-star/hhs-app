'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Step = 'welcome' | 'install' | 'notify' | 'done'
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
  if (/Firefox/.test(ua)) return 'Firefox'
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return 'Chrome'
}
function oneTapInstallUnavailableMessage() {
  const browser = getBrowserName()
  if (browser === 'Chrome') {
    return 'Chrome has not offered the one-tap install button here. That can happen if HHS is already installed, this page was opened inside another app, or Chrome has not made the prompt available yet. Use the Chrome menu and choose Install app or Add to Home screen.'
  }
  return `${browser} has not offered a one-tap install button here. Use the browser menu and choose Install app or Add to Home screen.`
}
function canUsePushHere() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  // iOS Safari only exposes web push to installed Home Screen web apps. A normal
  // browser tab cannot grant the permission that the installed PWA will use.
  if (isIOS() && !isPWA()) return false
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [firstName, setFirstName] = useState('')
  const [userId, setUserId] = useState('')
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  )
  const [subscribing, setSubscribing] = useState(false)

  // Capture Android install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      setCanNativeInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Native app guard — if running inside the HHS native WebView, this page is
  // irrelevant (native has its own setup/onboarding flow). Mark setup done and
  // immediately redirect to Today so the user never sees the web install flow.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isNative =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__HHS_NATIVE_APP__ === true ||
      (() => {
        try { return localStorage.getItem('__hhs_native_app__') === '1' } catch { return false }
      })()
    if (isNative) {
      try { localStorage.setItem('hhs_setup_done', '1') } catch { /* ignore */ }
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }

      // In native app: skip the webapp welcome/install flow — go directly to Today
      const nativeApp =
        !!(window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
        localStorage.getItem('__hhs_native_app__') === '1'
      if (nativeApp) {
        localStorage.setItem('hhs_setup_done', '1')
        router.replace('/')
        return
      }

      setUserId(user.id)
      setFirstName(user.user_metadata?.first_name || '')
    })
  }, [router])

  const markPWA = async (uid: string) => {
    await supabase.from('profiles').update({ has_pwa: true }).eq('id', uid)
  }

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const subscribeNotifications = async () => {
    if (!canUsePushHere()) {
      setStep('done')
      return
    }
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setNotifPermission(perm)
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
          body: JSON.stringify({ subscription: sub.toJSON(), user_id: userId }),
        })
      }
      setStep('done')
    } catch {
      setStep('done')
    }
    setSubscribing(false)
  }

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanNativeInstall(false)
    if (outcome === 'accepted') {
      await markPWA(userId)
      setTimeout(() => setStep('notify'), 500)
    }
  }

  const goToNotify = async () => {
    await markPWA(userId)
    setStep('notify')
  }

  const finish = () => {
    localStorage.setItem('hhs_setup_done', '1')
    // Trigger same-tab banner dismiss (storage event only fires in OTHER tabs)
    window.dispatchEvent(new StorageEvent('storage', { key: 'hhs_setup_done', newValue: '1' }))
    router.push('/')
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* ── STEP: WELCOME ── */}
        {step === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <Image src="/hhs_no_circles_300dpi.webp" alt="HHS" width={90} height={90} className="mx-auto mb-6 opacity-90" />
            <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
              You&apos;re In
            </p>
            <h1 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              Welcome{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
              Payment is the last membership step. Now let&apos;s add HHS to your phone and turn on beer notifications.
            </p>
            <button onClick={() => setStep('install')} style={btnPrimary}>
              Set Up App & Notifications →
            </button>
          </div>
        )}

        {/* ── STEP: INSTALL ── */}
        {step === 'install' && (
          <div>
            <StepIndicator current={1} total={2} />
            <h2 style={heading}>Add to your Home Screen</h2>
            <p style={body}>
              Install HHS first, then enable beer notifications from this same setup flow where your browser supports it.
            </p>

            {canNativeInstall ? (
              <>
                <button onClick={handleAndroidInstall} style={{ ...btnPrimary, marginBottom: '0.75rem' }}>
                  Install HHS
                </button>
                <button onClick={() => setStep('notify')} style={btnSecondary}>
                  Skip for now
                </button>
              </>
            ) : isIOS() ? (
              <>
                <div style={infoBox}>
                  <p style={infoStep}><span style={dot}>1</span> Open this page in Safari if you are not already there.</p>
                  <p style={infoStep}><span style={dot}>2</span> Tap Share → <strong style={{ color: 'var(--gold)' }}>Add to Home Screen</strong> → Add.</p>
                  <p style={infoStep}><span style={dot}>3</span> Open HHS from the new Home Screen icon to enable notifications.</p>
                </div>
                <button onClick={goToNotify} style={{ ...btnPrimary, marginTop: '1.25rem' }}>
                  I added it — continue →
                </button>
                <button onClick={() => setStep('notify')} style={btnSecondary}>
                  Skip for now
                </button>
              </>
            ) : isAndroid() ? (
              <>
                <div style={infoBox}>
                  <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    {oneTapInstallUnavailableMessage()}
                  </p>
                </div>
                <button onClick={goToNotify} style={{ ...btnPrimary, marginTop: '1.25rem' }}>
                  Continue to notifications →
                </button>
              </>
            ) : (
              <>
                <div style={infoBox}>
                  <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    If your browser offers <strong style={{ color: 'var(--gold)' }}>Install app</strong> in the address bar or menu, use it here. Otherwise, open hallowedhopsociety.com on your phone and add it to your Home Screen.
                  </p>
                </div>
                <button onClick={() => setStep('notify')} style={{ ...btnPrimary, marginTop: '1.25rem' }}>
                  Continue →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP: NOTIFICATIONS ── */}
        {step === 'notify' && (
          <div style={{ textAlign: 'center' }}>
            <StepIndicator current={2} total={2} />
            <h2 style={heading}>Enable Notifications</h2>
            {canUsePushHere() ? (
              <p style={body}>
                This permission is for <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong>, so it applies to the installed HHS app on this origin too. Tap the button, then choose Allow.
              </p>
            ) : (
              <p style={body}>
                {isIOS() && !isPWA()
                  ? 'iPhone notifications can only be enabled from the installed Home Screen app. Open HHS from the icon you just added, then enable notifications there.'
                  : 'This browser cannot enable HHS push notifications here. You can finish now and enable notifications later from a supported browser or installed app.'}
              </p>
            )}

            {notifPermission === 'denied' && (
              <div style={{ ...infoBox, marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                  Notifications are blocked. Go to <strong style={{ color: 'var(--gold)' }}>Settings → {isIOS() ? 'Safari' : 'Chrome'} → Notifications</strong> and allow hallowedhopsociety.com, then come back.
                </p>
              </div>
            )}

            {notifPermission !== 'denied' && canUsePushHere() && (
              <button onClick={subscribeNotifications} disabled={subscribing} style={{ ...btnPrimary, marginBottom: '0.75rem' }}>
                {subscribing ? 'Enabling...' : 'Enable Notifications'}
              </button>
            )}
            <button onClick={() => setStep('done')} style={btnSecondary}>
              Skip for now
            </button>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <Image src="/hhs_no_circles_300dpi.webp" alt="HHS" width={90} height={90} className="mx-auto mb-6 opacity-90" />
            <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
              You&apos;re all set
            </p>
            <h2 style={heading}>Welcome to the Society.</h2>
            <p style={body}>
              {notifPermission === 'granted'
                ? "You're all set up to receive your beer notifications."
                : "You're in. You can enable notifications anytime — you'll be notified when your beers drop."}
            </p>
            <button onClick={finish} style={btnPrimary}>
              Enter the Society →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.5rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i + 1 === current ? '1.5rem' : '0.4rem',
          height: '0.4rem',
          borderRadius: '99px',
          background: i + 1 <= current ? 'var(--gold)' : 'var(--border)',
          transition: 'all 0.3s ease',
        }} />
      ))}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  width: '100%',
  padding: '0.9rem',
  background: 'var(--gold)',
  border: 'none',
  borderRadius: '10px',
  color: 'var(--bg)',
  fontFamily: "'Modern Antiqua', serif",
  fontSize: '0.9rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  cursor: 'pointer',
  marginBottom: '0.75rem',
  display: 'block',
}

const btnSecondary: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--text-muted)',
  fontFamily: "'Modern Antiqua', serif",
  fontSize: '0.8rem',
  cursor: 'pointer',
  display: 'block',
  marginBottom: '0.5rem',
}

const heading: React.CSSProperties = {
  fontFamily: "'Modern Antiqua', serif",
  color: 'var(--text)',
  fontSize: '1.4rem',
  fontWeight: 700,
  marginBottom: '1rem',
  textAlign: 'center',
}

const body: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.95rem',
  lineHeight: 1.7,
  marginBottom: '1.75rem',
  textAlign: 'center',
}

const infoBox: React.CSSProperties = {
  background: 'rgba(255,140,0,0.07)',
  border: '1px solid rgba(255,140,0,0.2)',
  borderRadius: '10px',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const infoStep: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: '0.9rem',
  lineHeight: 1.6,
  margin: 0,
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
}

const dot: React.CSSProperties = {
  width: '1.4rem',
  height: '1.4rem',
  minWidth: '1.4rem',
  borderRadius: '50%',
  background: 'var(--gold)',
  color: 'var(--bg)',
  fontSize: '0.7rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '0.1rem',
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
