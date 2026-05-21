'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

export default function SetupBanner() {
  const [userId, setUserId] = useState<string | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [hasPwaDB, setHasPwaDB] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)
  const [canNativeInstall, setCanNativeInstall] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [showInstallSteps, setShowInstallSteps] = useState(false)

  // Capture Android/desktop native install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e
      setCanNativeInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Load user + real state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      setAppInstalled(isPWA())
      setNotifGranted('Notification' in window && Notification.permission === 'granted')
      supabase.from('profiles').select('has_pwa').eq('id', user.id).single().then(({ data }) => {
        if (data?.has_pwa) setHasPwaDB(true)
      })
    })
  }, [])

  const installedDone = appInstalled || hasPwaDB
  const allDone = installedDone && notifGranted

  // Nothing to show: not logged in, or all done
  if (!userId || allDone) return null

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setCanNativeInstall(false)
    if (outcome === 'accepted' && userId) {
      await supabase.from('profiles').update({ has_pwa: true }).eq('id', userId)
      setHasPwaDB(true)
      setTimeout(() => setAppInstalled(isPWA()), 1500)
    }
  }

  const handleEnableNotifications = async () => {
    if (!userId) return
    setSubscribing(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        setNotifGranted(true)
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
        } catch { /* push subscription optional */ }
      }
    } catch { /* silent */ }
    setSubscribing(false)
  }

  return (
    <>
      {/* Dark overlay — blocks the page until setup is done */}
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
        width: 'min(440px, 92vw)',
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,140,0,0.3)',
        borderRadius: '18px',
        padding: '2rem 1.75rem',
        boxShadow: '0 32px 96px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <p style={{
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.6rem',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: '0.4rem',
          textAlign: 'center',
        }}>
          Setup Required
        </p>
        <h2 style={{
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '1.3rem',
          color: 'var(--text)',
          textAlign: 'center',
          marginBottom: '0.5rem',
        }}>
          Finish Your Setup
        </h2>
        <p style={{
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          textAlign: 'center',
          marginBottom: '1.75rem',
          lineHeight: 1.6,
        }}>
          Complete both steps to enter the Society.
        </p>

        {/* Step 1 — Install */}
        <CheckRow
          done={installedDone}
          label="Add to Home Screen"
          description={
            installedDone
              ? 'App installed — you\'re good'
              : isIOS() || isAndroid()
                ? 'Required to receive beer notifications'
                : 'Open on your phone to install as an app'
          }
        >
          {!installedDone && (
            canNativeInstall ? (
              <button onClick={handleNativeInstall} style={btnStyle}>
                Add to Home Screen
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowInstallSteps(s => !s)}
                  style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(255,140,0,0.4)', color: 'var(--gold)' }}
                >
                  {showInstallSteps ? 'Hide Steps ↑' : 'Show me how →'}
                </button>
                {showInstallSteps && (
                  <div style={infoBox}>
                    {isIOS() ? (
                      <>
                        <InstallStep n={1} text="Tap the Share button at the bottom of Safari" />
                        <InstallStep n={2} text={'Tap "Add to Home Screen"'} />
                        <InstallStep n={3} text="Tap Add — then reopen from your Home Screen" />
                      </>
                    ) : isAndroid() ? (
                      <>
                        <InstallStep n={1} text="Tap the ⋮ menu in the top-right of Chrome" />
                        <InstallStep n={2} text={'Tap "Add to Home screen"'} />
                        <InstallStep n={3} text="Tap Add to confirm — then reopen from your home screen" />
                      </>
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
                        Open <strong style={{ color: 'var(--gold)' }}>hallowedhopsociety.com</strong> on your phone and follow the steps there.
                      </p>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </CheckRow>

        {/* Step 2 — Notifications */}
        <CheckRow
          done={notifGranted}
          label="Enable Notifications"
          description={
            notifGranted
              ? "You'll be notified when each beer drops"
              : 'Get notified the moment your beer is revealed'
          }
        >
          {!notifGranted && (
            typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied' ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.6 }}>
                Notifications are blocked. Go to{' '}
                <strong style={{ color: 'var(--gold)' }}>
                  Settings → {isIOS() ? 'Safari' : 'Chrome'} → Notifications
                </strong>{' '}
                and allow this site, then reload.
              </p>
            ) : (
              <button
                onClick={handleEnableNotifications}
                disabled={subscribing}
                style={btnStyle}
              >
                {subscribing ? 'Enabling...' : 'Enable Notifications'}
              </button>
            )
          )}
        </CheckRow>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CheckRow({
  done, label, description, children,
}: {
  done: boolean
  label: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div style={{
      borderRadius: '12px',
      border: `1px solid ${done ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
      background: done ? 'rgba(255,140,0,0.06)' : 'rgba(255,255,255,0.02)',
      padding: '1rem 1rem 1rem',
      marginBottom: '0.85rem',
      transition: 'all 0.3s ease',
    }}>
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        {/* Checkbox circle */}
        <div style={{
          width: '22px',
          height: '22px',
          minWidth: '22px',
          borderRadius: '50%',
          border: `2px solid ${done ? 'var(--gold)' : 'rgba(255,255,255,0.25)'}`,
          background: done ? 'var(--gold)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          transition: 'all 0.3s ease',
          flexShrink: 0,
        }}>
          {done && <span style={{ color: 'var(--bg)', fontSize: '0.68rem', fontWeight: 700, lineHeight: 1 }}>✓</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: done ? 'var(--gold)' : 'var(--text)',
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.92rem',
            fontWeight: 700,
            margin: '0 0 0.2rem',
            transition: 'color 0.3s ease',
          }}>
            {label}
          </p>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            margin: done ? 0 : '0 0 0.75rem',
            lineHeight: 1.5,
          }}>
            {description}
          </p>
          {!done && children}
        </div>
      </div>
    </div>
  )
}

function InstallStep({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.45rem', alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.8rem', minWidth: '1rem', flexShrink: 0 }}>{n}.</span>
      <span style={{ color: 'var(--text)', fontSize: '0.83rem', lineHeight: 1.5 }}>{text}</span>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem',
  background: 'var(--gold)',
  border: 'none',
  borderRadius: '8px',
  color: 'var(--bg)',
  fontFamily: "'Modern Antiqua', serif",
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  cursor: 'pointer',
  textTransform: 'uppercase',
  marginBottom: '0.25rem',
}

const infoBox: React.CSSProperties = {
  background: 'rgba(255,140,0,0.07)',
  border: '1px solid rgba(255,140,0,0.2)',
  borderRadius: '8px',
  padding: '0.85rem',
  marginTop: '0.5rem',
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
