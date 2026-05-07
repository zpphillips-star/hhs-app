'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type Step = 'welcome' | 'install' | 'install-ios-steps' | 'notify' | 'done'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null

export default function WelcomePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [firstName, setFirstName] = useState('')
  const [userId, setUserId] = useState('')
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')
  const [subscribing, setSubscribing] = useState(false)
  const [iosStep, setIosStep] = useState(1)

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      setFirstName(user.user_metadata?.first_name || '')
    })
    if ('Notification' in window) setNotifPermission(Notification.permission)
  }, [router])

  const markPWA = async (uid: string) => {
    await supabase.from('profiles').update({ has_pwa: true }).eq('id', uid)
  }

  const subscribeNotifications = async () => {
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
          headers: { 'Content-Type': 'application/json' },
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
      setTimeout(() => setStep('notify'), 800)
    }
  }

  const goToNotify = async () => {
    await markPWA(userId)
    setStep('notify')
  }

  const finish = () => router.push('/')

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
              Your membership to the Hallowed Hop Society has been approved. Before you enter, let&apos;s get you set up — it takes 2 minutes.
            </p>
            <button onClick={() => setStep(isPWA() ? 'notify' : 'install')} style={btnPrimary}>
              Get Started →
            </button>
          </div>
        )}

        {/* ── STEP: INSTALL (Android or desktop) ── */}
        {step === 'install' && !isIOS() && (
          <div>
            <StepIndicator current={1} total={2} />
            <h2 style={heading}>Add to your Home Screen</h2>
            <p style={body}>
              This gives you the full app experience — tap the icon to open HHS anytime, and you&apos;ll get notified each time your next beer is revealed.
            </p>

            {canNativeInstall ? (
              <>
                <button onClick={handleAndroidInstall} style={{ ...btnPrimary, marginBottom: '0.75rem' }}>
                  📱 Add to Home Screen
                </button>
                <button onClick={() => setStep('notify')} style={btnSecondary}>
                  Skip for now
                </button>
              </>
            ) : isAndroid() ? (
              <>
                <div style={infoBox}>
                  <p style={infoStep}><span style={dot}>1</span> Tap the <strong style={{ color: 'var(--gold)' }}>⋮ menu</strong> in the top-right of Chrome</p>
                  <p style={infoStep}><span style={dot}>2</span> Tap <strong style={{ color: 'var(--gold)' }}>&quot;Add to Home screen&quot;</strong></p>
                  <p style={infoStep}><span style={dot}>3</span> Tap <strong style={{ color: 'var(--gold)' }}>Add</strong> to confirm</p>
                  <p style={infoStep}><span style={dot}>4</span> Open the app from your home screen, then tap below</p>
                </div>
                <button onClick={goToNotify} style={{ ...btnPrimary, marginTop: '1.25rem' }}>
                  I added it →
                </button>
                <button onClick={() => setStep('notify')} style={btnSecondary}>
                  Skip for now
                </button>
              </>
            ) : (
              <>
                <div style={infoBox}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                    For the best experience, open <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong> on your phone and add it to your home screen from there.
                  </p>
                </div>
                <button onClick={() => setStep('notify')} style={{ ...btnPrimary, marginTop: '1.25rem' }}>
                  Continue on desktop →
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP: INSTALL iOS intro ── */}
        {step === 'install' && isIOS() && (
          <div>
            <StepIndicator current={1} total={2} />
            <h2 style={heading}>Add to your Home Screen</h2>
            <p style={body}>
              On iPhone, you need to add HHS to your Home Screen to receive notifications. It takes 3 taps — we&apos;ll walk you through it.
            </p>
            <button onClick={() => { setIosStep(1); setStep('install-ios-steps') }} style={btnPrimary}>
              Show me how →
            </button>
            <button onClick={() => setStep('notify')} style={btnSecondary}>
              Skip for now
            </button>
          </div>
        )}

        {/* ── STEP: iOS STEP-BY-STEP ── */}
        {step === 'install-ios-steps' && (
          <div style={{ textAlign: 'center' }}>
            <StepIndicator current={1} total={2} />

            {iosStep === 1 && (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⬆️</div>
                <h2 style={heading}>Tap the Share button</h2>
                <p style={body}>
                  At the bottom of Safari, tap the <strong style={{ color: 'var(--gold)' }}>Share</strong> button — the box with an arrow pointing up.
                </p>
                <button onClick={() => setIosStep(2)} style={btnPrimary}>Got it →</button>
              </>
            )}
            {iosStep === 2 && (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>➕</div>
                <h2 style={heading}>Tap &quot;Add to Home Screen&quot;</h2>
                <p style={body}>
                  Scroll down in the Share menu until you see <strong style={{ color: 'var(--gold)' }}>&quot;Add to Home Screen&quot;</strong>, then tap it.
                </p>
                <button onClick={() => setIosStep(3)} style={btnPrimary}>Got it →</button>
              </>
            )}
            {iosStep === 3 && (
              <>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✓</div>
                <h2 style={heading}>Tap &quot;Add&quot;</h2>
                <p style={body}>
                  A preview screen appears. Tap <strong style={{ color: 'var(--gold)' }}>Add</strong> in the top-right. HHS will now appear on your home screen.
                </p>
                <p style={{ color: 'var(--gold)', fontSize: '0.85rem', marginBottom: '1.75rem', fontStyle: 'italic' }}>
                  Now open the app from your home screen, then tap below.
                </p>
                <button onClick={goToNotify} style={btnPrimary}>I added it →</button>
                <button onClick={() => setStep('notify')} style={btnSecondary}>Skip for now</button>
              </>
            )}
          </div>
        )}

        {/* ── STEP: NOTIFICATIONS ── */}
        {step === 'notify' && (
          <div style={{ textAlign: 'center' }}>
            <StepIndicator current={2} total={2} />
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
            <h2 style={heading}>Enable Notifications</h2>
            <p style={body}>
              Each time your next beer is ready, you&apos;ll get a notification — just for you, based on your membership. Your phone will ask for permission — tap <strong style={{ color: 'var(--gold)' }}>Allow</strong>.
            </p>

            {notifPermission === 'denied' && (
              <div style={{ ...infoBox, marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                  Notifications are blocked. Go to <strong style={{ color: 'var(--gold)' }}>Settings → {isIOS() ? 'Safari' : 'Chrome'} → Notifications</strong> and allow hallowedhopsociety.com, then come back.
                </p>
              </div>
            )}

            {notifPermission !== 'denied' && (
              <button onClick={subscribeNotifications} disabled={subscribing} style={{ ...btnPrimary, marginBottom: '0.75rem' }}>
                {subscribing ? 'Enabling...' : '🔔 Enable Notifications'}
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
