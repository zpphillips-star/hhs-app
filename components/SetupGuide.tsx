'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  NotificationPermissionRecovery,
  canUseWebPushHere,
  detectNotificationBrowser,
  getNotificationPermissionState,
} from '@/components/NotificationPermissionRecovery'

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
function detectInAppBrowser(): InAppType {
  const ua = navigator.userAgent
  const referrer = document.referrer
  const androidGmailReferrer = referrer.startsWith('android-app://com.google.android.gm')
  const androidWebView = /Android/i.test(ua) && (/; wv\)?/i.test(ua) || /\bwv\)/i.test(ua))
  // Gmail hands Chrome the original android-app:// referrer when a member taps
  // "open in Chrome". Referrer alone is therefore stale after the browser
  // switch; only block when the current UA is still a WebView/in-app surface.
  if (androidGmailReferrer && androidWebView) return 'gmail-android'
  if (/GSA\//.test(ua) && isIOS()) return 'gmail-ios'
  if (androidWebView) return 'webview'
  if (/FBAN|FBAV|Instagram/.test(ua)) return 'webview'
  return null
}

function clearStaleBrowserWarningState() {
  if (typeof window === 'undefined') return
  const keys = [
    'hhs_in_app_browser_warning',
    'hhs_browser_warning',
    'hhs_gmail_browser_warning',
    '__hhs_in_app_browser__',
  ]
  for (const key of keys) {
    try { window.localStorage.removeItem(key) } catch { /* ignore */ }
    try { window.sessionStorage.removeItem(key) } catch { /* ignore */ }
  }
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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function SetupGuide({ userId }: { userId: string }) {
  const [step, setStep] = useState<Step | null>(null)
  const [, setNotifStatus] = useState<NotificationPermission | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [canPromptInstall, setCanPromptInstall] = useState(false)
  const [notifBlocked, setNotifBlocked] = useState(false)
  const [inAppBrowser, setInAppBrowser] = useState<InAppType>(null)
  const [installAccepted, setInstallAccepted] = useState(false)
  const [currentBrowser] = useState<BrowserName>(() =>
    typeof navigator === 'undefined' ? 'other' : detectCurrentBrowser()
  )
  const deferredInstallPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const nativeApp = isNativeApp()

  // Don't render at all in the native app — install/PWA prompts are not applicable
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredInstallPrompt.current = e as BeforeInstallPromptEvent
      setCanPromptInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function proceedToSetup() {
    const installed = isPWA()
    const notifPerm = getNotificationPermissionState()
    if (notifPerm !== 'unsupported') setNotifStatus(notifPerm)
    setNotifBlocked(notifPerm === 'denied')

    if (installed) {
      supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
    } else {
      // Not running as PWA — make sure DB reflects reality
      supabase.from('profiles').update({ has_pwa: false }).eq('id', userId).then(() => {})
    }

    const { data: pushSub } = canUseWebPushHere()
      ? await supabase.from('push_subscriptions').select('user_id').eq('user_id', userId).maybeSingle()
      : { data: null }
    const notifDone = canUseWebPushHere() ? notifPerm === 'granted' && !!pushSub : false

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

    clearStaleBrowserWarningState()
    window.setTimeout(() => {
      setInAppBrowser(null)
      void proceedToSetup()
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dismissed, nativeApp])

  const refreshNotificationState = useCallback(async () => {
    const perm = getNotificationPermissionState()
    if (perm !== 'unsupported') setNotifStatus(perm)
    setNotifBlocked(perm === 'denied')
    if (step !== 'notify' || !canUseWebPushHere() || perm !== 'granted') return
    const { data: pushSub } = await supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (pushSub) setStep('done')
  }, [step, userId])

  useEffect(() => {
    if (nativeApp || dismissed) return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void refreshNotificationState()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [dismissed, nativeApp, refreshNotificationState])

  const triggerInstallPrompt = async () => {
    const prompt = deferredInstallPrompt.current
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredInstallPrompt.current = null
    setCanPromptInstall(false)
    if (outcome === 'accepted') {
      setInstallAccepted(true)
    }
  }

  const continueToNotifications = async () => {
    if (isPWA()) {
      await supabase.from('profiles').update({ has_pwa: true }).eq('id', userId)
      setStep('notify')
      return
    }
    setInstallAccepted(true)
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
    const currentPermission = getNotificationPermissionState()
    if (currentPermission !== 'unsupported') setNotifStatus(currentPermission)
    setNotifBlocked(currentPermission === 'denied')
    if (!canUseWebPushHere() || currentPermission === 'denied' || currentPermission === 'unsupported') return
    setSubscribing(true)
    try {
      const perm = currentPermission === 'granted' ? 'granted' : await Notification.requestPermission()
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

          {installAccepted && (
            <div style={{ background: 'rgba(34,197,94,0.09)', border: '1px solid rgba(74,222,128,0.28)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ color: '#bbf7d0', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                Install started. Continue by opening <strong>HHS</strong> from the new Home Screen app icon. When it opens there, HHS will detect the install and show notifications as the only setup action left.
              </p>
            </div>
          )}

          {canPromptInstall && !installAccepted && (
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

          {!canPromptInstall && isIOS() && !installAccepted && (
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

          {!canPromptInstall && !isIOS() && !installAccepted && (
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
            onClick={installAccepted ? () => setDismissed(true) : continueToNotifications}
            style={{ width: '100%', padding: '0.75rem', background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', borderRadius: '10px', color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.82rem', cursor: 'pointer', letterSpacing: '0.1em', marginBottom: '0.65rem' }}
          >{installAccepted ? 'I’ll open HHS from the app icon' : 'I installed it — check again →'}</button>

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
          {canUseWebPushHere() && !notifBlocked ? (
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
              <NotificationPermissionRecovery
                permission={notifBlocked ? 'denied' : 'unsupported'}
                browser={detectNotificationBrowser()}
                textStyle={{ color: 'var(--text)', fontSize: '0.875rem' }}
              />
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
