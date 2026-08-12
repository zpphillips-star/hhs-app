'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_BEER_VISIBILITY_PROFILE,
  getEffectiveBeerVisibilityPreference,
  getLocalBeerVisibilityPreference,
  normalizeMembershipTier,
  setLocalBeerVisibilityPreference,
  type BeerVisibilityPreference,
  type BeerVisibilityProfile,
} from '@/lib/membership'

type User = { id: string; email?: string }

type ProfileSummary = {
  username: string | null
  displayName: string | null
  email: string | null
}

type SettingsTab = 'account' | 'notifications'

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

const titleStyle: CSSProperties = {
  color: 'var(--text)',
  fontFamily: "'Modern Antiqua', serif",
  fontWeight: 700,
}

const cardTitleStyle: CSSProperties = {
  ...titleStyle,
  fontSize: '1.35rem',
  margin: 0,
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

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
        flex: '0 0 auto',
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

function BeerVisibilitySegment({
  value,
  disabled,
  onChange,
}: {
  value: BeerVisibilityPreference
  disabled?: boolean
  onChange: (preference: BeerVisibilityPreference) => void
}) {
  const options: { value: BeerVisibilityPreference; title: string; sub: string }[] = [
    { value: 'all', title: 'The Hallowed', sub: '31 beer Membership' },
    { value: 'participating_only', title: 'The Oddballs', sub: '16 beer membership' },
  ]

  return (
    <div
      role="group"
      aria-label="Beer calendar visibility"
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 0,
        border: '1px solid rgba(217,124,43,0.34)',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '999px',
        padding: '4px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '4px',
          bottom: '4px',
          left: '4px',
          width: 'calc((100% - 8px) / 2)',
          borderRadius: '999px',
          background: 'rgba(217,124,43,0.24)',
          border: '1px solid rgba(217,124,43,0.42)',
          transform: value === 'all' ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.18s ease',
        }}
      />
      {options.map(option => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            style={{
              position: 'relative',
              zIndex: 1,
              border: 0,
              background: 'transparent',
              color: selected ? 'var(--gold)' : 'var(--text-muted)',
              padding: '0.78rem 0.8rem',
              borderRadius: '999px',
              cursor: disabled ? 'default' : 'pointer',
              textAlign: 'center',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ display: 'block', fontFamily: "'Modern Antiqua', serif", fontSize: '0.9rem', fontWeight: 700 }}>
              {option.title}
            </span>
            <span style={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.35 }}>
              {option.sub}
            </span>
          </button>
        )
      })}
    </div>
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
        {sub && <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Card({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <section style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.4rem 1.5rem' }}>
      <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        {eyebrow}
      </div>
      {children}
    </section>
  )
}

export default function MembershipPage() {
  const router = useRouter()
  const [nativeAppMode] = useState(isNativeApp)
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileSummary>({ username: null, displayName: null, email: null })
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS)
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)
  const [visibility, setVisibility] = useState<BeerVisibilityProfile>(DEFAULT_BEER_VISIBILITY_PROFILE)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)

  const loadMembership = useCallback(async (userId: string) => {
    const res = await fetch(`/api/beer-visibility-preference?user_id=${encodeURIComponent(userId)}`)
    const json = await res.json().catch(() => ({})) as {
      tier?: string
      rawTier?: string | null
      username?: string | null
      displayName?: string | null
      email?: string | null
      preference?: BeerVisibilityPreference | null
      effectivePreference?: BeerVisibilityPreference
      supported?: boolean
      error?: string
    }
    if (!res.ok) throw new Error(json.error || 'Could not load membership settings.')
    const tier = normalizeMembershipTier(json.tier)
    const serverPreference = json.preference ?? null
    const localPreference = json.supported === false ? getLocalBeerVisibilityPreference(userId) : null
    const preference = localPreference ?? serverPreference
    setProfile({
      username: json.username ?? null,
      displayName: json.displayName ?? null,
      email: json.email ?? null,
    })
    setVisibility({
      tier,
      rawTier: json.rawTier ?? null,
      preference,
      effectivePreference: preference
        ? getEffectiveBeerVisibilityPreference(tier, preference)
        : json.effectivePreference ?? getEffectiveBeerVisibilityPreference(tier, null),
      preferenceColumnAvailable: json.supported ?? null,
    })
  }, [])

  const loadNotificationPrefs = useCallback(async (currentUser: User) => {
    const res = await fetch(`/api/notification-preferences?user_id=${encodeURIComponent(currentUser.id)}`, {
      headers: await getAuthHeaders(),
    })
    const json = await res.json().catch(() => ({})) as { prefs?: Partial<NotifPrefs>; error?: string }
    if (!res.ok) throw new Error(json.error || 'Could not load notification preferences.')
    setPrefs({ ...DEFAULT_NOTIF_PREFS, ...(json.prefs ?? {}) })
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      setUser(user)
      if (!user) {
        setLoading(false)
        return
      }
      try {
        await Promise.all([loadMembership(user.id), loadNotificationPrefs(user)])
      } catch (err) {
        setPrefsError(err instanceof Error ? err.message : 'Could not load settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [loadMembership, loadNotificationPrefs])

  const tierLabel = useMemo(() => {
    if (visibility.tier === 'hallowed') return 'The Hallowed'
    if (visibility.tier === 'oddballs') return 'The Oddballs'
    return 'Not selected yet'
  }, [visibility.tier])

  const displayUsername = profile.displayName || profile.username || user?.email || 'Member'

  const savePrefs = async (next: NotifPrefs, previous: NotifPrefs) => {
    if (!user) return
    setPrefsSaving(true)
    setPrefsError(null)
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ user_id: user.id, email: user.email, ...next }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        setPrefs(previous)
        setPrefsError(json.error || 'Could not save notification preferences.')
      }
    } catch (err) {
      setPrefs(previous)
      setPrefsError(err instanceof Error ? err.message : 'Could not save notification preferences.')
    } finally {
      setPrefsSaving(false)
    }
  }

  const updateNotifPref = (key: keyof NotifPrefs, value: boolean) => {
    const previous = prefs
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
    void savePrefs(next, previous)
  }

  const saveBeerVisibility = async (preference: BeerVisibilityPreference) => {
    if (!user) return
    setVisibilitySaving(true)
    setVisibilityError(null)
    const previous = visibility
    setVisibility(v => ({
      ...v,
      preference,
      effectivePreference: getEffectiveBeerVisibilityPreference(v.tier, preference),
    }))
    if (visibility.preferenceColumnAvailable === false) {
      setLocalBeerVisibilityPreference(user.id, preference)
      setVisibilitySaving(false)
      return
    }
    try {
      const res = await fetch('/api/beer-visibility-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, preference }),
      })
      const json = await res.json().catch(() => ({})) as { error?: string; supported?: boolean }
      if (!res.ok) {
        setVisibility(previous)
        setVisibilityError(json.error || 'Could not save beer visibility.')
        if (json.supported === false) {
          setLocalBeerVisibilityPreference(user.id, preference)
          setVisibility(v => ({
            ...v,
            preference,
            effectivePreference: getEffectiveBeerVisibilityPreference(v.tier, preference),
            preferenceColumnAvailable: false,
          }))
          setVisibilityError(null)
        }
      } else {
        setVisibility(v => ({ ...v, preferenceColumnAvailable: true }))
      }
    } catch (err) {
      setVisibility(previous)
      setVisibilityError(err instanceof Error ? err.message : 'Could not save beer visibility.')
    } finally {
      setVisibilitySaving(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const closeSettings = () => router.push('/')

  const tabButton = (tab: SettingsTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      style={{
        width: '100%',
        minWidth: 0,
        border: `1px solid ${activeTab === tab ? 'rgba(217,124,43,0.55)' : 'var(--border)'}`,
        background: activeTab === tab ? 'rgba(217,124,43,0.16)' : 'rgba(255,255,255,0.03)',
        color: activeTab === tab ? 'var(--gold)' : 'var(--text-muted)',
        padding: '0.65rem 0.75rem',
        borderRadius: '999px',
        cursor: 'pointer',
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.72rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </button>
  )

  const settingsLink = (href: string, label: string) => (
    <Link
      href={href}
      style={{
        width: '100%',
        minWidth: 0,
        border: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--text-muted)',
        padding: '0.65rem 0.75rem',
        borderRadius: '999px',
        cursor: 'pointer',
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.72rem',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        textAlign: 'center',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!nativeAppMode && <Nav user={user} />}

      <div
        role="presentation"
        className={user ? 'hhs-settings-overlay hhs-settings-overlay-with-mobile-nav' : 'hhs-settings-overlay'}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 80,
          background: 'rgba(7, 6, 12, 0.72)',
          backdropFilter: 'blur(8px)',
          padding: '0.85rem 1rem calc(5.5rem + env(safe-area-inset-bottom))',
          overflowY: 'auto',
        }}
      >
        <main
          role="dialog"
          aria-modal="true"
          aria-labelledby="hhs-settings-title"
          style={{
            maxWidth: '820px',
            margin: '0 auto',
            background: 'rgba(25, 23, 38, 0.98)',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1.2rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--gold)', fontSize: '0.58rem', letterSpacing: '0.32em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Hallowed Hop Society
              </div>
              <h1 id="hhs-settings-title" style={{ ...titleStyle, fontSize: '1.55rem', margin: 0 }}>
                The Settings
              </h1>
            </div>
            <button
              type="button"
              aria-label="Close settings"
              onClick={closeSettings}
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', width: '2.2rem', height: '2.2rem', borderRadius: '999px', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div className="hhs-settings-nav-grid" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            {tabButton('account', 'Account')}
            {tabButton('notifications', 'Notifications')}
            {settingsLink('/about', 'About HHS')}
            {settingsLink('/feedback', 'Feedback')}
          </div>

          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loading ? (
              <p style={{ color: 'var(--gold)', textAlign: 'center', padding: '3rem 0' }}>Loading settings...</p>
            ) : !user ? (
              <Card eyebrow="Account">
                <h2 style={{ ...cardTitleStyle, marginBottom: '0.75rem' }}>Members Only</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                  Sign in to view membership, notification, and HHS account settings.
                </p>
                <Link href="/auth" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--bg)', padding: '0.75rem 2rem', borderRadius: '8px', fontFamily: "'Modern Antiqua', serif", fontWeight: 700, letterSpacing: '0.1em', textDecoration: 'none' }}>
                  Sign In
                </Link>
              </Card>
            ) : activeTab === 'account' ? (
              <>
                <Card eyebrow="Account">
                  <h2 style={{ ...cardTitleStyle, marginBottom: '0.2rem' }}>{displayUsername}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', margin: 0 }}>{user.email}</p>
                  <Row label="Subscription" sub="Your current HHS membership tier.">
                    <span style={{ color: 'var(--gold)', textAlign: 'right' }}>{tierLabel}</span>
                  </Row>
                  <Row label="Username" sub="Shown on The Wall and The Rankings">
                    <span style={{ color: 'var(--text)', textAlign: 'right' }}>{profile.username ? `@${profile.username}` : 'Not set'}</span>
                  </Row>
                </Card>

                <Card eyebrow="Beer Calendar Visibility">
                  <div style={{ marginBottom: '0.85rem' }}>
                    {visibility.tier === 'oddballs' && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.65, margin: 0 }}>
                        Use the slider to choose your calendar view.
                      </p>
                    )}
                  </div>
                  {visibility.tier === 'oddballs' ? (
                    <>
                      <BeerVisibilitySegment
                        disabled={visibilitySaving}
                        value={visibility.effectivePreference}
                        onChange={preference => void saveBeerVisibility(preference)}
                      />
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.55, margin: '0.75rem 0 0' }}>
                        <p style={{ margin: 0 }}>
                          <strong style={{ color: 'var(--text)', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 700 }}>The Oddballs</strong>: visibility to only the odd-day beers.
                        </p>
                        <div style={{ borderTop: '1px solid var(--border)', margin: '0.65rem 0' }} />
                        <p style={{ margin: 0 }}>
                          <strong style={{ color: 'var(--text)', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 700 }}>The Hallowed</strong>: visibility to all 31 days of beers. Caveat: The Oddball members will be able to see the beers but will be unable to rate or post to the Beer Wall for those beers.
                        </p>
                      </div>
                      {visibility.preferenceColumnAvailable === false && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, marginTop: '0.75rem' }}>
                          Server-side saving is not available in the current web schema yet, so this device will remember your preview choice locally.
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
                      Hallowed: full 31-day calendar. Oddballs: odd-day beers by default.
                    </p>
                  )}
                  {visibilitySaving && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.75rem' }}>Saving beer visibility...</p>}
                  {visibilityError && <p style={{ color: '#e05555', fontSize: '0.82rem', marginTop: '0.75rem' }}>{visibilityError}</p>}
                </Card>

                <Card eyebrow="Sign In / Out">
                  <button
                    type="button"
                    onClick={signOut}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '0.55rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Modern Antiqua', serif", letterSpacing: '0.08em' }}
                  >
                    Sign Out
                  </button>
                </Card>
              </>
            ) : (
              <Card eyebrow="Notifications">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                  {nativeAppMode
                    ? 'Choose which HHS reminders you want to receive.'
                    : 'Daily Beer reminders are available now. More alerts are coming to the app in 2027.'}
                </p>
                <Row label="Daily Beer" sub="Get notified each day your next beer is ready.">
                  <Toggle disabled={prefsSaving} checked={prefs.daily_beer} onChange={v => updateNotifPref('daily_beer', v)} />
                </Row>
                {nativeAppMode ? (
                  <>
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
                  </>
                ) : (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.9rem', marginTop: '0.15rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: 'var(--text)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.95rem', fontWeight: 700 }}>
                          Wall/social alerts
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          Native only — look forward to this in the app coming 2027.
                        </div>
                      </div>
                      <span style={{ border: '1px solid var(--border)', borderRadius: '999px', color: 'var(--text-muted)', fontSize: '0.68rem', letterSpacing: '0.08em', padding: '0.25rem 0.55rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        Native only
                      </span>
                    </div>
                  </div>
                )}
                {prefsSaving && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.75rem' }}>Saving notification preferences...</p>}
                {prefsError && <p style={{ color: '#e05555', fontSize: '0.82rem', marginTop: '0.75rem' }}>{prefsError}</p>}
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
