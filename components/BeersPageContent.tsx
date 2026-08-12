'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Beer, Rating, Post, PostReaction, PostComment } from '@/lib/types'
import Nav from '@/components/Nav'
import StarRating from '@/components/StarRating'
import FractionalStars, { formatRating } from '@/components/FractionalStars'
import SetupGuide from '@/components/SetupGuide'
import {
  DEFAULT_BEER_VISIBILITY_PROFILE,
  canInteractWithBeer,
  canShowBeerDetails,
  getBeerAccessMessage,
  getEffectiveBeerVisibilityPreference,
  getLocalBeerVisibilityPreference,
  normalizeMembershipTier,
  type BeerVisibilityPreference,
  type BeerVisibilityProfile,
} from '@/lib/membership'

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
const PREVIEW_MODE = false

const PREVIEW_ACTIVE_MONTH = 7 // August internal preview; October remains launch month.
const PREVIEW_BEER = {
  id: 'preview-space-dust',
  day_number: 19,
  name: 'Space Dust IPA',
  brewery: 'Elysian Brewing',
  style: 'IPA',
  abv: 8.2,
  description: "A tropical supernova of mango, tangerine, and fresh-cut pine resin with a smooth malt backbone that keeps the bitterness in orbit. Bold at 8.2% ABV — drink it cold, drink it like you've earned it.",
  image_url: null,
  created_at: new Date().toISOString(),
} as Beer

const BEER_YEAR = 2026

function getNativeBeerView() {
  if (typeof window === 'undefined') return { appMode: false, view: '' }
  try {
    const params = new URLSearchParams(window.location.search)
    const appMode =
      params.get('hhs_app') === '1' ||
      (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
    return { appMode, view: params.get('hhs_view') || '' }
  } catch {
    return { appMode: false, view: '' }
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BeersPageContent({ forceTodayOnly = false }: { forceTodayOnly?: boolean } = {}) {
  const [nativeView] = useState(getNativeBeerView)
  const pathname = usePathname()
  const router = useRouter()
  const today    = new Date()
  // In PREVIEW_MODE, treat today as an active beer day regardless of month.
  // For internal web preview, August mirrors the active daily beer flow without
  // changing the canonical October calendar.
  const isActiveBeerDay = (
    today.getFullYear() === BEER_YEAR &&
    (today.getMonth() === 9 || today.getMonth() === PREVIEW_ACTIVE_MONTH)
  ) || PREVIEW_MODE
  const isOctober = (today.getFullYear() === BEER_YEAR && today.getMonth() === 9) || PREVIEW_MODE
  const year      = BEER_YEAR
  const todayDay  = isActiveBeerDay ? today.getDate() : null
  const oct1DOW   = new Date(year, 9, 1).getDay()
  const calendarOnly = nativeView.appMode && nativeView.view === 'calendar'
  const todayOnly = forceTodayOnly || (nativeView.appMode && nativeView.view === 'today') || pathname === '/today'

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
  const [loading,          setLoading]          = useState(true)
  const [beerAccess,       setBeerAccess]       = useState<BeerVisibilityProfile>(DEFAULT_BEER_VISIBILITY_PROFILE)
  // Guard: true until auth + membership check have both resolved.
  // Prevents rendering gated beer content before we know the user's tier.
  const [beerAccessLoading, setBeerAccessLoading] = useState(true)

  // Past beer modal
  const [selectedDay,  setSelectedDay]  = useState<number | null>(null)
  const [modalBeer,    setModalBeer]    = useState<Beer | null>(null)
  const [modalRating,  setModalRating]  = useState<Rating | null>(null)
  const [modalAvgRating, setModalAvgRating] = useState<number | null>(null)
  const [modalRatingCount, setModalRatingCount] = useState(0)
  const [modalPostContent, setModalPostContent] = useState('')
  const [modalPostPhoto, setModalPostPhoto] = useState<File | null>(null)
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null)
  const [modalSubmitting, setModalSubmitting] = useState(false)

  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const modalFileRef = useRef<HTMLInputElement>(null)
  const modalCameraRef = useRef<HTMLInputElement>(null)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      // If there's no session we can clear the access guard immediately — no
      // membership fetch will run, and the default 'all' preference is correct
      // for logged-out visitors.
      if (!user) setBeerAccessLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      const u = s?.user ?? null
      setUser(u)
      // Signed out: no membership check pending → clear guard so content renders.
      if (!u) setBeerAccessLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Membership beer visibility ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      void Promise.resolve().then(() => {
        setBeerAccess(DEFAULT_BEER_VISIBILITY_PROFILE)
        setBeerAccessLoading(false) // no fetch needed
      })
      return
    }
    // Re-arm the guard before the fetch so a user-change (e.g. sign-in) can
    // never momentarily render gated content with stale access data.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: must arm before async fetch
    setBeerAccessLoading(true)
    let cancelled = false
    fetch(`/api/beer-visibility-preference?user_id=${encodeURIComponent(user.id)}`)
      .then(async res => {
        const json = await res.json().catch(() => ({})) as {
          tier?: string
          rawTier?: string | null
          preference?: BeerVisibilityPreference | null
          effectivePreference?: BeerVisibilityPreference
          supported?: boolean
        }
        if (!res.ok) throw new Error('membership visibility unavailable')
        return json
      })
      .then(json => {
        if (cancelled) return
        const tier = normalizeMembershipTier(json.tier)
        const serverPreference = json.preference ?? null
        const localPreference = json.supported === false ? getLocalBeerVisibilityPreference(user.id) : null
        const preference = localPreference ?? serverPreference
        setBeerAccess({
          tier,
          rawTier: json.rawTier ?? null,
          preference,
          effectivePreference: preference
            ? getEffectiveBeerVisibilityPreference(tier, preference)
            : json.effectivePreference ?? getEffectiveBeerVisibilityPreference(tier, null),
          preferenceColumnAvailable: json.supported ?? null,
        })
        setBeerAccessLoading(false) // access resolved — safe to render gated content
      })
      .catch(() => {
        if (!cancelled) {
          setBeerAccess(current => ({
            ...current,
            tier: 'unknown',
            effectivePreference: 'all',
            preferenceColumnAvailable: null,
          }))
          setBeerAccessLoading(false) // resolve even on error to avoid infinite spinner
        }
      })
    return () => { cancelled = true }
  }, [user])

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

  // ── Load wall posts ─────────────────────────────────────────────────────────
  async function loadPosts(beerId: string) {
    // Fetch posts and profiles separately (no direct FK from posts.user_id to profiles)
    const [{ data: postsData }, { data: profilesData }] = await Promise.all([
      supabase
        .from('posts')
        .select('*, post_reactions(*), post_comments(*)')
        .eq('beer_id', beerId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, username, display_name'),
    ])
    // Build profile lookup
    const profileMap: Record<string, { username: string; display_name: string | null }> = {}
    for (const p of profilesData || []) profileMap[p.id] = p
    // Attach profiles to posts and comments
    const merged = (postsData || []).map(post => ({
      ...post,
      profiles: profileMap[post.user_id] || { username: 'Unknown', display_name: null },
      post_comments: (post.post_comments || []).map((c: { user_id: string }) => ({
        ...c,
        profiles: profileMap[c.user_id] || { username: 'Unknown', display_name: null },
      })),
    }))
    setPosts(merged)
  }

  async function loadRatingStats(
    beerId: string,
    apply: (avg: number | null, count: number) => void,
  ) {
    const { data: ratings } = await supabase.from('ratings').select('stars').eq('beer_id', beerId)
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((s, r) => s + r.stars, 0) / ratings.length
      apply(Math.round(avg * 10) / 10, ratings.length)
    } else {
      apply(null, 0)
    }
  }

  // ── Load ratings + posts for today's beer ───────────────────────────────────
  useEffect(() => {
    if (!todayBeer) return
    // Skip DB calls for preview-only beer (no real UUID in DB)
    if (todayBeer.id === 'preview-space-dust') return
    void loadRatingStats(todayBeer.id, (avg, count) => {
      setAvgRating(avg)
      setRatingCount(count)
    })
    void Promise.resolve().then(() => loadPosts(todayBeer.id))
  }, [todayBeer])

  // ── User's own rating for today ─────────────────────────────────────────────
  useEffect(() => {
    if (!user || !todayBeer || todayBeer.id === 'preview-space-dust') return
    supabase.from('ratings').select('*')
      .eq('user_id', user.id).eq('beer_id', todayBeer.id)
      .maybeSingle()
      .then(({ data }) => setUserRating(data))
  }, [user, todayBeer])

  // ── Rate today's beer ───────────────────────────────────────────────────────
  const handleRate = async (stars: number) => {
    if (!user || !todayBeer || todayBeer.id === 'preview-space-dust' || !canInteractWithBeer(beerAccess, todayBeer.day_number)) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/beer-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ beer_id: todayBeer.id, stars }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.error ?? 'Failed to save rating'); return }
    setUserRating(json.rating)
    await loadRatingStats(todayBeer.id, (avg, count) => {
      setAvgRating(avg)
      setRatingCount(count)
    })
  }

  // ── Photo select ────────────────────────────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPostPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleModalPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setModalPostPhoto(file)
    setModalPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    setPostPhoto(null)
    setPhotoPreview(null)
    if (fileRef.current)   fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const clearModalPhoto = () => {
    setModalPostPhoto(null)
    setModalPhotoPreview(null)
    if (modalFileRef.current) modalFileRef.current.value = ''
    if (modalCameraRef.current) modalCameraRef.current.value = ''
  }

  // ── Submit post ─────────────────────────────────────────────────────────────
  const submitBeerPost = async ({
    beer,
    content,
    photo,
    setBusy,
    reset,
    onSuccess,
  }: {
    beer: Beer | null
    content: string
    photo: File | null
    setBusy: (busy: boolean) => void
    reset: () => void
    onSuccess?: () => void
  }) => {
    if (!user || !beer || (!content.trim() && !photo) || beer.id === 'preview-space-dust' || !canInteractWithBeer(beerAccess, beer.day_number)) return
    setBusy(true)
    let photoUrl: string | null = null
    if (photo) {
      const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${user.id}/${photo.lastModified}-${safeName}`
      const { error } = await supabase.storage.from('post-photos').upload(path, photo)
      if (error) { alert('Photo upload error: ' + error.message); setBusy(false); return }
      const { data: { publicUrl } } = supabase.storage.from('post-photos').getPublicUrl(path)
      photoUrl = publicUrl
    }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/beer-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ beer_id: beer.id, content: content.trim(), photo_url: photoUrl }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert('Failed to post: ' + (json.error ?? 'Unknown error'))
      setBusy(false)
      return
    }
    reset()
    if (todayBeer?.id === beer.id) await loadPosts(beer.id)
    setBusy(false)
    onSuccess?.()
  }

  const handleSubmitPost = async () => {
    if (submitting) return
    await submitBeerPost({
      beer: todayBeer,
      content: postContent,
      photo: postPhoto,
      setBusy: setSubmitting,
      reset: () => {
        setPostContent('')
        clearPhoto()
      },
      onSuccess: () => router.push('/wall'),
    })
  }

  const handleSubmitModalPost = async () => {
    if (modalSubmitting) return
    await submitBeerPost({
      beer: modalBeer,
      content: modalPostContent,
      photo: modalPostPhoto,
      setBusy: setModalSubmitting,
      reset: () => {
        setModalPostContent('')
        clearModalPhoto()
      },
      onSuccess: () => router.push('/wall'),
    })
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
  const openCalendarDay = (day: number) => {
    if (todayDay && day === todayDay) {
      router.push('/')
      return
    }
    void openModal(day)
  }

  const openModal = async (day: number) => {
    if (!todayDay || day >= todayDay) return
    const beer = beers.find(b => b.day_number === day)
    if (beer && !canShowBeerDetails(beerAccess, beer.day_number)) return
    setSelectedDay(day)
    setModalBeer(beer || null)
    setModalRating(null)
    setModalAvgRating(null)
    setModalRatingCount(0)
    setModalPostContent('')
    clearModalPhoto()
    if (user && beer) {
      const { data } = await supabase.from('ratings').select('*')
        .eq('user_id', user.id).eq('beer_id', beer.id).maybeSingle()
      setModalRating(data)
    }
    if (beer) {
      await loadRatingStats(beer.id, (avg, count) => {
        setModalAvgRating(avg)
        setModalRatingCount(count)
      })
    }
  }

  const closeModal = () => {
    setSelectedDay(null)
    setModalBeer(null)
    setModalRating(null)
    setModalAvgRating(null)
    setModalRatingCount(0)
    setModalPostContent('')
    clearModalPhoto()
  }

  const handleModalRate = async (stars: number) => {
    if (!user || !modalBeer || !canInteractWithBeer(beerAccess, modalBeer.day_number)) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/beer-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ beer_id: modalBeer.id, stars }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { alert(json.error ?? 'Failed to save rating'); return }
    setModalRating(json.rating)
    await loadRatingStats(modalBeer.id, (avg, count) => {
      setModalAvgRating(avg)
      setModalRatingCount(count)
    })
  }

  useEffect(() => {
    if (loading || todayOnly || !todayDay) return
    const scrollId = window.setTimeout(() => {
      const todayCells = Array.from(document.querySelectorAll<HTMLElement>('[data-hhs-today-cell="true"]'))
      const visibleTodayCell = todayCells.find(el => el.offsetParent !== null) ?? todayCells[0]
      visibleTodayCell?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 175)
    return () => window.clearTimeout(scrollId)
  }, [loading, todayOnly, todayDay, beers.length])

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const beerMap = Object.fromEntries(beers.map(b => [b.day_number, b]))
  const slots = Array.from({ length: 31 }, (_, i) => i + 1)
  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const calendarCells: (number | null)[] = [...Array(oct1DOW).fill(null), ...slots]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)
  const todayCanShow = todayBeer ? canShowBeerDetails(beerAccess, todayBeer.day_number) : false
  const todayCanInteract = todayBeer ? canInteractWithBeer(beerAccess, todayBeer.day_number) : false
  const todayAccessMessage = todayBeer ? getBeerAccessMessage(beerAccess, todayBeer.day_number) : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!nativeView.appMode && <Nav user={user} />}

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem 1.5rem 5.5rem' }}>
        {loading ? (
          <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", textAlign: 'center', padding: '4rem 0' }}>
            Loading the sacred list...
          </p>
        ) : (
          <>

            {/* ══════════════════════════════════════════════════════════════
                BEER OF THE DAY
            ══════════════════════════════════════════════════════════════ */}
            {todayOnly && !calendarOnly && isActiveBeerDay && beerAccessLoading ? (
              // Membership check still in flight. Show a neutral placeholder so
              // Oddball users on ineligible days never see a flash of beer content.
              <section style={{ textAlign: 'center', padding: '4rem 0', marginBottom: '3.5rem' }}>
                <p style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif" }}>
                  Loading...
                </p>
              </section>
            ) : todayOnly && !calendarOnly && isActiveBeerDay && todayBeer && todayCanShow ? (
              <section style={{ marginBottom: '3.5rem' }}>

                {/* TODAY'S BEER label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,140,0,0.35))' }} />
                  <span style={{
                    fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.6rem',
                    letterSpacing: '0.4em',
                    textTransform: 'uppercase',
                    color: 'var(--gold)',
                    whiteSpace: 'nowrap',
                  }}>
                    Today&apos;s Beer
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(255,140,0,0.35))' }} />
                </div>

                {/* Day badge */}
                <div style={{
                  color: 'var(--text-muted)', fontFamily: "'Modern Antiqua', serif",
                  fontSize: '0.65rem', letterSpacing: '0.35em', marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                }}>
                  {isOctober
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
                  marginBottom: '0.4rem',
                }}>
                  {todayBeer.name}
                </h1>

                {/* Brewery + style/ABV as subtitle under the name */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    color: 'var(--gold)',
                    fontFamily: "'Modern Antiqua', serif",
                    fontSize: '1.1rem',
                    marginBottom: '0.25rem',
                  }}>
                    {todayBeer.brewery}
                  </div>
                  {(todayBeer.style || todayBeer.abv) && (
                    <div style={{
                      color: 'var(--text-muted)',
                      fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.85rem',
                    }}>
                      {todayBeer.style}{todayBeer.style && todayBeer.abv ? ' · ' : ''}{todayBeer.abv ? `${todayBeer.abv}% ABV` : ''}
                    </div>
                  )}
                </div>

                {/* ── BEER INFO CARD ─────────────────────────────────────── */}
                {(todayBeer.beer_fact || todayBeer.brewery_fact) && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  {todayBeer.beer_fact && (
                    <div>
                      <div style={{
                        color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.58rem', letterSpacing: '0.28em',
                        textTransform: 'uppercase', marginBottom: '0.5rem',
                      }}>The Beer</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.75, margin: 0 }}>
                        {todayBeer.beer_fact}
                      </p>
                    </div>
                  )}
                  {todayBeer.beer_fact && todayBeer.brewery_fact && (
                    <div style={{ borderTop: '1px solid var(--border)' }} />
                  )}
                  {todayBeer.brewery_fact && (
                    <div>
                      <div style={{
                        color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                        fontSize: '0.58rem', letterSpacing: '0.28em',
                        textTransform: 'uppercase', marginBottom: '0.5rem',
                      }}>The Brewery</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.75, margin: 0 }}>
                        {todayBeer.brewery_fact}
                      </p>
                    </div>
                  )}
                </div>
                )}

                {/* ── RATING ────────────────────────────────────────────── */}
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
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
                        <FractionalStars value={avgRating} size="1.2rem" />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {formatRating(avgRating)} / 5 · {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No ratings yet</span>
                    )}
                  </div>

                  {/* Horizontal divider */}
                  <div style={{ height: '1px', background: 'var(--border)' }} />

                  {/* Your rating */}
                  <div>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.58rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.4rem',
                    }}>
                      Your Rating
                    </div>
                    {!todayCanInteract && todayAccessMessage ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                        {todayAccessMessage}
                      </p>
                    ) : todayBeer.id === 'preview-space-dust' ? (
                      <StarRating onSubmit={async () => {}} />
                    ) : userRating ? (
                      <StarRating initialStars={userRating.stars} onSubmit={async (stars) => { await handleRate(stars) }} />
                    ) : user ? (
                      <StarRating onSubmit={async (stars) => { await handleRate(stars) }} />
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        <a href="/auth" style={{ color: 'var(--gold)' }}>Sign in</a> to rate
                      </p>
                    )}
                  </div>
                </div>

                {/* Post to the Wall */}
                {user && todayBeer.id !== 'preview-space-dust' && todayCanInteract && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.58rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.6rem',
                    }}>Post to the Wall</div>
                    <textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder="Share your thoughts on today's beer..."
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
                    {/* Photo preview */}
                    {photoPreview && (
                      <div style={{ position: 'relative', marginTop: '0.5rem', display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
                        <button onClick={clearPhoto} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    )}
                    {/* Hidden file inputs */}
                    <input ref={fileRef}   type="file"   accept="image/*"          onChange={handlePhotoSelect} style={{ display: 'none' }} />
                    <input ref={cameraRef} type="file"   accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📎 Photo</button>
                        <button onClick={() => cameraRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📷 Camera</button>
                      </div>
                      <button
                        onClick={handleSubmitPost}
                        disabled={submitting || (!postContent.trim() && !postPhoto)}
                        style={{
                          background: (postContent.trim() || postPhoto) ? 'var(--gold)' : 'transparent',
                          border: (postContent.trim() || postPhoto) ? 'none' : '1px solid var(--border)',
                          color: (postContent.trim() || postPhoto) ? 'var(--bg)' : 'var(--text-muted)',
                          padding: '0.45rem 1.25rem',
                          borderRadius: '8px',
                          cursor: (postContent.trim() || postPhoto) ? 'pointer' : 'default',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >{submitting ? 'Posting...' : 'Post'}</button>
                    </div>
                  </div>
                )}

                {user && todayBeer.id !== 'preview-space-dust' && !todayCanInteract && todayAccessMessage && (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1rem',
                  }}>
                    <div style={{
                      color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                      fontSize: '0.58rem', letterSpacing: '0.28em',
                      textTransform: 'uppercase', marginBottom: '0.6rem',
                    }}>Wall Posting</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6, margin: 0 }}>
                      {todayAccessMessage}
                    </p>
                  </div>
                )}

                {/* Link to The Wall */}
                {!nativeView.appMode && <div style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>
                  <a href="/wall" style={{
                    color: 'var(--gold)',
                    fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.8rem',
                    letterSpacing: '0.15em',
                    textDecoration: 'none',
                  }}>
                    → Go to The Wall
                  </a>
                </div>}

              </section>

            ) : todayOnly && !calendarOnly && isActiveBeerDay && !beerAccessLoading && todayBeer && !todayCanShow ? (
              <section style={{ textAlign: 'center', padding: '3rem 0', marginBottom: '3rem' }}>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.75rem 2rem',
                  maxWidth: '480px',
                  margin: '0 auto',
                }}>
                  <div style={{
                    color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.58rem', letterSpacing: '0.28em',
                    textTransform: 'uppercase', marginBottom: '0.75rem',
                  }}>
                    Oddballs Day Off
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                    Oddballs members default to odd-day participating beers. Today&apos;s Full Society beer is hidden unless you choose Show All.
                  </p>
                  {!nativeView.appMode && (
                    <a href="/membership" style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.8rem', letterSpacing: '0.15em', textDecoration: 'none' }}>
                      Manage beer visibility →
                    </a>
                  )}
                </div>
              </section>
            ) : todayOnly && !calendarOnly && isActiveBeerDay && !todayBeer ? (
              <section style={{ textAlign: 'center', padding: '3rem 0', marginBottom: '3rem' }}>
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Today&apos;s beer hasn&apos;t been added yet. Check back soon.
                </p>
              </section>
            ) : !todayOnly && !calendarOnly ? (
              <section style={{ textAlign: 'center', padding: '2.5rem 0 2rem', marginBottom: '2rem' }}>

                {/* Divider line + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,140,0,0.35))' }} />
                  <span style={{
                    fontFamily: "'Modern Antiqua', serif",
                    fontSize: '0.6rem', letterSpacing: '0.4em',
                    textTransform: 'uppercase', color: 'var(--gold)', whiteSpace: 'nowrap',
                  }}>The Beer Ledger</span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(255,140,0,0.35))' }} />
                </div>

                {/* Intro */}
                <div style={{
                  maxWidth: '520px', margin: '0 auto 1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1.5rem 1.75rem',
                }}>
                  <p style={{
                    fontFamily: "'Modern Antiqua', serif",
                    color: 'var(--text-muted)',
                    fontSize: '0.95rem',
                    lineHeight: 1.9,
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    The next pour is still being argued over in the shadows. Today&apos;s revealed beer lives on the Today page; the October calendar waits below.
                  </p>
                </div>

                {/* CTA hint */}
                <button onClick={() => router.push('/')} style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)', fontSize: '0.8rem',
                  fontFamily: "'Modern Antiqua', serif",
                  letterSpacing: '0.1em',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}>
                  Open Today&apos;s Beer →
                </button>

              </section>
            ) : null}

            {/* ══════════════════════════════════════════════════════════════
                OCTOBER CALENDAR
            ══════════════════════════════════════════════════════════════ */}
            {!todayOnly && <section style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>

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
                     if (!day) return <div key={`e-${idx}`} style={{ height: '110px' }} />
                     const beer       = beerMap[day]
                     const isToday    = day === todayDay
                     const isPast     = todayDay ? day < todayDay : false
                     const showBeer   = Boolean(beer && (isPast || isToday) && canShowBeerDetails(beerAccess, day))
                     const hiddenByTier = Boolean(beer && (isPast || isToday) && !showBeer)
                      const clickable  = (isToday && Boolean(beer)) || (isPast && showBeer)

                    return (
                      <div
                         key={day}
                         className="hhs-cal-cell"
                         data-hhs-today-cell={isToday ? 'true' : undefined}
                         onClick={() => clickable && openCalendarDay(day)}
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius: '10px',
                          padding: '0.6rem',
                          height: '110px',
                          overflow: 'hidden',
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

                        {showBeer && beer ? (
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
                        ) : hiddenByTier ? (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic', marginTop: 'auto' }}>
                            Oddballs day off
                          </div>
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
                      const showBeer = Boolean(beer && (isPast || isToday) && canShowBeerDetails(beerAccess, day))
                      const hiddenByTier = Boolean(beer && (isPast || isToday) && !showBeer)
                      const clickable = (isToday && Boolean(beer)) || (isPast && showBeer)
                      return (
                        <div
                          key={day}
                          data-hhs-today-cell={isToday ? 'true' : undefined}
                          onClick={() => clickable && openCalendarDay(day)}
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${isToday ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius: '12px',
                          padding: '1rem 1.25rem',
                          display: 'flex', alignItems: 'center', gap: '1rem',
                          boxShadow: isToday ? '0 0 0 1px var(--gold)' : 'none',
                          opacity: isPast && !isToday ? 0.65 : 1,
                           cursor: clickable ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{
                          fontFamily: "'Modern Antiqua', serif", fontSize: '1.25rem',
                          fontWeight: 700, width: '2rem', textAlign: 'center', flexShrink: 0,
                          color: isToday ? 'var(--gold)' : isPast ? 'var(--text-muted)' : 'var(--border)',
                        }}>
                          {day}
                        </div>
                        {showBeer && beer ? (
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
                        ) : hiddenByTier ? (
                          <div style={{ flex: 1, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                            Oddballs day off
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
            </section>}

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
                {(modalBeer.beer_fact || modalBeer.brewery_fact) && (
                  <div style={{
                    background: 'rgba(25, 23, 38, 0.45)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem 1.15rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}>
                    {modalBeer.beer_fact && (
                      <div>
                        <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          The Beer
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
                          {modalBeer.beer_fact}
                        </p>
                      </div>
                    )}
                    {modalBeer.beer_fact && modalBeer.brewery_fact && (
                      <div style={{ borderTop: '1px solid var(--border)' }} />
                    )}
                    {modalBeer.brewery_fact && (
                      <div>
                        <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          The Brewery
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', lineHeight: 1.7, margin: 0 }}>
                          {modalBeer.brewery_fact}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Rating section */}
                <div style={{
                  background: 'rgba(25, 23, 38, 0.45)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '1rem 1.15rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  <div>
                    <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Society Rating
                    </div>
                    {modalAvgRating !== null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FractionalStars value={modalAvgRating} size="1.15rem" />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {formatRating(modalAvgRating)} / 5 · {modalRatingCount} {modalRatingCount === 1 ? 'rating' : 'ratings'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No ratings yet</span>
                    )}
                  </div>
                  <div style={{ height: '1px', background: 'var(--border)' }} />
                  <div>
                    <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Your Rating
                    </div>
                    {!user ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                        <a href="/auth" style={{ color: 'var(--gold)' }}>Sign in</a> to rate this beer.
                      </p>
                    ) : !canInteractWithBeer(beerAccess, modalBeer.day_number) ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                        {getBeerAccessMessage(beerAccess, modalBeer.day_number)}
                      </p>
                    ) : (
                      <StarRating initialStars={modalRating?.stars} onSubmit={async (stars) => { await handleModalRate(stars) }} />
                    )}
                  </div>
                </div>

                {user && canInteractWithBeer(beerAccess, modalBeer.day_number) ? (
                  <div style={{
                    background: 'rgba(25, 23, 38, 0.45)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1rem 1.15rem',
                  }}>
                    <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                      Post to the Wall
                    </div>
                    <textarea
                      value={modalPostContent}
                      onChange={e => setModalPostContent(e.target.value)}
                      placeholder={`Share your thoughts on ${modalBeer.name}...`}
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
                    {modalPhotoPreview && (
                      <div style={{ position: 'relative', marginTop: '0.5rem', display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={modalPhotoPreview} alt="preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', objectFit: 'cover' }} />
                        <button onClick={clearModalPhoto} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    )}
                    <input ref={modalFileRef} type="file" accept="image/*" onChange={handleModalPhotoSelect} style={{ display: 'none' }} />
                    <input ref={modalCameraRef} type="file" accept="image/*" capture="environment" onChange={handleModalPhotoSelect} style={{ display: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => modalFileRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📎 Photo</button>
                        <button onClick={() => modalCameraRef.current?.click()} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Modern Antiqua', serif" }}>📷 Camera</button>
                      </div>
                      <button
                        onClick={handleSubmitModalPost}
                        disabled={modalSubmitting || (!modalPostContent.trim() && !modalPostPhoto)}
                        style={{
                          background: (modalPostContent.trim() || modalPostPhoto) ? 'var(--gold)' : 'transparent',
                          border: (modalPostContent.trim() || modalPostPhoto) ? 'none' : '1px solid var(--border)',
                          color: (modalPostContent.trim() || modalPostPhoto) ? 'var(--bg)' : 'var(--text-muted)',
                          padding: '0.45rem 1.25rem',
                          borderRadius: '8px',
                          cursor: (modalPostContent.trim() || modalPostPhoto) ? 'pointer' : 'default',
                          fontFamily: "'Modern Antiqua', serif",
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                        }}
                      >{modalSubmitting ? 'Posting...' : 'Post'}</button>
                    </div>
                  </div>
                ) : user && getBeerAccessMessage(beerAccess, modalBeer.day_number) ? (
                  <div style={{ background: 'rgba(25, 23, 38, 0.45)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem 1.15rem' }}>
                    <div style={{ color: 'var(--gold)', fontFamily: "'Modern Antiqua', serif", fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                      Wall Posting
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                      {getBeerAccessMessage(beerAccess, modalBeer.day_number)}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                This beer hasn&apos;t been added to the calendar yet.
              </p>
            )}
          </div>
        </div>
      )}

      {user && <SetupGuide userId={user.id} />}
    </div>
  )
}

