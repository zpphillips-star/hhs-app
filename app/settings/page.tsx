'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  daily_beer_enabled: boolean
  social_enabled: boolean
  social_new_comment: boolean
  social_new_reaction: boolean
  social_reaction_to_yours: boolean
  social_comment_on_yours: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  daily_beer_enabled: true,
  social_enabled: true,
  social_new_comment: true,
  social_new_reaction: true,
  social_reaction_to_yours: true,
  social_comment_on_yours: true,
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load user + preferences
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUser({ id: data.user.id, email: data.user.email })

      try {
        const res = await fetch('/api/notification-prefs', { headers: await getAuthHeaders() })
        if (res.ok) {
          const fetched = await res.json()
          if (fetched && typeof fetched === 'object') {
            setPrefs({ ...DEFAULT_PREFS, ...fetched })
          }
        }
      } catch { /* use defaults */ }
      setLoading(false)
    })
  }, [])

  // Save preferences
  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/notification-prefs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Something went wrong') }
    finally { setSaving(false) }
  }

  // Toggle a single pref; if social master toggle turns off, disable all children
  function toggle(key: keyof NotificationPrefs) {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (key === 'social_enabled' && !next.social_enabled) {
        next.social_new_comment = false
        next.social_new_reaction = false
        next.social_reaction_to_yours = false
        next.social_comment_on_yours = false
      }
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!loading && !user) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
        <Nav user={null} />
        <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1.25rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif", fontSize: '1.05rem' }}>
            Sign in to manage your notification preferences.
          </p>
          <a href="/auth" style={{
            display: 'inline-block',
            marginTop: '1.25rem',
            padding: '0.65rem 1.5rem',
            background: 'var(--gold)',
            color: 'var(--bg)',
            borderRadius: 10,
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}>
            Sign In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Nav user={user} />

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1.25rem 5rem' }}>

        <h1 style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text)',
          fontSize: 'clamp(1.4rem, 4vw, 2rem)',
          fontWeight: 900,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '0.35rem',
        }}>
          Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif", fontSize: '1rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Manage your notification preferences for the Society.
        </p>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif" }}>Loading…</p>
        ) : (
          <>
            {/* ── Daily Beer Notifications ── */}
            <Section title="Daily Beer">
              <ToggleRow
                label="Daily Beer Notifications"
                description="Get notified when today's beer is revealed."
                checked={prefs.daily_beer_enabled}
                onChange={() => toggle('daily_beer_enabled')}
              />
            </Section>

            {/* ── Social Notifications ── */}
            <Section title="Social">
              <div style={{ padding: '0.9rem 1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                      Wall/social alerts
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif", fontSize: '0.88rem', lineHeight: 1.55, marginTop: 4 }}>
                      Native-app push only for now. Web/PWA Daily Beer is the only browser notification path that is fully wired, so web social toggles are hidden until Wall push delivery is supported.
                    </div>
                  </div>
                  <span style={{ border: '1px solid var(--border)', borderRadius: 999, color: 'var(--text-muted)', fontSize: '0.65rem', letterSpacing: '0.09em', padding: '0.25rem 0.55rem', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Native only
                  </span>
                </div>
              </div>
            </Section>

            {/* Save */}
            {error && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}
            {saved && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 8,
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.2)',
                color: '#86efac',
                fontSize: '0.85rem',
              }}>
                ✓ Preferences saved.
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '0.75rem 1.75rem',
                background: 'var(--gold)',
                border: 'none',
                borderRadius: 10,
                color: 'var(--bg)',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>

            {/* Push token info note */}
            <div style={{
              marginTop: '2rem',
              padding: '0.875rem 1rem',
              borderRadius: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif", fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>
                <span style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  🔔 Push Notifications
                </span>
                Browser push subscriptions are registered when you grant notification permission. On web/PWA, HHS currently sends Daily Beer browser reminders only; Wall/social push alerts are native-app only until the web delivery path is wired.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '1.5rem',
      borderRadius: 14,
      border: '1px solid var(--border)',
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.625rem 1rem',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(217,124,43,0.06)',
      }}>
        <span style={{
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.7rem',
          fontWeight: 800,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
        }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  indent,
  master,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
  indent?: boolean
  master?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: `0.75rem ${indent ? '1.5rem' : '1rem'}`,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: master ? "'Modern Antiqua', serif" : "'Crimson Text', serif",
          fontSize: master ? '0.88rem' : '1rem',
          fontWeight: master ? 700 : 400,
          color: 'var(--text)',
          margin: '0 0 2px',
          letterSpacing: master ? '0.05em' : undefined,
        }}>
          {label}
        </p>
        <p style={{ fontFamily: "'Crimson Text', serif", fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          {description}
        </p>
      </div>
      {/* Toggle switch */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        style={{
          width: 44,
          height: 24,
          borderRadius: 99,
          border: 'none',
          background: checked ? 'var(--gold)' : 'rgba(122,116,104,0.3)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  )
}
