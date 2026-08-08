'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
type FeedbackStatus = 'submitted' | 'backlog' | 'in_progress' | 'live'

interface FeedbackItem {
  id: string
  title: string
  description: string | null
  name: string | null
  status: FeedbackStatus
  image_urls: string[]
  created_at: string
}

// ── Stage config (adapted from Scorpanion — HHS gold/dark palette) ────────────
const STAGES: {
  id: FeedbackStatus
  label: string
  description: string
  color: string
  bg: string
  borderColor: string
}[] = [
  {
    id: 'submitted',
    label: 'Submitted',
    description: "New suggestions we've received and are reviewing",
    color: '#a69d8d',
    bg: 'rgba(166,157,141,0.07)',
    borderColor: 'rgba(166,157,141,0.2)',
  },
  {
    id: 'backlog',
    label: 'Planned',
    description: 'Accepted and scheduled to be built',
    color: '#d97c2b',
    bg: 'rgba(217,124,43,0.08)',
    borderColor: 'rgba(217,124,43,0.22)',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    description: 'Actively being built right now',
    color: '#e8953a',
    bg: 'rgba(232,149,58,0.08)',
    borderColor: 'rgba(232,149,58,0.25)',
  },
  {
    id: 'live',
    label: 'Live',
    description: 'Shipped and available in the app',
    color: '#5fa65f',
    bg: 'rgba(95,166,95,0.07)',
    borderColor: 'rgba(95,166,95,0.2)',
  },
]

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'submitted',   label: 'Submitted'   },
  { value: 'backlog',     label: 'Planned'      },
  { value: 'in_progress', label: 'In Progress'  },
  { value: 'live',        label: 'Live'         },
]

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

// ── Image uploader component ──────────────────────────────────────────────────
function ImageUploader({
  uploadedUrls,
  onAdd,
  onRemove,
}: {
  uploadedUrls: string[]
  onAdd: (url: string) => void
  onRemove: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/feedback/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      onAdd(data.url)
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: uploadedUrls.length ? 10 : 0 }}>
        {uploadedUrls.map(url => (
          <div key={url} style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden',
            border: '1px solid rgba(217,124,43,0.3)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Attached" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              type="button"
              onClick={() => onRemove(url)}
              style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10,
                background: 'rgba(0,0,0,0.75)', border: 'none', color: '#d9d8d2', fontSize: 12,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1 }}
              aria-label="Remove image"
            >×</button>
          </div>
        ))}
        {uploadedUrls.length < 4 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            style={{ width: 72, height: 72, borderRadius: 8, border: '1.5px dashed rgba(217,124,43,0.4)',
              background: 'rgba(217,124,43,0.06)', color: '#a69d8d', fontSize: 11, cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              opacity: uploading ? 0.6 : 1 }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>📷</span>
            <span>{uploading ? '…' : '+ Photo'}</span>
          </button>
        )}
      </div>
      {uploadError && (
        <p style={{ color: '#e87070', fontSize: 12, marginTop: 4 }}>{uploadError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}

// ── Stage section ─────────────────────────────────────────────────────────────
function StageSection({
  stage,
  items,
  defaultOpen,
  isAdmin,
  onStatusChange,
}: {
  stage: typeof STAGES[number]
  items: FeedbackItem[]
  defaultOpen: boolean
  isAdmin: boolean
  onStatusChange: (id: string, status: FeedbackStatus) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const previousDefaultOpen = useRef(defaultOpen)

  useEffect(() => {
    if (previousDefaultOpen.current === defaultOpen) return
    previousDefaultOpen.current = defaultOpen
    setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${stage.borderColor}`,
      background: open ? stage.bg : 'rgba(255,255,255,0.02)', marginBottom: 12 }}>

      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 4, height: 32, borderRadius: 2, background: stage.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
              fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: stage.color }}>
              {stage.label}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: `${stage.color}20`, color: stage.color }}>
              {items.length}
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#7a7468', marginTop: 2 }}>{stage.description}</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ flexShrink: 0, color: stage.color, opacity: 0.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Items */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${stage.borderColor}` }}>
          {items.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#4a4560' }}>
                {stage.id === 'submitted' ? 'Be the first — tap "+ Suggest" above' : 'Nothing here yet'}
              </p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(25,23,38,0.7)', border: '1px solid rgba(217,124,43,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4, color: '#d9d8d2', flex: 1 }}>
                    {item.title}
                  </p>
                  <span style={{ fontSize: 10, color: '#4a4560', flexShrink: 0, marginTop: 2 }}>
                    {formatDate(item.created_at)}
                  </span>
                </div>
                {item.description && (
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: '#7a7468' }}>{item.description}</p>
                )}
                {item.name && (
                  <p style={{ fontSize: 11, marginTop: 6, color: '#4a4560' }}>— {item.name}</p>
                )}
                {/* Attached images */}
                {item.image_urls && item.image_urls.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {item.image_urls.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Attachment ${i + 1}`}
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6,
                            border: '1px solid rgba(217,124,43,0.25)' }} />
                      </a>
                    ))}
                  </div>
                )}
                {/* Admin status dropdown */}
                {isAdmin && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(217,124,43,0.1)' }}>
                    <select
                      value={item.status}
                      onChange={e => onStatusChange(item.id, e.target.value as FeedbackStatus)}
                      style={{ fontSize: 12, borderRadius: 8, padding: '5px 10px', width: '100%',
                        background: 'rgba(217,124,43,0.1)', border: '1px solid rgba(217,124,43,0.2)',
                        color: '#d9d8d2', cursor: 'pointer', outline: 'none' }}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value} style={{ background: '#201d30' }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeedbackPage() {
  const mountedRef = useRef(true)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)

  // Form state
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [name, setName]               = useState('')
  const [imageUrls, setImageUrls]     = useState<string[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const checkAdminStatus = useCallback(async (accessToken?: string | null) => {
    if (!accessToken) {
      setIsAdmin(false)
      return
    }

    try {
      const res = await fetch('/api/feedback?adminStatus=1', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json()
      setIsAdmin(Boolean(res.ok && data.isAdmin))
    } catch {
      setIsAdmin(false)
    }
  }, [])

  // Check auth and ask the server whether this session can manage feedback.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url || url.includes('placeholder')) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setToken(data.session?.access_token ?? null)
      void checkAdminStatus(data.session?.access_token)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      setToken(session?.access_token ?? null)
      void checkAdminStatus(session?.access_token)
    })
    return () => subscription.unsubscribe()
  }, [checkAdminStatus])

  // Fetch feedback items
  const fetchItems = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/feedback', { signal })
      if (!res.ok) return
      const data = await res.json()
      if (mountedRef.current && Array.isArray(data.items)) setItems(data.items)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      /* silent */
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => fetchItems(controller.signal))
    const iv = setInterval(() => fetchItems(), 30_000)
    return () => {
      controller.abort()
      clearInterval(iv)
    }
  }, [fetchItems])

  // Submit feedback
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          name: name.trim() || undefined,
          image_urls: imageUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? 'Failed to submit'); return }
      setJustSubmitted(true)
      setTitle(''); setDescription(''); setName(''); setImageUrls([])
      setShowForm(false)
      setTimeout(() => { if (mountedRef.current) setJustSubmitted(false) }, 6000)
      fetchItems()
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Admin status change
  async function handleStatusChange(id: string, status: FeedbackStatus) {
    if (!token || !isAdmin) return
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    try {
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) fetchItems()
    } catch { fetchItems() }
  }

  const grouped = STAGES.reduce<Record<FeedbackStatus, FeedbackItem[]>>(
    (acc, s) => { acc[s.id] = items.filter(i => i.status === s.id); return acc },
    { submitted: [], backlog: [], in_progress: [], live: [] }
  )
  const shouldOpenLiveByDefault =
    grouped.live.length > 0 &&
    grouped.submitted.length === 0 &&
    grouped.backlog.length === 0 &&
    grouped.in_progress.length === 0

  function getDefaultOpenStage(stageId: FeedbackStatus) {
    if (shouldOpenLiveByDefault) return stageId === 'live'
    return stageId === 'submitted' || stageId === 'in_progress'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(217,124,43,0.18)',
    borderRadius: 10,
    color: '#d9d8d2',
    fontSize: 15,
    outline: 'none',
    padding: '12px 16px',
    fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = '#d97c2b'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,124,43,0.1)'
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'rgba(217,124,43,0.18)'
    e.currentTarget.style.boxShadow = 'none'
  }

  function goHome() {
    window.location.assign('/')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', paddingBottom: '4rem' }}>
      <Nav user={user} />

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center',
        padding: '12px 16px', background: 'rgba(25,23,38,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(217,124,43,0.18)' }}>
        <button
          type="button"
          onClick={goHome}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
            borderRadius: 8, color: '#a69d8d', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(217,124,43,0.18)', textDecoration: 'none', flexShrink: 0, cursor: 'pointer' }}
          aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
            fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#d97c2b' }}>
            HHS · Feedback
          </span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ height: 32, paddingLeft: 14, paddingRight: 14, flexShrink: 0,
            background: showForm ? 'rgba(217,124,43,0.12)' : '#d97c2b',
            color: showForm ? '#d97c2b' : '#191726',
            border: showForm ? '1px solid rgba(217,124,43,0.35)' : 'none',
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {showForm ? 'Cancel' : '+ Suggest'}
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {/* Intro */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)', fontSize: 24,
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#d9d8d2',
            marginBottom: 6 }}>
            Roadmap &amp; Feedback
          </h1>
          <p style={{ fontSize: 13, color: '#7a7468', lineHeight: 1.5 }}>
            Track what&apos;s being built, what&apos;s shipped, and suggest new features.
            {isAdmin && <span style={{ color: '#d97c2b' }}> · Admin mode — you can move items between stages.</span>}
          </p>
        </div>

        {/* Success toast */}
        {justSubmitted && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(95,166,95,0.1)', border: '1px solid rgba(95,166,95,0.2)', color: '#8fd48f' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6.5" stroke="#5fa65f"/>
              <path d="M4 7l2 2 4-4" stroke="#5fa65f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Thanks! Your suggestion was submitted and is under review.
          </div>
        )}

        {/* Collapsible submit form */}
        {showForm && (
          <div style={{ marginBottom: 24, padding: 20, borderRadius: 16,
            background: 'rgba(217,124,43,0.04)', border: '1px solid rgba(217,124,43,0.22)' }}>
            <h2 style={{ fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)', fontSize: 14,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d9d8d2', marginBottom: 16 }}>
              Suggest a Feature
            </h2>
            {submitError && (
              <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, fontSize: 13,
                background: 'rgba(232,112,112,0.1)', border: '1px solid rgba(232,112,112,0.2)', color: '#e87070' }}>
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder='Short title (e.g. "Show tap list nearby")'
                style={{ ...inputStyle, height: 48 }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe your idea in more detail…"
                style={{ ...inputStyle, resize: 'none' }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name (optional)"
                style={{ ...inputStyle, height: 48 }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              {/* Image upload */}
              <div>
                <p style={{ fontSize: 12, color: '#7a7468', marginBottom: 8 }}>
                  Attach screenshots (optional, up to 4)
                </p>
                <ImageUploader
                  uploadedUrls={imageUrls}
                  onAdd={url => setImageUrls(prev => [...prev, url])}
                  onRemove={url => setImageUrls(prev => prev.filter(u => u !== url))}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                style={{ height: 48, background: '#d97c2b', color: '#191726', borderRadius: 10,
                  fontSize: 14, fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: 'var(--font-modern-antiqua, "Modern Antiqua", serif)',
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {submitting ? 'Submitting…' : 'Submit Suggestion'}
              </button>
            </form>
          </div>
        )}

        {/* Stage sections */}
        <div>
          {STAGES.map(stage => (
            <StageSection
              key={stage.id}
              stage={stage}
              items={grouped[stage.id]}
              defaultOpen={getDefaultOpenStage(stage.id)}
              isAdmin={isAdmin}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
