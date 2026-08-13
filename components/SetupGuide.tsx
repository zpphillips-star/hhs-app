'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'browser' | 'install' | 'notify' | 'done'
type InAppType = 'gmail-android' | 'gmail-ios' | 'webview' | null
type BrowserName = 'chrome' | 'edge' | 'brave' | 'samsung' | 'opera' | 'firefox' | 'safari' | 'other'

function isNativeApp() {
  if (typeof window === 'undefined') return false
  if ((window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__) return true
  try { if (localStorage.getItem('__hhs_native_app__') === '1') return true } catch { /* ignore */ }
  return false
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}
function canUsePushHere() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  // iOS web push is only available from the installed Home Screen app. Safari
  // tabs can show the install guide, but they cannot enable the PWA permission.
  if (isIOS() && !isPWA()) return false
  return true
}

function detectInAppBrowser(): InAppType {
  const ua = navigator.userAgent
  const referrer = document.referrer
  if (referrer.startsWith('android-app://com.google.android.gm')) return 'gmail-android'
  if (/GSA\//.test(ua) && isIOS()) return 'gmail-ios'
  if (/wv\)/.test(ua) || /; wv/.test(ua)) return 'webview'
  if (/FBAN|FBAV|Instagram/.test(ua)) return 'webview'
  return null
}

function detectCurrentBrowser(): BrowserName {
  const ua = navigator.userAgent
  if (/Edg\/|EdgA\//.test(ua)) return 'edge'
  if ((navigator as { brave?: { isBrave?: unknown } }).brave) return 'brave'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/OPR\/|Opera/.test(ua)) return 'opera'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari'
  if (/Chrome/.test(ua)) return 'chrome'
  return 'other'
}

function browserLabel(b: BrowserName): string {
  return { chrome: 'Chrome', edge: 'Edge', brave: 'Brave', samsung: 'Samsung Internet', opera: 'Opera', firefox: 'Firefox', safari: 'Safari', other: 'your browser' }[b]
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null

export default function SetupGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step | null>(null)
  const [, setNotifStatus] = useState<NotificationPermission | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [notifBlocked, setNotifBlocked] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState<InAppType>(null)
  const [currentBrowser] = useState<BrowserName>(() =>
    typeof navigator === 'undefined' ? 'other' : detectCurrentBrowser()
  )
  const nativeApp = isNativeApp()

  // Don't render at all in the native app — install/PWA prompts are not applicable
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallPrompt = e
      setCanPromptInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function proceedToSetup() {
    const installed = isPWA()
    const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
    setNotifStatus(notifPerm)
    setNotifBlocked(notifPerm === 'denied')

    if (installed) {
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
    } else {
      // Not running as PWA — make sure DB reflects reality
      supabase.from('profiles').update({ has_pwa: false }).eq('id', userId).then(() => {})
    }

    const { data: pushSub } = canUsePushHere()
      ? await supabase.from('push_subscriptions').select('user_id').eq('user_id', userId).maybeSingle()
      : { data: null }
    const notifDone = canUsePushHere() ? notifPerm === 'granted' && !!pushSub : false

    if (!installed) {
      setStep('install')
    } else if (!notifDone) {
      setStep('notify')
    } else {
      setStep('done')
    }
  }

  useEffect(() => {
    if (nativeApp || dismissed) return

    // Skip entirely when running inside the HHS native Android app.
    // The native app manages its own onboarding overlay and sets window.__HHS_NATIVE_APP__.
    if (typeof window !== 'undefined' && (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__) {
      return
    }

    const detected = detectInAppBrowser()
    if (detected) {
      window.setTimeout(() => {
        setInAppBrowser(detected)
        setStep('browser')
      }, 0)
      return
    }

    window.setTimeout(() => proceedToSetup(), 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dismissed, nativeApp])

  const triggerInstallPrompt = async () => {
    if (!deferredInstallPrompt) return
    deferredInstallPrompt.prompt()
    const { outcome } = await deferredInstallPrompt.userChoice
    deferredInstallPrompt = null
    setCanPromptInstall(false)
    if (outcome === 'accepted') {
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
      setTimeout(() => setStep('notify'), 1500)
    }
  }

  const continueToNotifications = async () => {
    if (isPWA()) {
      await supabase.from('profiles').update({ has_pwa: true }).eq('id', userId)
    }
    const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
    setNotifStatus(notifPerm)
    setNotifBlocked(notifPerm === 'denied')
    setStep('notify')
  }

  // Always get a FRESH push subscription — never reuse a potentially stale one
  async function subscribeIfNeeded(uid: string) {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ subscription: sub.toJSON(), user_id: uid }),
      })
    } catch { /* silent fail */ }
  }

  const requestNotifications = async () => {
    if (!canUsePushHere()) return
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
      setNotifBlocked(perm === 'denied')
      if (perm === 'granted') {
        await subscribeIfNeeded(userId)
        await supabase.from('profiles').update({ has_notifications: true }).eq('id', userId)
        setStep('done')
      }
    } catch { /* silent */ }
    setSubscribing(false)
  }

  if (nativeApp || !step || step === 'done' || dismissed) return null

  const androidManualInstallInstructions: Record<BrowserName, string> = {
    edge: 'Tap the ··· menu at the bottom → "Add to Phone" → Add',
    samsung: 'Tap the ☰ menu → "Add page to" → Home screen',
    opera: 'Tap the ☰ menu → "Home screen"',
    firefox: 'Firefox doesn\'t support Home Screen install. Open this page in Edge or Chrome instead.',
    chrome: 'Tap the ⋮ menu at the top right → "Add to Home screen"',
    brave: 'Tap the ⋮ menu at the top right → "Add to Home Screen"',
    safari: 'Tap the Share button → "Add to Home Screen" → Add',
    other: 'Open your browser menu → "Add to Home Screen"',
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 3000,
      background: 'var(--bg-card)',
      borderTop: '1px solid rgba(255,140,0,0.3)',
      padding: '1.5rem 1.5rem 2rem',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      <button
        onClick={() => setDismissed(true)}
        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}
      >✕</button>

      <p style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.75rem' }}>
        {step === 'browser' ? 'One Quick Step' : step === 'install' ? 'Setup Required' : 'Enable Notifications'}
      </p>

      {step === 'browser' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {inAppBrowser === 'gmail-android'
              ? <>You&apos;re in Gmail. Tap the <strong style={{ color: 'var(--gold)' }}>browser icon</strong> in the top-right corner to open in Chrome, then return here to continue.</>
              : inAppBrowser === 'gmail-ios'
              ? <>You&apos;re in Gmail. Tap <strong style={{ color: 'var(--gold)' }}>&ldquo;Open in Safari&rdquo;</strong> at the top of your screen to continue setup.</>
              : <>You&apos;re in an in-app browser. Open this page in your <strong style={{ color: 'var(--gold)' }}>default browser</strong> to continue setup.</>
            }
          </p>
          {inAppBrowser === 'gmail-ios' && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem', wordBreak: 'break-all' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Or copy this link into Safari:</p>
              <p style={{ color: 'var(--gold)', fontSize: '0.8rem', margin: 0 }}>{typeof window !== 'undefined' ? window.location.href : ''}</p>
            </div>
          )}
          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}
          >I&apos;ll do this later</button>
        </>
      )}

      {step === 'install' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            To receive beer notifications, <strong style={{ color: 'var(--gold)' }}>add this app to your Home Screen</strong> first.
          </p>

          {canPromptInstall && (
            <button
              onClick={triggerInstallPrompt}
              style={{
                width: '100%', padding: '0.85rem',
                background: 'var(--gold)', border: 'none', borderRadius: '10px',
                color: 'var(--bg)', fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.1em',
                cursor: 'pointer', marginBottom: '0.75rem',
              }}
            >Add to Home Screen</button>
          )}

          {!canPromptInstall && isIOS() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>iPhone / iPad — 3 quick steps</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  { icon: '1.', text: 'Tap the Share button at the bottom of Safari' },
                  { icon: '2.', text: 'Tap "Add to Home Screen"' },
                  { icon: '3.', text: 'Tap Add — then open the app from your Home Screen' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!canPromptInstall && !isIOS() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {browserLabel(currentBrowser)}
              </p>
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                {androidManualInstallInstructions[currentBrowser]}
              </p>
            </div>
          )}

          <button
            onClick={continueToNotifications}
            style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', borderRadius: '10px', color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.82rem', cursor: 'pointer', letterSpacing: '0.1em', marginBottom: '0.65rem' }}
          >I added it — continue to notifications →</button>

          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}
          >I&apos;ll do this later</button>
        </>
      )}

      {step === 'notify' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Get notified each time your next beer is revealed.
          </p>
          {canUsePushHere() && !notifBlocked ? (
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
            >{subscribing ? 'Enabling...' : 'Enable Notifications'}</button>
          ) : (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                {notifBlocked
                  ? <>Notifications are blocked. Open <strong style={{ color: 'var(--gold)' }}>{isIOS() ? 'iOS Settings → Notifications' : `${browserLabel(currentBrowser)} settings → Site settings → Notifications`}</strong>, allow HHS, then return.</>
                  : isIOS()
                  ? <>On iPhone/iPad, notifications are enabled from the installed Home Screen app. Open HHS from the icon you added, then tap <strong style={{ color: 'var(--gold)' }}>Enable Notifications</strong> there.</>
                  : <>This browser cannot enable HHS push notifications here. Open HHS in Chrome, Edge, or the installed app and tap <strong style={{ color: 'var(--gold)' }}>Enable Notifications</strong>.</>}
              </p>
            </div>
          )}
          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer' }}
          >Not now</button>
        </>
      )}
    </div>
  )
}
