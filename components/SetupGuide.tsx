'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'install' | 'notify' | 'done'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

export default function SetupGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step | null>(null)
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const installed = isPWA()
    const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
    setNotifStatus(notifPerm)

    if (!installed) {
      setStep('install')
    } else if (notifPerm !== 'granted') {
      setStep('notify')
    } else {
      // Already set up — subscribe silently in background
      subscribeIfNeeded(userId)
      setStep('done')
    }
  }, [userId, dismissed])

  const subscribeIfNeeded = async (uid: string) => {
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
        body: JSON.stringify({ subscription: sub.toJSON(), user_id: uid }),
      })
    } catch { /* silent fail */ }
  }

  const requestNotifications = async () => {
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
      if (perm === 'granted') {
        await subscribeIfNeeded(userId)
        setStep('done')
      } else {
        setStep('done') // they said no, don't block
      }
    } catch { /* silent */ }
    setSubscribing(false)
  }

  if (!step || step === 'done' || dismissed) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 3000,
      background: 'var(--bg-card)',
      borderTop: '1px solid rgba(255,140,0,0.3)',
      padding: '1.5rem 1.5rem 2rem',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Close */}
      <button
        onClick={() => setDismissed(true)}
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
      >✕</button>

      {/* Decorative header */}
      <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
        {step === 'install' ? '⚙️ Setup Required' : '🔔 Enable Notifications'}
      </p>

      {step === 'install' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            To receive daily beer notifications, <strong style={{ color: 'var(--gold)' }}>add this app to your Home Screen</strong> first.
          </p>

          {isIOS() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>iPhone / iPad</p>
              <ol style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
                <li>Tap the <strong>Share</strong> button (□↑) in Safari</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                <li>Tap <strong>Add</strong></li>
                <li>Open the app from your Home Screen</li>
              </ol>
            </div>
          )}

          {isAndroid() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Android</p>
              <ol style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.8, paddingLeft: '1.25rem', margin: 0 }}>
                <li>Tap the <strong>⋮ menu</strong> in Chrome</li>
                <li>Tap <strong>"Add to Home screen"</strong></li>
                <li>Tap <strong>Add</strong></li>
                <li>Open the app from your Home Screen</li>
              </ol>
            </div>
          )}

          {!isIOS() && !isAndroid() && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Open this site in your mobile browser and add it to your Home Screen to enable notifications.
            </p>
          )}

          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}
          >I&apos;ll do this later</button>
        </>
      )}

      {step === 'notify' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Get a notification every day at <strong style={{ color: 'var(--gold)' }}>3 PM</strong> when the beer of the day is revealed.
          </p>
          <button
            onClick={requestNotifications}
            disabled={subscribing}
            style={{
              width: '100%', padding: '0.8rem',
              background: 'var(--gold)', border: 'none', borderRadius: '10px',
              color: 'var(--bg)', fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.1em',
              cursor: 'pointer', marginBottom: '0.75rem',
            }}
          >{subscribing ? 'Enabling...' : '🔔 Enable Notifications'}</button>
          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer' }}
          >Not now</button>
        </>
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
