'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer, Rating, Post, PostReaction, PostComment } from '@/lib/types'
import Nav from '@/components/Nav'
import StarRating from '@/components/StarRating'

// ── Reaction config ───────────────────────────────────────────────────────────

const REACTIONS = [
  { key: 'cheers', emoji: '🍺', label: 'Cheers'   },
  { key: 'dead',   emoji: '💀', label: 'Dead'     },
  { key: 'fire',   emoji: '🔥', label: 'Fire'     },
  { key: 'trophy', emoji: '🏆', label: 'Top Pick' },
  { key: 'rough',  emoji: '🤢', label: 'Rough'    },
] as const

type ReactionKey = typeof REACTIONS[number]['key']

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({
  post,
  user,
  onReact,
  onComment,
}: {
  post: Post
  user: { id: string } | null
  onReact: (postId: string, reaction: ReactionKey) => Promise<void>
  onComment: (postId: string, content: string) => Promise<void>
}) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const displayName =
    post.profiles?.display_name || post.profiles?.username || 'Member'
  const reactions: PostReaction[] = post.post_reactions || []
  const comments: PostComment[] = (post.post_comments || []).sort(
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
      {/* Header */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.65rem' }}>
        <span style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.875rem', fontWeight: 700 }}>
          {displayName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {ts}</span>
      </div>

      {/* Content */}
      <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: 0 }}>
        {post.content}
      </p>

      {/* Photo */}
      {post.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.photo_url}
          alt="post photo"
          style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'cover', marginTop: '0.75rem' }}
        />
      )}

      {/* Reactions + comment toggle */}
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
              <span>{r.emoji}</span>
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
            const cp = c.profiles
            const cName = cp?.display_name || cp?.username || 'Member'
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
    </div>
  )
}

// ── PREVIEW MODE ─────────────────────────────────────────────────────────────
// TODO: Remove PREVIEW_MODE and PREVIEW_BEER before October launch
const PREVIEW_MODE = true

const PREVIEW_BEER = {
  id: 'preview-space-dust',
  day_number: 19,
  name: 'Space Dust IPA',
  brewery: 'Elysian Brewing',
  style: 'IPA',
  abv: 8.2,
  description: 'A hazy, hop-forward IPA from Seattle\'s Elysian Brewing.',
  image_url: null,
  ai_notes: "Pours a radiant deep amber with a pillowy off-white head. The nose launches you straight into the cosmos — a tropical supernova of mango, tangerine, and fresh-cut pine resin. On the palate, a wave of citrus peel crashes first, followed by a smooth, almost creamy malt backbone that keeps the bitterness from spiraling out of orbit. The finish is long, resinous, and lightly warming at 8.2% ABV. A beer that earns its name: bold enough to feel interstellar, balanced enough to keep you grounded. Drink it fresh, drink it cold, drink it like you've earned it.",
  created_at: new Date().toISOString(),
} as Beer

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BeersPage() {
  const today    = new Date()
  // In PREVIEW_MODE, treat today as an active beer day regardless of month
  const isOctober = today.getMonth() === 9 || PREVIEW_MODE
  const year      = today.getFullYear()
  const todayDay  = today.getDate()
  const oct1DOW   = new Date(year, 9, 1).getDay()

  const [user,         setUser]         = useState<{ id: string; email?: string } | null>(null)
  const [beers,        setBeers]        = useState<Beer[]>([])
  const [todayBeer,    setTodayBeer]    = useState<Beer | null>(null)
  const [userRating,   setUserRating]   = useState<Rating | null>(null)
  const [avgRating,    setAvgRating]    = useState<number | null>(null)
  const [ratingCount,  setRatingCount]  = useState(0)
  const [posts,        setPosts]        = useState<Post[]>([])
  const [postContent,  setPostContent]  = useState('')
  const [postPhoto,    setPostPhoto]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [loading,      setLoading]      = useState(true)

  // Past beer modal
  const [selectedDay,  setSelectedDay]  = useState<number | null>(null)
  const [modalBeer,    setModalBeer]    = useState<Beer | null>(null)
  const [modalRating,  setModalRating]  = useState<Rating | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  // ── Load beers ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('beers').select('*').order('day_number').then(({ data }) => {
      const list = data || []
      setBeers(list)
      const found = list.find(b => b.day_number === todayDay)
      // In PREVIEW_MODE, fall back to hardcoded Space Dust if no DB beer for today
      setTodayBeer(found ?? (PREVIEW_MODE ? PREVIEW_BEER : null))
      setLoading(false)
    })
  }, [todayDay])

  // ── Load ratings + posts for today's beer ───────────────────────────────────
  useEffect(() => {
    if (!todayBeer) return
    // Skip DB calls for preview-only beer (no real UUID in DB)
    if (todayBeer.id === 'preview-space-dust') return
    supabase.from('ratings').select('stars').eq('beer_id', todayBeer.id).then(({ data }) => {
      if (data && data.length > 0) {
        const avg = data.reduce((s, r) => s + r.stars, 0) / data.length
        setAvgRating(Math.round(avg * 10) / 10)
        setRatingCount(data.length)
      }
    })
    loadPosts(todayBeer.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayBeer])

  // ── User's own rating for today ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || !todayBeer || todayBeer.id === 'preview-space-dust') return
    supabase.from('ratings').select('*')
      .eq('user_id', user.id).eq('beer_id', todayBeer.id)
      .maybeSingle()
      .then(({ data }) => setUserRating(data))
  }, [user, todayBeer])

  // ── Load wall posts ─────────────────────────────────────────────────────────
  const loadPosts = async (beerId: string) => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username, display_name), post_reactions(*), post_comments(*, profiles(username, display_name))')
      .eq('beer_id', beerId)
      .order('created_at', { ascending: false })
    setPosts(data || [])
  }

  // ── Rate today's beer ───────────────────────────────────────────────────────
  const handleRate = async (stars: number) => {
    if (!user || !todayBeer || userRating || todayBeer.id === 'preview-space-dust') return
    const { data } = await supabase
      .from('ratings')
      .insert({ user_id: user.id, beer_id: todayBeer.id, stars })
      .select().maybeSingle()
    setUserRating(data)
    const { data: ratings } = await supabase.from('ratings').select('stars').eq('beer_id', todayBeer.id)
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
      setAvgRating(Math.round(avg * 10) / 10)
      setRatingCount(ratings.length)
    }
  }

  // ── Photo select ────────────────────────────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPostPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    setPostPhoto(null)
    setPhotoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Submit post ─────────────────────────────────────────────────────────────
  const handleSubmitPost = async () => {
    if (!user || !todayBeer || !postContent.trim() || submitting || todayBeer.id === 'preview-space-dust') return
    setSubmitting(true)
    let photoUrl: string | null = null
    if (postPhoto) {
      const ext = postPhoto.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('post-photos').upload(path, postPhoto)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }
    await supabase.from('posts').insert({
      user_id: user.id,
      beer_id: todayBeer.id,
      content: postContent.trim(),
      photo_url: photoUrl,
    })
    setPostContent('')
    clearPhoto()
    await loadPosts(todayBeer.id)
    setSubmitting(false)
  }

  // ── Reactions ───────────────────────────────────────────────────────────────
  const handleReact = async (postId: string, reaction: ReactionKey) => {
    if (!user || !todayBeer) return
    const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: user.id, reaction })
    if (error?.code === '23505') {
      await supabase.from('post_reactions').delete()
        .eq('post_id', postId).eq('user_id', user.id).eq('reaction', reaction)
    }
    await loadPosts(todayBeer.id)
  }

  // ── Past beer modal ─────────────────────────────────────────────────────────
  const openModal = async (day: number) => {
    if (!todayDay || day >= todayDay) return
    const beer = beers.find(b => b.day_number === day)
    setSelectedDay(day)
    setModalBeer(beer || null)
    setModalRating(null)
    if (user && beer) {
      const { data } = await supabase.from('ratings').select('*')
        .eq('user_id', user.id).eq('beer_id', beer.id).maybeSingle()
      setModalRating(data)
    }
  }

  const closeModal = () => { setSelectedDay(null); setModalBeer(null); setModalRating(null) }

  const handleModalRate = async (stars: number) => {
    if (!user || !modalBeer || modalRating) return
    const { data } = await supabase.from('ratings')
      .insert({ user_id: user.id, beer_id: modalBeer.id, stars })
      .select().maybeSingle()
    setModalRating(data)
  }

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const beerMap = Object.fromEntries(beers.map(b => [b.day_number, b]))
  const slots = Array.from({ length: 31 }, (_, i) => i + 1)
  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const calendarCells: (number | null)[] = [...Array(oct1DOW).fill(null), ...slots]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <Nav user={user} />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        {loading ? (
          <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", textAlign: 'center', padding: '4rem 0' }}>
            Loading the sacred list...
          </p>
        ) : (
          <>

            {/* ══════════════════════════════════════════════════════════════
                BEER OF THE DAY
            ══════════════════════════════════════════════════════════════ */}
            {isOctober && todayBeer ? (
              <section style={{ marginBottom: '3.5rem' }}>

                {/* Day badge */}
                <div style={{
                  color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.65rem', letterSpacing: '0.35em', marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                }}>
                  {today.getMonth() === 9
                    ? `Day ${todayBeer.day_number} · October ${todayBeer.day_number}, ${year}`
                    : today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                  }
                  {todayBeer.id === 'preview-space-dust' && (
                    <span style={{
                      marginLeft: '0.75rem',
                      background: 'rgba(255,140,0,0.15)',
                      color: 'var(--gold)',
                      border: '1px solid rgba(255,140,0,0.3)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '0.55rem',
                      letterSpacing: '0.2em',
                      verticalAlign: 'middle',
                    }}>PREVIEW</span>
                  )}
                </div>

                {/* Beer name */}
                <h1 style={{
                  fontFamily: "'Modern Antiqua', serif",
                  color: 'var(--text)',
                  fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                  lineHeight: 1.1,
                  marginBottom: '1.5rem',
                }}>
                  {todayBeer.name}
                </h1>

                {/* ── BREWERY INFO ──────────────────────────────────────── */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{
                    color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.58rem', letterSpacing: '0.28em',
                    textTransform: 'uppercase', marginBottom: '0.75rem',
                  }}>
                    The Brewery
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <span style={{
                      color: 'var(--text)',
                      fontFamily: "'Modern Antiqua', serif",
                      fontSize: '1.15rem',
                      fontWeight: 600,
                    }}>
                      {todayBeer.brewery}
                    </span>
                    {(todayBeer.style || todayBeer.abv) && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {todayBeer.style}{todayBeer.style && todayBeer.abv ? ' · ' : ''}{todayBeer.abv ? `${todayBeer.abv}% ABV` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── RATING ────────────────────────────────────────────── */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  flexWrap: 'wrap',
                }}>
                  {/* Community avg */}
                  <div>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.58rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.4rem',
                    }}>Society Rating</div>
                    {avgRating !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--gold)', fontSize: '1.2rem' }}>
                          {'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {avgRating} / 5 · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No ratings yet</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ width: '1px', height: '2rem', background: 'var(--border)', flexShrink: 0 }} />

                  {/* Your rating */}
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.58rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.4rem',
                    }}>
                      {userRating ? 'Your Rating' : 'Rate This Beer'}
                    </div>
                    {todayBeer.id === 'preview-space-dust' ? (
                      <StarRating onSubmit={async () => {}} />
                    ) : userRating ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--gold)', fontSize: '1.4rem', letterSpacing: '0.08em' }}>
                          {'★'.repeat(userRating.stars)}{'☆'.repeat(5 - userRating.stars)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{userRating.stars} / 5</span>
                      </div>
                    ) : user ? (
                      <StarRating onSubmit={async (stars) => { await handleRate(stars) }} />
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        <a href="/auth" style={{ color: 'var(--gold)' }}>Sign in</a> to rate
                      </p>
                    )}
                  </div>
                </div>

                {/* ── TASTING NOTES ─────────────────────────────────────── */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '2rem',
                }}>
                  <div style={{
                    color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.58rem', letterSpacing: '0.28em',
                    textTransform: 'uppercase', marginBottom: '0.75rem',
                  }}>
                    Tasting Notes
                  </div>
                  <p style={{ color: 'var(--text)', fontSize: '0.95rem', lineHeight: 1.85, fontStyle: 'italic', margin: 0 }}>
                    {todayBeer.ai_notes ||
                      "Tasting notes coming soon — the society's chronicler is still studying the brew..."}
                  </p>
                </div>

                {/* Post box */}
                {user && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                  }}>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.62rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.65rem',
                    }}>
                      Share Your Take
                    </div>
                    <textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder="What do you think of today's brew?"
                      rows={3}
                      style={{
                        width: '100%',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        resize: 'vertical',
                        marginBottom: '0.75rem',
                        fontFamily: "'Modern Antiqua', serif",
                      }}
                    />

                    {photoPreview && (
                      <div style={{ marginBottom: '0.75rem', position: 'relative', display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoPreview}
                          alt="preview"
                          style={{ maxWidth: '200px', maxHeight: '160px', borderRadius: '8px', border: '1px solid var(--border)', objectFit: 'cover' }}
                        />
                        <button
                          onClick={clearPhoto}
                          style={{
                            position: 'absolute', top: '4px', right: '4px',
                            background: 'rgba(0,0,0,0.7)', color: 'white',
                            border: 'none', borderRadius: '50%',
                            width: '20px', height: '20px',
                            cursor: 'pointer', fontSize: '11px',
                            lineHeight: '20px', textAlign: 'center', padding: 0,
                          }}
                        >✕</button>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        onClick={() => fileRef.current?.click()}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          padding: '0.45rem 1rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontFamily: "'Modern Antiqua', serif",
                        }}
                      >
                        📷 Photo
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />

                      <button
                        onClick={handleSubmitPost}
                        disabled={submitting || !postContent.trim()}
                        style={{
                          background: postContent.trim() ? 'var(--gold)' : 'var(--bg-card)',
                          color: postContent.trim() ? 'var(--bg)' : 'var(--text-muted)',
                          border: 'none',
                          padding: '0.45rem 1.5rem',
                          borderRadius: '8px',
                          cursor: postContent.trim() ? 'pointer' : 'default',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          marginLeft: 'auto',
                        }}
                      >
                        {submitting ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

            ) : isOctober && !todayBeer ? (
              <section style={{ textAlign: 'center', padding: '3rem 0', marginBottom: '3rem' }}>
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Today&apos;s beer hasn&apos;t been added yet. Check back soon.
                </p>
              </section>
            ) : (
              <section style={{ textAlign: 'center', padding: '3rem 0', marginBottom: '3rem' }}>
                <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--gold)', fontSize: '1.5rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                  The Ritual Awaits
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>The sacred calendar awakens on October 1st.</p>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                THE WALL
            ══════════════════════════════════════════════════════════════ */}
            {isOctober && posts.length > 0 && (
              <section style={{ marginBottom: '4rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                <div style={{
                  color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.65rem', letterSpacing: '0.3em',
                  textTransform: 'uppercase', marginBottom: '1.25rem',
                }}>
                  The Wall
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      user={user}
                      onReact={handleReact}
                      onComment={async (postId, content) => {
                        if (!user) return
                        await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, content })
                        if (todayBeer) await loadPosts(todayBeer.id)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                OCTOBER CALENDAR
            ══════════════════════════════════════════════════════════════ */}
            <section style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>

              {/* Month header */}
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                  fontFamily: "'Modern Antiqua', serif",
                  color: 'var(--gold)',
                  fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem',
                }}>
                  October {year}
                </div>
                <div style={{ width: '6rem', height: '2px', background: 'var(--gold)', margin: '0 auto', opacity: 0.6 }} />
              </div>

              {/* ── Desktop calendar ── */}
              <div className="hhs-calendar-view">
                {/* Day-of-week headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
                  {DAY_HEADERS.map(d => (
                    <div key={d} style={{
                      textAlign: 'center', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.7rem', letterSpacing: '0.2em',
                      color: 'var(--gold)', textTransform: 'uppercase', padding: '0.4rem 0',
                    }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {calendarCells.map((day, idx) => {
                    if (!day) return <div key={`e-${idx}`} style={{ minHeight: '100px' }} />
                    const beer       = beerMap[day]
                    const isToday    = day === todayDay
                    const isPast     = todayDay ? day < todayDay : false
                    const clickable  = isPast

                    return (
                      <div
                        key={day}
                        className="hhs-cal-cell"
                        onClick={() => clickable && openModal(day)}
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius: '10px',
                          padding: '0.6rem',
                          minHeight: '100px',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: isToday ? '0 0 0 1px var(--gold)' : 'none',
                          opacity: isPast && !isToday ? 0.6 : 1,
                          cursor: clickable ? 'pointer' : 'default',
                        }}
                      >
                        {/* Day number */}
                        <div style={{
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.85rem', fontWeight: 700,
                          color: isToday ? 'var(--gold)' : 'var(--text)',
                          marginBottom: '0.35rem',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <span>{day}</span>
                          {isToday && (
                            <span style={{
                              background: 'var(--gold)', color: 'var(--bg)',
                              fontSize: '0.55rem', fontWeight: 700,
                              letterSpacing: '0.1em',
                              padding: '0.1rem 0.4rem', borderRadius: '999px',
                            }}>TODAY</span>
                          )}
                        </div>

                        {beer ? (
                          <>
                            <div style={{
                              color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600,
                              fontFamily: "'Modern Antiqua', serif", lineHeight: 1.3,
                              marginBottom: '0.2rem',
                              overflow: 'hidden', display: '-webkit-box',
                              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            }}>
                              {beer.name}
                            </div>
                            <div style={{
                              color: 'var(--gold)', fontSize: '0.72rem',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {beer.brewery}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic', marginTop: 'auto' }}>
                            To be revealed...
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Mobile list ── */}
              <div className="hhs-list-view">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {slots.map(day => {
                    const beer    = beerMap[day]
                    const isToday = day === todayDay
                    const isPast  = todayDay ? day < todayDay : false
                    return (
                      <div
                        key={day}
                        onClick={() => isPast && openModal(day)}
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius: '12px',
                          padding: '1rem 1.25rem',
                          display: 'flex', alignItems: 'center', gap: '1rem',
                          boxShadow: isToday ? '0 0 0 1px var(--gold)' : 'none',
                          opacity: isPast && !isToday ? 0.65 : 1,
                          cursor: isPast ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{
                          fontFamily: "'Modern Antiqua', serif", fontSize: '1.25rem',
                          fontWeight: 700, width: '2rem', textAlign: 'center', flexShrink: 0,
                          color: isToday ? 'var(--gold)' : isPast ? 'var(--text-muted)' : 'var(--border)',
                        }}>
                          {day}
                        </div>
                        {beer ? (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              color: 'var(--text)', fontWeight: 600,
                              fontFamily: "'Modern Antiqua', serif", fontSize: '1.05rem',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {beer.name}
                            </div>
                            <div style={{ color: 'var(--gold)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {beer.brewery}
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            To be revealed...
                          </div>
                        )}
                        {isToday && (
                          <span style={{
                            background: 'var(--gold)', color: 'var(--bg)',
                            fontSize: '0.65rem', fontFamily: "'Modern Antiqua', serif",
                            fontWeight: 700, letterSpacing: '0.1em',
                            padding: '0.25rem 0.6rem', borderRadius: '999px', flexShrink: 0,
                          }}>TODAY</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

          </>
        )}
      </main>

      {/* ══════════════════════════════════════════════════════════════
          PAST BEER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {selectedDay !== null && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '480px', width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif",
                fontSize: '0.62rem', letterSpacing: '0.3em', textTransform: 'uppercase',
              }}>
                Day {selectedDay} · October {selectedDay}
              </div>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 0.25rem' }}
              >✕</button>
            </div>

            {modalBeer ? (
              <>
                <h2 style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--text)', fontSize: '1.5rem', lineHeight: 1.2, marginBottom: '0.4rem' }}>
                  {modalBeer.name}
                </h2>
                <p style={{ color: 'var(--gold)', fontSize: '1rem', marginBottom: '0.4rem', fontFamily: "'Modern Antiqua', serif" }}>
                  {modalBeer.brewery}
                </p>
                {(modalBeer.style || modalBeer.abv) && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {modalBeer.style}{modalBeer.style && modalBeer.abv ? ' · ' : ''}{modalBeer.abv ? `${modalBeer.abv}% ABV` : ''}
                  </p>
                )}
                {modalBeer.ai_notes && (
                  <p style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.75, fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1rem' }}>
                    {modalBeer.ai_notes}
                  </p>
                )}

                {/* Rating section */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  {!user ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <a href="/auth" style={{ color: 'var(--gold)' }}>Sign in</a> to rate this beer.
                    </p>
                  ) : modalRating ? (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.62rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        Your Rating
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>
                          {'★'.repeat(modalRating.stars)}{'☆'.repeat(5 - modalRating.stars)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{modalRating.stars} / 5</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.62rem', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                        Rate This Beer
                      </div>
                      <StarRating onSubmit={async (stars) => { await handleModalRate(stars) }} />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                This beer hasn&apos;t been added to the calendar yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
