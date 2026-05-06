'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import RavenIcon from '@/components/RavenIcon'
import Link from 'next/link'

const PAGE_SIZE = 15

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
  beer_id: string
  user_id: string
  profiles: { username: string; display_name: string | null } | null
  post_reactions: { id: string; user_id: string; reaction: string }[]
  post_comments: {
    id: string
    content: string
    created_at: string
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
  onDelete,
}: {
  post: WallPost
  user: { id: string } | null
  onReact: (postId: string, reaction: ReactionKey) => Promise<void>
  onComment: (postId: string, content: string) => Promise<void>
  onDelete: (postId: string) => Promise<void>
}){
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
    await onComment(post.id, commentText.trim())
    setCommentText('')
    setSubmitting(false)
  }

  const ts = new Date(post.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1rem 1.25rem',
    }}>
      {/* Beer tag */}
      {post.beers && (
        <div style={{
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
        }}>
          🍺 {post.beers.name}
          {post.beers.day_number ? ` · Day ${post.beers.day_number}` : ''}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.65rem' }}>
        <span style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.875rem', fontWeight: 700 }}>
          {displayName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {ts}</span>
        {user && post.user_id === user.id && (
          <button
            onClick={() => setConfirmingDelete(true)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 2px', opacity: 0.6,
            }}
            title="Delete post"
          >✕</button>
        )}
      </div>

      {/* Content */}
      <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: 0 }}>
        {post.content}
      </p>

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
            return (
              <div key={c.id} style={{ marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--gold)', fontSize: '0.8rem', fontWeight: 700, fontFamily: "'Modern Antiqua', serif" }}>
                    {cName}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>· {cTs}</span>
                </div>
                <p style={{ color: 'var(--text)', fontSize: '0.875rem', lineHeight: 1.5, marginTop: '0.1rem' }}>
                  {c.content}
                </p>
              </div>
            )
          })}
          {user && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                placeholder="Add a comment..."
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontFamily: "'Modern Antiqua', serif",
                  outline: 'none',
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
                  cursor: commentText.trim() ? 'pointer' : 'default',
                  fontSize: '0.8rem',
                  fontFamily: "'Modern Antiqua', serif",
                  fontWeight: 700,
                }}
              >
                Post
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

export default function WallPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [posts, setPosts] = useState<WallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (!authChecked) return null

  // 🔒 Secret society gate for unauthenticated visitors
  if (!user) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav user={null} />
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
        }}>This is a members only space.</h2>
        <p style={{
          color: 'var(--text-muted)', fontSize: '0.9rem',
          lineHeight: 1.7, marginBottom: '2.5rem',
        }}>
          The Society Wall is reserved for those who&apos;ve earned their place at the table.
          Sign in to join the conversation.
        </p>
        <a href="/auth" style={{
          display: 'inline-block',
          padding: '0.8rem 2.5rem',
          background: 'var(--gold)', color: 'var(--bg)',
          borderRadius: '10px',
          fontFamily: "'Modern Antiqua', serif",
          fontWeight: 700, fontSize: '0.9rem',
          letterSpacing: '0.1em', textDecoration: 'none',
        }}>Enter the Society</a>
        <div style={{ width: '4rem', height: '1px', background: 'rgba(255,140,0,0.3)', margin: '3rem auto 0' }} />
      </main>
    </div>
  )

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

  const fetchPage = useCallback(async (pageIndex: number, replace = false) => {
    if (pageIndex === 0) setLoading(true)
    else setLoadingMore(true)

    const from = pageIndex * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1

    const [{ data, error: fetchError }, { data: profilesData }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, post_reactions(*), post_comments(*), beers(name, brewery, day_number, style, abv)')
        .order('created_at', { ascending: false })
        .range(from, to),
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
  useEffect(() => { fetchPage(0) }, [fetchPage])

  // Intersection observer — fire when sentinel is visible
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(prev => {
          const next = prev + 1
          fetchPage(next)
          return next
        })
      }
    }, { threshold: 0.1 })

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, loading, fetchPage])

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
    // Find if user already has a reaction on this post
    const post = posts.find(p => p.id === postId)
    const existing = post?.post_reactions.find(r => r.user_id === user.id)

    if (existing) {
      if (existing.reaction === reaction) {
        // Same reaction — toggle off
        const { error } = await supabase.from('post_reactions').delete()
          .eq('post_id', postId).eq('user_id', user.id)
        if (error) { alert('Remove error: ' + error.message); return }
      } else {
        // Different reaction — swap it
        const { error } = await supabase.from('post_reactions').update({ reaction })
          .eq('post_id', postId).eq('user_id', user.id)
        if (error) { alert('Update error: ' + error.message); return }
      }
    } else {
      // No reaction yet — insert
      const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, reaction })
      if (error) { alert('React error: ' + error.message); return }
    }
    await reloadPost(postId)
  }

  const handleComment = async (postId: string, content: string) => {
    if (!user) return
    await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content })
    await reloadPost(postId)
  }

  const handleDelete = async (postId: string) => {
    if (!user) return
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id)
    if (error) { alert('Delete error: ' + error.message); return }
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const [wallPostText, setWallPostText] = useState('')
  const [wallPosting, setWallPosting] = useState(false)
  const [wallPhoto, setWallPhoto] = useState<File | null>(null)
  const [wallPhotoPreview, setWallPhotoPreview] = useState<string | null>(null)
  const wallFileRef = useRef<HTMLInputElement>(null)
  const wallCameraRef = useRef<HTMLInputElement>(null)

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

  const todayStr   = new Date().toDateString()
  const todayPosts = posts.filter(p => new Date(p.created_at).toDateString() === todayStr)
  const olderPosts = posts.filter(p => new Date(p.created_at).toDateString() !== todayStr)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav user={user} />

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
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
            <Link href="/beers" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: '0.875rem' }}>
              → Go to today&apos;s beer
            </Link>
          </div>
        ) : (
          <>
            {/* Today's posts */}
            {todayPosts.length > 0 && (
              <section style={{ marginBottom: '2.5rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{
                    fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.6rem',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    whiteSpace: 'nowrap',
                  }}>Today</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {todayPosts.map(p => (
                    <PostCard key={p.id} post={p} user={user} onReact={handleReact} onComment={handleComment} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            )}

            {/* Older posts */}
            {olderPosts.length > 0 && (
              <section>
                {todayPosts.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{
                      fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.6rem',
                      letterSpacing: '0.3em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                    }}>Earlier</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {olderPosts.map(p => (
                    <PostCard key={p.id} post={p} user={user} onReact={handleReact} onComment={handleComment} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Back link */}
        {!loading && (
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link href="/beers" style={{
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
