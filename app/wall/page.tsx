'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import RavenIcon from '@/components/RavenIcon'
import Link from 'next/link'
import TierSelectionModal from '@/components/TierSelectionModal'

const PAGE_SIZE = 15
const COMMENT_MAX_LENGTH = 2000

function getNativeAppMode() {
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

const REACTIONS = [
  { key: 'cheers', emoji: '🍺', label: 'Cheers'   },
  { key: 'dead',   emoji: '💀', label: 'Dead'     },
  { key: 'fire',   emoji: '🔥', label: 'Fire'     },
  { key: 'trophy', emoji: '🏆', label: 'Top Pick' },
  { key: 'rough',  emoji: '🤢', label: 'Rough'    },
] as const

type ReactionKey = typeof REACTIONS[number]['key']

type WallPost = {
  id: string
  content: string
  photo_url: string | null
  created_at: string
  updated_at?: string | null
  beer_id: string
  user_id: string
  profiles: { username: string; display_name: string | null } | null
  post_reactions: { id: string; user_id: string; reaction: string }[]
  post_comments: {
    id: string
    content: string
    created_at: string
    updated_at?: string | null
    user_id: string
    profiles: { username: string; display_name: string | null } | null
  }[]
  beers: { name: string; brewery: string; day_number: number; style: string | null; abv: number | null } | null
}

function PostCard({
  post,
  user,
  onReact,
  onComment,
  onEditComment,
  onDeleteComment,
  onDelete,
  onEdit,
  onBeerClick,
}: {
  post: WallPost
  user: { id: string } | null
  onReact: (postId: string, reaction: ReactionKey) => Promise<void>
  onComment: (postId: string, content: string) => Promise<void>
  onEditComment: (postId: string, commentId: string, content: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onDeleteComment: (postId: string, commentId: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onDelete: (postId: string) => Promise<void>
  onEdit: (postId: string, content: string) => Promise<{ ok: true } | { ok: false; error: string }>
  onBeerClick?: (beerId: string, label: string) => void
}){
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(post.content)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentText, setEditCommentText] = useState('')
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [commentError, setCommentError] = useState('')

  const displayName = post.profiles?.display_name || post.profiles?.username || 'Member'
  const reactions = post.post_reactions || []
  const comments = (post.post_comments || []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  const getCount = (key: string) => reactions.filter(r => r.reaction === key).length
  const hasReacted = (key: string) =>
    user ? reactions.some(r => r.reaction === key && r.user_id === user.id) : false

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    setCommentError('')
    try {
      await onComment(post.id, commentText.trim())
      setCommentText('')
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Unable to post comment.')
    }
    setSubmitting(false)
  }

  const startCommentEdit = (commentId: string, content: string) => {
    setEditingCommentId(commentId)
    setEditCommentText(content)
    setCommentError('')
  }

  const cancelCommentEdit = () => {
    setEditingCommentId(null)
    setEditCommentText('')
    setCommentError('')
  }

  const saveCommentEdit = async (commentId: string) => {
    const nextContent = editCommentText.trim()
    if (!nextContent) {
      setCommentError('Comment content cannot be empty.')
      return
    }
    if (nextContent.length > COMMENT_MAX_LENGTH) {
      setCommentError(`Comment content must be ${COMMENT_MAX_LENGTH} characters or fewer.`)
      return
    }
    if (savingCommentId) return
    setSavingCommentId(commentId)
    setCommentError('')
    const result = await onEditComment(post.id, commentId, nextContent)
    setSavingCommentId(null)
    if (!result.ok) {
      setCommentError(result.error)
      return
    }
    setEditingCommentId(null)
    setEditCommentText('')
  }

  const deleteComment = async (commentId: string) => {
    if (savingCommentId || deletingCommentId) return
    if (!window.confirm('Delete this comment? This cannot be undone.')) return

    setDeletingCommentId(commentId)
    setCommentError('')
    const result = await onDeleteComment(post.id, commentId)
    setDeletingCommentId(null)
    if (!result.ok) {
      setCommentError(result.error)
      return
    }
    if (editingCommentId === commentId) {
      setEditingCommentId(null)
      setEditCommentText('')
    }
  }

  const ts = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const updatedAtMs = post.updated_at ? new Date(post.updated_at).getTime() : 0
  const createdAtMs = new Date(post.created_at).getTime()
  const isEdited = Boolean(updatedAtMs && updatedAtMs - createdAtMs > 1000)

  const startEdit = () => {
    setEditText(post.content)
    setEditError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditText(post.content)
    setEditError('')
    setEditing(false)
  }

  const saveEdit = async () => {
    const nextContent = editText.trim()
    if (!nextContent) {
      setEditError('Post content cannot be empty.')
      return
    }
    if (editSaving) return
    setEditSaving(true)
    setEditError('')
    const result = await onEdit(post.id, nextContent)
    setEditSaving(false)
    if (!result.ok) {
      setEditError(result.error)
      return
    }
    setEditing(false)
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
    }}>
      {/* Beer tag */}
      {post.beers && (
        <button
          onClick={() => onBeerClick?.(post.beer_id, `${post.beers!.name}${post.beers!.day_number ? ` · Day ${post.beers!.day_number}` : ''}`)}
          style={{
            display: 'inline-block',
            background: 'rgba(255,140,0,0.1)',
            border: '1px solid rgba(255,140,0,0.25)',
            borderRadius: '6px',
            padding: '2px 8px',
            marginBottom: '0.6rem',
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.68rem',
            letterSpacing: '0.12em',
            color: 'var(--gold)',
            cursor: onBeerClick ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (onBeerClick) (e.target as HTMLElement).style.background = 'rgba(255,140,0,0.2)' }}
          onMouseLeave={e => { if (onBeerClick) (e.target as HTMLElement).style.background = 'rgba(255,140,0,0.1)' }}
        >
          🍺 {post.beers.name}
          {post.beers.day_number ? ` · Day ${post.beers.day_number}` : ''}
        </button>
      )}

      {/* Header */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.65rem' }}>
        <span style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.875rem', fontWeight: 700 }}>
          {displayName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {ts}{isEdited ? ' · edited' : ''}</span>
        {user && post.user_id === user.id && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <button
              onClick={startEdit}
              disabled={editing}
              style={{
                background: 'none', border: 'none', cursor: editing ? 'default' : 'pointer',
                color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 2px', opacity: editing ? 0.35 : 0.7,
                fontFamily: "'Modern Antiqua', serif",
              }}
              title="Edit post"
            >Edit</button>
            <button
              onClick={() => setConfirmingDelete(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 2px', opacity: 0.6,
              }}
              title="Delete post"
            >✕</button>
          </div>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div>
          <textarea
            value={editText}
            onChange={e => { setEditText(e.target.value); if (editError) setEditError('') }}
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg)',
              border: `1px solid ${editError ? '#e05555' : 'var(--border)'}`,
              color: 'var(--text)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.95rem',
              lineHeight: 1.55,
              resize: 'vertical',
              outline: 'none',
            }}
          />
          {editError && (
            <p style={{ color: '#e05555', fontSize: '0.78rem', marginTop: '0.35rem', marginBottom: 0 }}>
              {editError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.55rem' }}>
            <button
              onClick={cancelEdit}
              disabled={editSaving}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-muted)', padding: '0.35rem 0.8rem', borderRadius: '8px',
                cursor: editSaving ? 'default' : 'pointer', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem',
              }}
            >Cancel</button>
            <button
              onClick={saveEdit}
              disabled={editSaving || !editText.trim()}
              style={{
                background: editText.trim() ? 'var(--gold)' : 'var(--bg)',
                border: 'none', color: editText.trim() ? 'var(--bg)' : 'var(--text-muted)',
                padding: '0.35rem 0.9rem', borderRadius: '8px',
                cursor: editText.trim() && !editSaving ? 'pointer' : 'default',
                fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', fontWeight: 700,
              }}
            >{editSaving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      ) : (
        <p style={{
          color: 'var(--text)',
          fontSize: '0.95rem',
          lineHeight: 1.65,
          marginBottom: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}>
          {post.content}
        </p>
      )}

      {/* Photo */}
      {post.photo_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.photo_url}
            alt="post photo"
            onClick={() => setLightboxOpen(true)}
            style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'cover', marginTop: '0.75rem', cursor: 'zoom-in' }}
          />
          {lightboxOpen && (
            <div
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 2000,
                background: 'rgba(0,0,0,0.92)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'zoom-out',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.photo_url}
                alt="post photo full"
                style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: '8px', objectFit: 'contain' }}
              />
              <button
                onClick={() => setLightboxOpen(false)}
                style={{
                  position: 'fixed', top: '1rem', right: '1rem',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', borderRadius: '50%', width: '36px', height: '36px',
                  cursor: 'pointer', fontSize: '1rem',
                }}
              >✕</button>
            </div>
          )}
        </>
      )}

      {/* Reactions */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {REACTIONS.map(r => {
          const count = getCount(r.key)
          const active = hasReacted(r.key)
          return (
            <button
              key={r.key}
              onClick={() => user && onReact(post.id, r.key)}
              title={r.label}
              style={{
                background: active ? 'var(--gold-dim)' : 'transparent',
                border: `1px solid ${active ? 'rgba(217,124,43,0.4)' : 'var(--border)'}`,
                borderRadius: '999px',
                padding: '0.2rem 0.6rem',
                cursor: user ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                fontSize: '0.8rem',
                color: active ? 'var(--gold)' : 'var(--text-muted)',
                fontFamily: "'Modern Antiqua', serif",
                transition: 'all 0.15s',
              }}
            >
              <span style={{ filter: active ? 'sepia(0.6) saturate(1.8) brightness(0.95)' : 'grayscale(0.85) brightness(0.75) opacity(0.7)' }}>{r.emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          )
        })}
        <button
          onClick={() => setShowComments(v => !v)}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            padding: '0.2rem 0.6rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontFamily: "'Modern Antiqua', serif",
            marginLeft: 'auto',
          }}
        >
          💬 {comments.length > 0 ? comments.length : 'Comment'}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          {comments.map(c => {
            const cName = c.profiles?.display_name || c.profiles?.username || 'Member'
            const cTs = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const cUpdatedAtMs = c.updated_at ? new Date(c.updated_at).getTime() : 0
            const cCreatedAtMs = new Date(c.created_at).getTime()
            const cEdited = Boolean(cUpdatedAtMs && cUpdatedAtMs - cCreatedAtMs > 1000)
            const ownComment = Boolean(user && c.user_id === user.id)
            const editingComment = editingCommentId === c.id
            return (
              <div key={c.id} style={{ marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, fontFamily: "'Modern Antiqua', serif" }}>
                    {cName}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>· {cTs}{cEdited ? ' · edited' : ''}</span>
                  {ownComment && !editingComment && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <button
                        onClick={() => startCommentEdit(c.id, c.content)}
                        disabled={deletingCommentId === c.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: deletingCommentId === c.id ? 'default' : 'pointer',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.72rem',
                          padding: '0 2px',
                          opacity: deletingCommentId === c.id ? 0.35 : 0.7,
                        }}
                        title="Edit comment"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteComment(c.id)}
                        disabled={deletingCommentId === c.id}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: deletingCommentId === c.id ? 'default' : 'pointer',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.72rem',
                          padding: '0 2px',
                          opacity: deletingCommentId === c.id ? 0.35 : 0.6,
                        }}
                        title="Delete comment"
                      >
                        {deletingCommentId === c.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
                {editingComment ? (
                  <div style={{ marginTop: '0.35rem' }}>
                    <textarea
                      value={editCommentText}
                      onChange={e => { setEditCommentText(e.target.value); if (commentError) setCommentError('') }}
                      maxLength={COMMENT_MAX_LENGTH}
                      rows={3}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'var(--bg)',
                        border: `1px solid ${commentError ? '#e05555' : 'var(--border)'}`,
                        color: 'var(--text)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.65rem',
                        fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.875rem',
                        lineHeight: 1.5,
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                      <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                        {editCommentText.length}/{COMMENT_MAX_LENGTH}
                      </span>
                      <button
                        onClick={cancelCommentEdit}
                        disabled={savingCommentId === c.id}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '8px',
                          cursor: savingCommentId === c.id ? 'default' : 'pointer',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.75rem',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveCommentEdit(c.id)}
                        disabled={savingCommentId === c.id || !editCommentText.trim()}
                        style={{
                          background: editCommentText.trim() ? 'var(--gold)' : 'var(--bg)',
                          border: 'none',
                          color: editCommentText.trim() ? 'var(--bg)' : 'var(--text-muted)',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '8px',
                          cursor: editCommentText.trim() && savingCommentId !== c.id ? 'pointer' : 'default',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {savingCommentId === c.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{
                    color: 'var(--text)',
                    fontSize: '0.875rem',
                    lineHeight: 1.5,
                    marginTop: '0.1rem',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}>
                    {c.content}
                  </p>
                )}
              </div>
            )
          })}
          {commentError && (
            <p style={{ color: '#e05555', fontSize: '0.75rem', marginTop: '0.25rem', marginBottom: 0 }}>
              {commentError}
            </p>
          )}
          {user && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <textarea
                value={commentText}
                onChange={e => { setCommentText(e.target.value); if (commentError) setCommentError('') }}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submitComment()
                }}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder="Add a comment..."
                rows={2}
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: "'Modern Antiqua', serif",
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <button
                onClick={submitComment}
                disabled={submitting || !commentText.trim()}
                style={{
                  background: commentText.trim() ? 'var(--gold)' : 'var(--bg)',
                  border: 'none',
                  color: commentText.trim() ? 'var(--bg)' : 'var(--text-muted)',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '8px',
                  cursor: commentText.trim() && !submitting ? 'pointer' : 'default',
                  fontSize: '0.8rem',
                  fontFamily: "'Modern Antiqua', serif",
                  fontWeight: 700,
                }}
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmingDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '2rem 1.75rem',
            maxWidth: '320px',
            width: '90%',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.65rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
              marginBottom: '0.75rem',
            }}>Delete Post</p>
            <p style={{
              color: 'var(--text)',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}>Are you sure? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px',
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', letterSpacing: '0.1em',
                }}
              >Cancel</button>
              <button
                onClick={() => { setConfirmingDelete(false); onDelete(post.id) }}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px',
                  background: 'rgba(180,40,40,0.15)', border: '1px solid rgba(180,40,40,0.4)',
                  color: '#e05555', cursor: 'pointer',
                  fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', letterSpacing: '0.1em',
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Pure helper — lives outside the component so hooks aren't affected
const mergeProfiles = (
  postsData: WallPost[],
  profileMap: Record<string, { username: string; display_name: string | null }>
): WallPost[] =>
  postsData.map(post => ({
    ...post,
    profiles: profileMap[post.user_id] || { username: 'Member', display_name: null },
    post_comments: (post.post_comments || []).map(c => ({
      ...c,
      profiles: profileMap[c.user_id] || { username: 'Member', display_name: null },
    })),
  }))

export default function WallPage() {
  const [nativeAppMode] = useState(getNativeAppMode)
  // ── ALL hooks must come before any conditional return ──
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [wallPostText, setWallPostText] = useState('')
  const [wallPosting, setWallPosting] = useState(false)
  const [wallPhoto, setWallPhoto] = useState<File | null>(null)
  const [wallPhotoPreview, setWallPhotoPreview] = useState<string | null>(null)
  const wallFileRef = useRef<HTMLInputElement>(null)
  const wallCameraRef = useRef<HTMLInputElement>(null)
  const [filterBeerId, setFilterBeerId] = useState<string | null>(null)
  const [filterBeerLabel, setFilterBeerLabel] = useState<string>('')
  const [showTierModal, setShowTierModal] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user)
      setAuthChecked(true)

      if (user) {
        // Check if tier selection is open and this member hasn't picked yet
        const [{ data: settings }, { data: profile }] = await Promise.all([
          supabase.from('app_settings').select('tier_selection_open').eq('id', 1).single(),
          supabase.from('profiles').select('tier').eq('id', user.id).single(),
        ])
        if (settings?.tier_selection_open && !profile?.tier) {
          setShowTierModal(true)
        }
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const fetchPage = useCallback(async (pageIndex: number, replace = false, beerId?: string | null) => {
    if (pageIndex === 0) setLoading(true)
    else setLoadingMore(true)

    const from = pageIndex * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    let query = supabase
      .from('posts')
      .select('*, post_reactions(*), post_comments(*), beers(name, brewery, day_number, style, abv)')
      .order('created_at', { ascending: false })
      .range(from, to)

    if (beerId) query = query.eq('beer_id', beerId)

    const [{ data, error: fetchError }, { data: profilesData }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, username, display_name'),
    ])

    if (fetchError) console.error('Wall fetch error:', fetchError)

    const profileMap: Record<string, { username: string; display_name: string | null }> = {}
    for (const p of profilesData || []) profileMap[p.id] = p

    const incoming = mergeProfiles((data as WallPost[]) || [], profileMap)
    if (replace) {
      setPosts(incoming)
    } else {
      setPosts(prev => [...prev, ...incoming])
    }
    setHasMore(incoming.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [])

  // Initial load
  useEffect(() => {
    void Promise.resolve().then(() => fetchPage(0))
  }, [fetchPage])

  // Intersection observer — fire when sentinel is visible
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        const next = pageRef.current + 1
        pageRef.current = next
        fetchPage(next, false, filterBeerId)
      }
    }, { threshold: 0.1 })

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, loading, fetchPage, filterBeerId])

  // ── Conditional returns AFTER all hooks ──
  if (!authChecked) return null

  // 🔒 Secret society gate for unauthenticated visitors
  if (!user) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!nativeAppMode && <Nav user={null} />}
      <main style={{ maxWidth: '500px', margin: '0 auto', padding: '6rem 2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '1.5rem' }}><RavenIcon size={150} /></div>
        <p style={{
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.6rem', letterSpacing: '0.5em',
          textTransform: 'uppercase', color: 'var(--gold)',
          marginBottom: '1.5rem',
        }}>Members Only</p>
        <h2 style={{
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '1.6rem', color: 'var(--text)',
          marginBottom: '1rem', lineHeight: 1.3,
        }}>This space belongs to the Society.</h2>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.9rem',
          lineHeight: 1.7, marginBottom: '2.5rem',
        }}>
          What&apos;s shared here stays among members. You&apos;ll need to be one to enter.
        </p>
        {!nativeAppMode && <a href="/auth" style={{
          display: 'inline-block',
          padding: '0.8rem 2.5rem',
          background: 'var(--gold)', color: 'var(--bg)',
          borderRadius: '10px',
          fontFamily: "'Modern Antiqua', serif",
          fontWeight: 700, fontSize: '0.9rem',
          letterSpacing: '0.1em', textDecoration: 'none',
        }}>Enter the Society</a>}
        <div style={{ width: '4rem', height: '1px', background: 'rgba(255,140,0,0.3)', margin: '3rem auto 0' }} />
      </main>
    </div>
  )

  const reloadPost = async (postId: string) => {
    const [{ data }, { data: profilesData }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, post_reactions(*), post_comments(*), beers(name, brewery, day_number, style, abv)')
        .eq('id', postId)
        .maybeSingle(),
      supabase.from('profiles').select('id, username, display_name'),
    ])
    if (data) {
      const profileMap: Record<string, { username: string; display_name: string | null }> = {}
      for (const p of profilesData || []) profileMap[p.id] = p
      const merged = mergeProfiles([data as WallPost], profileMap)[0]
      setPosts(prev => prev.map(p => p.id === postId ? merged : p))
    }
  }

  const handleReact = async (postId: string, reaction: ReactionKey) => {
    if (!user) return
    const res = await fetch('/api/wall/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, user_id: user.id, reaction }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      console.error('[wall] react error:', err?.error ?? res.status)
    }
    await reloadPost(postId)
  }

  const handleComment = async (postId: string, content: string) => {
    if (!user) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/wall/comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ post_id: postId, content }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      console.error('[wall] comment error:', err?.error ?? res.status)
      throw new Error(err.error ?? 'Unable to post comment.')
    }
    await reloadPost(postId)
  }

  const handleEditComment = async (postId: string, commentId: string, content: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!user) return { ok: false, error: 'You must be signed in to edit comments.' }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/wall/comment', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ comment_id: commentId, content }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      return { ok: false, error: err.error ?? 'Unable to save comment.' }
    }
    await reloadPost(postId)
    return { ok: true }
  }

  const handleDeleteComment = async (postId: string, commentId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!user) return { ok: false, error: 'You must be signed in to delete comments.' }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/wall/comment', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ comment_id: commentId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      return { ok: false, error: err.error ?? 'Unable to delete comment.' }
    }
    await reloadPost(postId)
    return { ok: true }
  }

  const handleEdit = async (postId: string, content: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!user) return { ok: false, error: 'You must be signed in to edit posts.' }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/wall/post', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ post_id: postId, content }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      return { ok: false, error: err.error ?? 'Unable to save edit.' }
    }
    await reloadPost(postId)
    return { ok: true }
  }

  const handleDelete = async (postId: string) => {
    if (!user) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id)
    if (error) { alert('Delete error: ' + error.message); return }
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const handleBeerFilter = (beerId: string, label: string) => {
    setFilterBeerId(beerId)
    setFilterBeerLabel(label)
    pageRef.current = 0
    setPosts([])
    setHasMore(true)
    fetchPage(0, true, beerId)
  }

  const clearBeerFilter = () => {
    setFilterBeerId(null)
    setFilterBeerLabel('')
    pageRef.current = 0
    setPosts([])
    setHasMore(true)
    fetchPage(0, true, null)
  }

  const handleWallPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setWallPhoto(file)
    setWallPhotoPreview(URL.createObjectURL(file))
  }

  const clearWallPhoto = () => {
    setWallPhoto(null)
    setWallPhotoPreview(null)
    if (wallFileRef.current) wallFileRef.current.value = ''
    if (wallCameraRef.current) wallCameraRef.current.value = ''
  }

  const handleWallPost = async () => {
    if (!user || (!wallPostText.trim() && !wallPhoto) || wallPosting) return
    setWallPosting(true)
    let photoUrl: string | null = null
    if (wallPhoto) {
      const ext = wallPhoto.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('post-photos').upload(path, wallPhoto)
      if (error) { alert('Photo upload error: ' + error.message); setWallPosting(false); return }
      const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }
    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: user.id, content: wallPostText.trim(), beer_id: null, photo_url: photoUrl })
      .select('*, post_reactions(*), post_comments(*), beers(name, brewery, day_number, style, abv)')
      .maybeSingle()
    if (error) { alert('Post error: ' + error.message); setWallPosting(false); return }
    if (data) {
      const { data: profilesData } = await supabase.from('profiles').select('id, username, display_name')
      const profileMap: Record<string, { username: string; display_name: string | null }> = {}
      for (const p of profilesData || []) profileMap[p.id] = p
      const merged = mergeProfiles([data as WallPost], profileMap)[0]
      setPosts(prev => [merged, ...prev])
    }
    setWallPostText('')
    clearWallPhoto()
    setWallPosting(false)
  }


  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!nativeAppMode && <Nav user={user} />}

      {/* Tier selection modal — only shows when admin has opened tier selection and member hasn't picked */}
      {showTierModal && user && (
        <TierSelectionModal
          userId={user.id}
          onComplete={() => setShowTierModal(false)}
        />
      )}

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '1.25rem 1.5rem 5.5rem' }}>

        {/* Quick post box */}
        {user && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
          }}>
            <textarea
              value={wallPostText}
              onChange={e => setWallPostText(e.target.value)}
              placeholder="Share your thoughts with the Society..."
              rows={3}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--text)',
                fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.9rem',
                lineHeight: 1.6,
                boxSizing: 'border-box',
              }}
            />
            {wallPhotoPreview && (
              <div style={{ position: 'relative', marginTop: '0.5rem', display: 'inline-block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={wallPhotoPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
                <button onClick={clearWallPhoto} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
              </div>
            )}
            <input ref={wallFileRef}   type="file" accept="image/*"                    onChange={handleWallPhotoSelect} style={{ display: 'none' }} />
            <input ref={wallCameraRef} type="file" accept="image/*" capture="environment" onChange={handleWallPhotoSelect} style={{ display: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => wallFileRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📎 Photo</button>
                <button onClick={() => wallCameraRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📷 Camera</button>
              </div>
              <button
                onClick={handleWallPost}
                disabled={wallPosting || (!wallPostText.trim() && !wallPhoto)}
                style={{
                  background: (wallPostText.trim() || wallPhoto) ? 'var(--gold)' : 'transparent',
                  border: (wallPostText.trim() || wallPhoto) ? 'none' : '1px solid var(--border)',
                  color: (wallPostText.trim() || wallPhoto) ? 'var(--bg)' : 'var(--text-muted)',
                  padding: '0.45rem 1.25rem',
                  borderRadius: '8px',
                  cursor: (wallPostText.trim() || wallPhoto) ? 'pointer' : 'default',
                  fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >{wallPosting ? 'Posting...' : 'Post'}</button>
            </div>
          </div>
        )}

        {/* The Society Wall divider — sits between compose box and feed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,140,0,0.35))' }} />
          <span style={{
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.6rem',
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            color: 'var(--gold)',
            whiteSpace: 'nowrap',
          }}>
            The Society Wall
          </span>
          <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(255,140,0,0.35))' }} />
        </div>

        {/* Active beer filter banner */}
        {filterBeerId && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,140,0,0.08)',
            border: '1px solid rgba(255,140,0,0.3)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
          }}>
            <span style={{ fontFamily: "'Modern Antiqua', serif", fontSize: '0.78rem', color: 'var(--gold)', letterSpacing: '0.05em' }}>
              🍺 {filterBeerLabel}
            </span>
            <button
              onClick={clearBeerFilter}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 4px' }}
            >
              ✕ all posts
            </button>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", textAlign: 'center', padding: '4rem 0', animation: 'pulse 1s infinite' }}>
            Consulting the archives...
          </p>
        ) : posts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontFamily: "'Modern Antiqua', serif",
            padding: '4rem 0',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍺</div>
            <p>The wall is empty. Be the first to post.</p>
            <Link href="/today" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.875rem' }}>
              → Go to today&apos;s beer
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {posts.map(p => (
              <PostCard key={p.id} post={p} user={user} onReact={handleReact} onComment={handleComment} onEditComment={handleEditComment} onDeleteComment={handleDeleteComment} onDelete={handleDelete} onEdit={handleEdit} onBeerClick={handleBeerFilter} />
            ))}
          </div>
        )}

        {/* Back link */}
        {!loading && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link href="/today" style={{
              color: 'var(--text-muted)',
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.8rem',
              textDecoration: 'none',
              letterSpacing: '0.15em',
            }}>
              ← Back to Today&apos;s Beer
            </Link>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: '1px', marginTop: '1rem' }} />

        {/* Loading more indicator */}
        {loadingMore && (
          <p style={{
            color: 'var(--gold)',
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.8rem',
            textAlign: 'center',
            padding: '1.5rem 0',
            letterSpacing: '0.15em',
          }}>
            Loading more...
          </p>
        )}

        {/* End of wall */}
        {!hasMore && posts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '2.5rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{
              fontFamily: "'Modern Antiqua', serif",
              fontSize: '0.6rem',
              letterSpacing: '0.3em',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}>End of the Wall</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
        )}
      </main>
    </div>
  )
}
