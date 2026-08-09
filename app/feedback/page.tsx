'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

type FeedbackStatus = 'submitted' | 'backlog' | 'in_progress' | 'live'

interface FeedbackItem {
  id: string
  title: string
  description?: string | null
  name?: string | null
  status: FeedbackStatus
  image_urls?: string[] | null
  created_at: string
}

// ── Kanban stage config (mirroring Scorpanion pattern, HHS-themed) ───────────

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
    description: "New ideas we've received and are reviewing",
    color: 'var(--text-muted)',
    bg: 'rgba(122,116,104,0.07)',
    borderColor: 'rgba(122,116,104,0.22)',
  },
  {
    id: 'backlog',
    label: 'Planned',
    description: 'Accepted and on the ritual calendar',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.07)',
    borderColor: 'rgba(96,165,250,0.2)',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    description: 'Actively being brewed right now',
    color: 'var(--gold)',
    bg: 'rgba(217,124,43,0.07)',
    borderColor: 'rgba(217,124,43,0.22)',
  },
  {
    id: 'live',
    label: 'Live',
    description: 'Shipped and available in the Society',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.07)',
    borderColor: 'rgba(34,197,94,0.2)',
  },
]

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  catch { return '' }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [expanded, setExpanded] = useState<Record<FeedbackStatus, boolean>>({
    submitted: true, backlog: true, in_progress: true, live: true,
  })
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null)
    })
  }, [])

  // Load feedback
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/feedback')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setItems(data)
      else if (Array.isArray(data.items)) setItems(data.items)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    const firstLoad = window.setTimeout(() => { void fetchItems() }, 0)
    const iv = setInterval(fetchItems, 30_000)
    return () => {
      window.clearTimeout(firstLoad)
      clearInterval(iv)
    }
  }, [fetchItems])

  // Image selection
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - images.length)
    if (!files.length) return
    setImages(prev => [...prev, ...files].slice(0, 4))
    files.forEach(f => {
      const reader = new FileReader()
      reader.onload = ev => {
        setImagePreviews(prev => [...prev, ev.target?.result as string].slice(0, 4))
      }
      reader.readAsDataURL(f)
    })
    e.target.value = ''
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Upload images to Supabase Storage
  async function uploadImages(files: File[]): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `feedback/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('hhs-feedback').upload(path, file, { upsert: false })
      if (!error) {
        const { data: urlData } = supabase.storage.from('hhs-feedback').getPublicUrl(path)
        urls.push(urlData.publicUrl)
      }
    }
    return urls
  }

  // Submit feedback
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    let imageUrls: string[] = []
    if (images.length > 0) {
      setUploading(true)
      imageUrls = await uploadImages(images)
      setUploading(false)
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          name: name.trim(),
          image_urls: imageUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to submit')
        return
      }
      setJustSubmitted(true)
      setTitle(''); setDescription(''); setName('')
      setImages([]); setImagePreviews([])
      setShowForm(false)
      setTimeout(() => setJustSubmitted(false), 5000)
      fetchItems()
    } catch { setSubmitError('Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  function toggleStage(id: FeedbackStatus) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    padding: '12px 16px',
    fontFamily: "'Crimson Text', serif",
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--gold)'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,124,43,0.12)'
  }

  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = 'var(--border)'
    e.currentTarget.style.boxShadow = 'none'
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Nav user={user} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.25rem 5rem' }}>

        {/* Page header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{
            fontFamily: "'Modern Antiqua', serif",
            color: 'var(--text)',
            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            fontWeight: 900,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '0.35rem',
          }}>
            Roadmap & Feedback
          </h1>
          <p style={{ color: 'var(--text-muted)', fontFamily: "'Crimson Text', serif", fontSize: '1rem', lineHeight: 1.7 }}>
            Track what the Society is building and suggest your own ideas.
            Tap any section to expand it.
          </p>
        </div>

        {/* Suggest button */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '0.65rem 1.25rem',
              background: showForm ? 'transparent' : 'var(--gold)',
              color: showForm ? 'var(--gold)' : 'var(--bg)',
              border: showForm ? '1px solid var(--border)' : 'none',
              borderRadius: 10,
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {showForm ? 'Cancel' : '+ Suggest a Feature'}
          </button>
        </div>

        {/* Success toast */}
        {justSubmitted && (
          <div style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 12,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.2)',
            color: '#86efac',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            ✓ Thanks! Your feedback was submitted and is under review.
          </div>
        )}

        {/* Collapsible suggestion form */}
        {showForm && (
          <div style={{
            marginBottom: '1.5rem',
            borderRadius: 16,
            padding: '1.5rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}>
            <h2 style={{
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '1rem',
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: '1.25rem',
            }}>
              Suggest a Feature
            </h2>

            {submitError && (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.85rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}>
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder='Short title (e.g. "Show brewery map")'
                style={{ ...inputStyle, height: 48 }}
                onFocus={onFocus}
                onBlur={onBlur}
              />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what you'd like in more detail…"
                style={{ ...inputStyle, resize: 'vertical' }}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= 4}
                    style={{
                      padding: '6px 14px',
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-muted)',
                      fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.72rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: images.length >= 4 ? 'not-allowed' : 'pointer',
                      opacity: images.length >= 4 ? 0.5 : 1,
                    }}
                  >
                    📎 Attach Screenshot {images.length > 0 ? `(${images.length}/4)` : ''}
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: "'Crimson Text', serif" }}>
                    Optional — up to 4 images
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
                {imagePreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {imagePreviews.map((src, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Preview ${i + 1}`}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 20, height: 20,
                            borderRadius: '50%',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-muted)',
                            fontSize: 11,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || uploading}
                style={{
                  padding: '0.8rem',
                  background: 'var(--gold)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'var(--bg)',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: submitting || uploading ? 'not-allowed' : 'pointer',
                  opacity: submitting || uploading ? 0.65 : 1,
                }}
              >
                {uploading ? 'Uploading images…' : submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        )}

        {/* ── Kanban stage sections ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STAGES.map(stage => {
            const stageItems = items.filter(i => i.status === stage.id)
            const isOpen = expanded[stage.id]
            return (
              <div key={stage.id} style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: `1px solid ${stage.borderColor}`,
                background: stage.bg,
              }}>
                {/* Section header */}
                <button
                  onClick={() => toggleStage(stage.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ width: 4, height: 32, borderRadius: 99, background: stage.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: stage.color,
                      }}>
                        {stage.label}
                      </span>
                      <span style={{
                        fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: 99,
                        background: `${stage.color}25`,
                        color: stage.color,
                      }}>
                        {stageItems.length}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5, fontFamily: "'Crimson Text', serif" }}>
                      {stage.description}
                    </p>
                  </div>
                  <svg
                    width="16" height="16" viewBox="0 0 16 16" fill="none"
                    style={{ color: stage.color, opacity: 0.55, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Expanded items */}
                {isOpen && (
                  <div style={{ padding: '0 1rem 1rem', borderTop: `1px solid ${stage.borderColor}` }}>
                    {stageItems.length === 0 ? (
                      <div style={{ padding: '1.25rem 0', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: "'Crimson Text', serif", margin: 0 }}>
                          {stage.id === 'submitted' ? 'Be the first — tap "+ Suggest a Feature" above' : 'Nothing here yet'}
                        </p>
                      </div>
                    ) : (
                      stageItems.map(item => (
                        <div key={item.id} style={{
                          borderRadius: 12,
                          padding: '0.875rem',
                          marginTop: '0.625rem',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <p style={{
                              fontFamily: "'Modern Antiqua', serif",
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              color: 'var(--text)',
                              margin: 0,
                              flex: 1,
                              lineHeight: 1.4,
                            }}>
                              {item.title}
                            </p>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                              {formatDate(item.created_at)}
                            </span>
                          </div>

                          {item.description && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 4px', fontFamily: "'Crimson Text', serif" }}>
                              {item.description}
                            </p>
                          )}

                          {item.name && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '4px 0 0', fontFamily: "'Crimson Text', serif" }}>
                              — {item.name}
                            </p>
                          )}

                          {/* Attached images */}
                          {item.image_urls && item.image_urls.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                              {item.image_urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Attachment ${i + 1}`}
                                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                                  />
                                </a>
                              ))}
                            </div>
                          )}

                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
