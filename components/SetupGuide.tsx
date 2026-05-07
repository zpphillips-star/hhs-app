'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Step = 'browser' | 'install' | 'notify' | 'done'
type InAppType = 'gmail-android' | 'gmail-ios' | 'webview' | null
type BrowserName = 'chrome' | 'edge' | 'brave' | 'samsung' | 'opera' | 'firefox' | 'safari' | 'other'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

// Detect if we're inside an email app's in-app browser
function detectInAppBrowser(): InAppType {
  const ua = navigator.userAgent
  const referrer = document.referrer
  if (referrer.startsWith('android-app://com.google.android.gm')) return 'gmail-android'
  if (/GSA\//.test(ua) && isIOS()) return 'gmail-ios'
  if (/wv\)/.test(ua) || /; wv/.test(ua)) return 'webview'
  if (/FBAN|FBAV|Instagram/.test(ua)) return 'webview'
  return null
}

// Detect the actual browser the user is currently in
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null

export default function SetupGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step | null>(null)
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState<InAppType>(null)
  const [currentBrowser, setCurrentBrowser] = useState<BrowserName>('other')

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallPrompt = e
      setCanPromptInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (dismissed) return
    if (localStorage.getItem('hhs_setup_done') === '1') return

    setCurrentBrowser(detectCurrentBrowser())

    const detected = detectInAppBrowser()
    if (detected) {
      setInAppBrowser(detected)
      setStep('browser')
      return
    }

    proceedToSetup()
  }, [userId, dismissed])

  const proceedToSetup = () => {
    const installed = isPWA()
    const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
    setNotifStatus(notifPerm)
    if (installed) {
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
    }
    if (!installed) {
      setStep('install')
    } else if (notifPerm !== 'granted') {
      setStep('notify')
    } else {
      subscribeIfNeeded(userId)
      setStep('done')
    }
  }

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
        setStep('done')
      }
    } catch { /* silent */ }
    setSubscribing(false)
  }

  if (!step || step === 'done' || dismissed) return null

  // Android install instructions when native prompt didn't fire
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

      {/* ── BROWSER STEP: only shown when in an in-app browser ── */}
      {step === 'browser' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {inAppBrowser === 'gmail-android'
              ? <>You&apos;re in Gmail. Tap the <strong style={{ color: 'var(--gold)' }}>browser icon</strong> in the top-right corner of your screen to open in your default browser.</>
              : inAppBrowser === 'gmail-ios'
              ? <>You&apos;re in Gmail. Look for <strong style={{ color: 'var(--gold)' }}>&ldquo;Open in Safari&rdquo;</strong> at the top or bottom of your screen.</>
              : <>You&apos;re in an in-app browser. Open this page in your <strong style={{ color: 'var(--gold)' }}>default browser</strong> to continue.</>
            }
          </p>
          {/* Fallback: show the URL so they can copy/paste into their browser */}
          <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '0.85rem', marginBottom: '1rem', wordBreak: 'break-all' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.25rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Or copy this link and paste it in your browser:</p>
            <p style={{ color: 'var(--gold)', fontSize: '0.8rem', margin: 0 }}>{typeof window !== 'undefined' ? window.location.href : ''}</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            style={{ width: '100%', padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}
          >I&apos;ll do this later</button>
        </>
      )}

      {/* ── INSTALL STEP ── */}
      {step === 'install' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            To receive beer notifications, <strong style={{ color: 'var(--gold)' }}>add this app to your Home Screen</strong> first.
          </p>

          {/* Native prompt fired (Chrome, Edge, Brave, Samsung on Android) — one tap */}
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

          {/* iOS Safari — manual steps (Apple doesn't allow automating this) */}
          {!canPromptInstall && isIOS() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Safari — 3 quick steps
              </p>
              {[
                'Tap the Share button at the bottom of Safari',
                'Tap "Add to Home Screen"',
                'Tap Add — then open the app from your Home Screen',
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Android — no native prompt, show browser-specific instructions */}
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
            onClick={() => setDismissed(true)}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', cursor: 'pointer', letterSpacing: '0.1em' }}
          >I&apos;ll do this later</button>
        </>
      )}

      {/* ── NOTIFY STEP ── */}
      {step === 'notify' && (
        <>
          <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Get notified each time your next beer is revealed.
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
          >{subscribing ? 'Enabling...' : 'Enable Notifications'}</button>
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


type Step = 'browser' | 'install' | 'notify' | 'done'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
}

// Returns 'gmail-android' | 'gmail-ios' | 'webview' | null
function detectInAppBrowser(): 'gmail-android' | 'gmail-ios' | 'webview' | null {
  const ua = navigator.userAgent
  const referrer = document.referrer

  // Gmail on Android opens links in Chrome Custom Tabs — referrer is the gmail android app
  if (referrer.startsWith('android-app://com.google.android.gm')) return 'gmail-android'

  // Gmail on iOS uses a WebView with GSA (Google Search App) in the UA
  if (/GSA\//.test(ua) && isIOS()) return 'gmail-ios'

  // Generic Android WebView (wv flag in UA)
  if (/wv\)/.test(ua) || /; wv/.test(ua)) return 'webview'

  // Facebook, Instagram in-app browsers
  if (/FBAN|FBAV|Instagram/.test(ua)) return 'webview'

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredInstallPrompt: any = null

export default function SetupGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step | null>(null)
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState<'gmail-android' | 'gmail-ios' | 'webview' | null>(null)

  // Capture the browser's native install prompt (Android / Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallPrompt = e
      setCanPromptInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (dismissed) return
    // If user completed the welcome flow, don't re-prompt
    if (localStorage.getItem('hhs_setup_done') === '1') return

    // Detect in-app browser — only show browser step if actually needed
    const detected = detectInAppBrowser()
    if (detected) {
      setInAppBrowser(detected)
      setStep('browser')
      return
    }

    proceedToSetup()
  }, [userId, dismissed])

  const proceedToSetup = () => {
    const installed = isPWA()
    const notifPerm = 'Notification' in window ? Notification.permission : 'denied'
    setNotifStatus(notifPerm)

    if (installed) {
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
    }

    if (!installed) {
      setStep('install')
    } else if (notifPerm !== 'granted') {
      setStep('notify')
    } else {
      subscribeIfNeeded(userId)
      setStep('done')
    }
  }

  const triggerInstallPrompt = async () => {
    if (!deferredInstallPrompt) return
    deferredInstallPrompt.prompt()
    const { outcome } = await deferredInstallPrompt.userChoice
    deferredInstallPrompt = null
    setCanPromptInstall(false)
    if (outcome === 'accepted') {
      // Mark PWA install in profile
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
      // Give the browser a moment to switch to standalone mode
      setTimeout(() => setStep('notify'), 1500)
    }
  }

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
          {/* iOS Gmail — show the URL to copy since "Open in Safari" may not always appear */}
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

          {/* Android / Chrome — one-tap install button */}
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

          {/* iOS — can't be automated, show clear steps */}
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
                    <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                    <span style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desktop or other — generic message */}
          {!canPromptInstall && !isIOS() && (
            <div style={{ background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>
                Open <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong> on your phone, then use your browser menu to <strong>Add to Home Screen</strong>.
              </p>
            </div>
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
            Get notified each time your next beer is revealed.
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
          >{subscribing ? 'Enabling...' : 'Enable Notifications'}</button>
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
