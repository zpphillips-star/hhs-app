'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_BEER_VISIBILITY_PROFILE,
  getEffectiveBeerVisibilityPreference,
  normalizeMembershipTier,
  type BeerVisibilityPreference,
  type BeerVisibilityProfile,
} from '@/lib/membership'

type User = { id: string; email?: string }

type NotifPrefs = {
  daily_beer: boolean
  social_all: boolean
  social_new_comment: boolean
  social_new_reaction: boolean
  social_reaction_to_your_items: boolean
  social_comment_on_your_items: boolean
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  daily_beer: true,
  social_all: true,
  social_new_comment: true,
  social_new_reaction: true,
  social_reaction_to_your_items: true,
  social_comment_on_your_items: true,
}

const SOCIAL_KEYS: (keyof NotifPrefs)[] = [
  'social_new_comment',
  'social_new_reaction',
  'social_reaction_to_your_items',
  'social_comment_on_your_items',
]

function isNativeApp() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('hhs_app') === '1' ||
      (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
  } catch {
    return false
  }
}

function canUseWebPush() {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
}

function isPWA() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        border: `1px solid ${checked ? 'rgba(217,124,43,0.45)' : 'var(--border)'}`,
        background: checked ? 'rgba(217,124,43,0.24)' : 'rgba(255,255,255,0.04)',
        padding: '2px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s',
      }}
    >
      <span
        style={{
          display: 'block',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: checked ? 'var(--gold)' : 'var(--text-muted)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.15s',
        }}
      />
    </button>
  )
}

function Row({
  label,
  sub,
  children,
}: {
  label: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: '1rem',
      alignItems: 'center',
      padding: '0.9rem 0',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.95rem', fontWeight: 700 }}>
          {label}
        </div>
        {sub && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

export default function MembershipPage() {
  const router = useRouter()
  const [nativeAppMode] = useState(isNativeApp)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushStatus, setPushStatus] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<BeerVisibilityProfile>(DEFAULT_BEER_VISIBILITY_PROFILE)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)

  const loadMembership = useCallback(async (userId: string) => {
    const res = await fetch(`/api/beer-visibility-preference?user_id=${encodeURIComponent(userId)}`)
    const json = await res.json().catch(() => ({})) as {
      tier?: string
      rawTier?: string | null
      preference?: BeerVisibilityPreference | null
      effectivePreference?: BeerVisibilityPreference
      supported?: boolean
      error?: string
    }
    if (!res.ok) throw new Error(json.error || 'Could not load membership settings.')
    const tier = normalizeMembershipTier(json.tier)
    setVisibility({
      tier,
      rawTier: json.rawTier ?? null,
      preference: json.preference ?? null,
      effectivePreference: json.effectivePreference ?? getEffectiveBeerVisibilityPreference(tier, json.preference ?? null),
      preferenceColumnAvailable: json.supported ?? null,
    })
  }, [])

  const loadNotificationPrefs = useCallback(async (currentUser: User) => {
    const res = await fetch(`/api/notification-preferences?user_id=${encodeURIComponent(currentUser.id)}`)
    const json = await res.json().catch(() => ({})) as { prefs?: Partial<NotifPrefs>; error?: string }
    if (!res.ok) throw new Error(json.error || 'Could not load notification preferences.')
    setPrefs({ ...DEFAULT_NOTIF_PREFS, ...(json.prefs ?? {}) })
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => setPushSupported(canUseWebPush()))
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      if (!user) {
        setLoading(false)
        return
      }
      try {
        await Promise.all([loadMembership(user.id), loadNotificationPrefs(user)])
        if (canUseWebPush()) {
          const reg = await navigator.serviceWorker.ready
          setPushEnabled(Boolean(await reg.pushManager.getSubscription()))
        }
      } catch (err) {
        setPrefsError(err instanceof Error ? err.message : 'Could not load settings.')
      } finally {
        setLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [loadMembership, loadNotificationPrefs])

  const tierLabel = useMemo(() => {
    if (visibility.tier === 'hallowed') return 'The Hallowed'
    if (visibility.tier === 'oddballs') return 'Oddballs'
    return 'Not selected yet'
  }, [visibility.tier])

  const savePrefs = async (next: NotifPrefs) => {
    if (!user) return
    setPrefsSaving(true)
    setPrefsError(null)
    const res = await fetch('/api/notification-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, email: user.email, ...next }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      setPrefsError(json.error || 'Could not save notification preferences.')
    }
    setPrefsSaving(false)
  }

  const updateNotifPref = (key: keyof NotifPrefs, value: boolean) => {
    let next: NotifPrefs
    if (key === 'social_all') {
      next = {
        ...prefs,
        social_all: value,
        social_new_comment: value,
        social_new_reaction: value,
        social_reaction_to_your_items: value,
        social_comment_on_your_items: value,
      }
    } else {
      next = { ...prefs, [key]: value }
      if (key !== 'daily_beer') {
        next.social_all = SOCIAL_KEYS.every(k => next[k])
      }
    }
    setPrefs(next)
    void savePrefs(next)
  }

  const enableWebPush = async () => {
    if (!user || !pushSupported) return
    setPushStatus(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus(permission === 'denied'
          ? 'Notifications are blocked in this browser. Use browser settings to re-enable them.'
          : 'Notifications were not enabled.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const subscription = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), user_id: user.id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error || 'Could not save this browser subscription.')
      }
      setPushEnabled(true)
      setPushStatus('Web notifications are enabled for this browser.')
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : 'Could not enable web notifications.')
    }
  }

  const disableWebPush = async () => {
    if (!user || !pushSupported) return
    setPushStatus(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      setPushEnabled(false)
      setPushStatus('Web notifications are disabled for this browser.')
    } catch (err) {
      setPushStatus(err instanceof Error ? err.message : 'Could not disable web notifications.')
    }
  }

  const saveBeerVisibility = async (preference: BeerVisibilityPreference) => {
    if (!user || visibility.preferenceColumnAvailable === false) return
    setVisibilitySaving(true)
    setVisibilityError(null)
    const res = await fetch('/api/beer-visibility-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, preference }),
    })
    const json = await res.json().catch(() => ({})) as { error?: string; supported?: boolean }
    if (!res.ok) {
      setVisibilityError(json.error || 'Could not save beer visibility.')
      if (json.supported === false) {
        setVisibility(v => ({ ...v, preferenceColumnAvailable: false }))
      }
    } else {
      setVisibility(v => ({
        ...v,
        preference,
        effectivePreference: getEffectiveBeerVisibilityPreference(v.tier, preference),
        preferenceColumnAvailable: true,
      }))
    }
    setVisibilitySaving(false)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!nativeAppMode && <Nav user={user} />}
      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,140,0,0.35))' }} />
          <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.6rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
            The Settings
          </span>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(255,140,0,0.35))' }} />
        </div>

        {loading ? (
          <p style={{ color: 'var(--gold)', textAlign: 'center', padding: '4rem 0' }}>Loading membership settings...</p>
        ) : !user ? (
          <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
            <h1 style={{ color: 'var(--text)', fontSize: '1.4rem', marginBottom: '0.75rem' }}>Members Only</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Sign in to view membership and notification settings.
            </p>
            <Link href="/auth" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--bg)', padding: '0.75rem 2rem', borderRadius: '8px', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, letterSpacing: '0.1em', textDecoration: 'none' }}>
              Sign In
            </Link>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.4rem 1.5rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Account
              </div>
              <h1 style={{ color: 'var(--text)', fontSize: '1.35rem', marginBottom: '0.2rem' }}>{tierLabel}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0 }}>{user.email}</p>
            </section>

            <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.4rem 1.5rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Beer Calendar Visibility
              </div>
              {visibility.tier === 'oddballs' ? (
                <>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                    Oddballs defaults to participating odd-day beers. Show all is a peek view; even-day Full Society beers remain read-only for rating and beer-specific Wall posting.
                  </p>
                  <Row label="Participating beers only" sub="Default Oddballs view: odd days only.">
                    <Toggle
                      disabled={visibilitySaving || visibility.preferenceColumnAvailable === false}
                      checked={visibility.effectivePreference === 'participating_only'}
                      onChange={() => void saveBeerVisibility('participating_only')}
                    />
                  </Row>
                  <Row label="Show all beers" sub="Peek at the full calendar without changing your Oddballs participation.">
                    <Toggle
                      disabled={visibilitySaving || visibility.preferenceColumnAvailable === false}
                      checked={visibility.effectivePreference === 'all'}
                      onChange={() => void saveBeerVisibility('all')}
                    />
                  </Row>
                  {visibility.preferenceColumnAvailable === false && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, marginTop: '0.75rem' }}>
                      Saving this preference is not available in the current web schema yet. The safe default is participating beers only.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
                  Hallowed members see the full 31-day calendar. Oddballs members default to odd-day participating beers.
                </p>
              )}
              {visibilityError && <p style={{ color: '#e05555', fontSize: '0.82rem', marginTop: '0.75rem' }}>{visibilityError}</p>}
            </section>

            <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.4rem 1.5rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Notifications
              </div>
              {!pushSupported ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                  This browser cannot enable HHS web push notifications here. Preferences below still save for supported web/PWA or native notification delivery.
                </p>
              ) : (
                <>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: '0.75rem' }}>
                    Web notifications use this browser&apos;s push permission. Expo push tokens are native-only, so the web app uses its existing web subscription endpoint.
                    {!isPWA() ? ' On mobile, install HHS to your home screen for the most reliable web notification behavior.' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={pushEnabled ? disableWebPush : enableWebPush}
                    style={{ background: pushEnabled ? 'transparent' : 'var(--gold)', border: pushEnabled ? '1px solid var(--border)' : 'none', color: pushEnabled ? 'var(--text-muted)' : 'var(--bg)', padding: '0.55rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.75rem' }}
                  >
                    {pushEnabled ? 'Disable Web Notifications' : 'Enable Web Notifications'}
                  </button>
                </>
              )}
              {pushStatus && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>{pushStatus}</p>}

              <Row label="Daily Beer" sub="Get notified each day your next beer is ready.">
                <Toggle disabled={prefsSaving} checked={prefs.daily_beer} onChange={v => updateNotifPref('daily_beer', v)} />
              </Row>
              <Row label="All Social Notifications" sub="Enable or disable all Wall social alerts at once.">
                <Toggle disabled={prefsSaving} checked={prefs.social_all} onChange={v => updateNotifPref('social_all', v)} />
              </Row>
              <div style={{ paddingLeft: '0.75rem', borderLeft: '1px solid var(--border)' }}>
                <Row label="New Comment" sub="When someone comments on any post.">
                  <Toggle disabled={prefsSaving} checked={prefs.social_new_comment} onChange={v => updateNotifPref('social_new_comment', v)} />
                </Row>
                <Row label="New Reaction" sub="When someone reacts to any post.">
                  <Toggle disabled={prefsSaving} checked={prefs.social_new_reaction} onChange={v => updateNotifPref('social_new_reaction', v)} />
                </Row>
                <Row label="Reaction to Your Items" sub="When someone reacts to your post.">
                  <Toggle disabled={prefsSaving} checked={prefs.social_reaction_to_your_items} onChange={v => updateNotifPref('social_reaction_to_your_items', v)} />
                </Row>
                <Row label="Comment on Your Items" sub="When someone comments on your post.">
                  <Toggle disabled={prefsSaving} checked={prefs.social_comment_on_your_items} onChange={v => updateNotifPref('social_comment_on_your_items', v)} />
                </Row>
              </div>
              {prefsSaving && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.75rem' }}>Saving...</p>}
              {prefsError && <p style={{ color: '#e05555', fontSize: '0.82rem', marginTop: '0.75rem' }}>{prefsError}</p>}
            </section>

            <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.4rem 1.5rem' }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Auth
              </div>
              <button
                type="button"
                onClick={signOut}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.55rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Modern Antiqua', serif", letterSpacing: '0.08em' }}
              >
                Sign Out
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
