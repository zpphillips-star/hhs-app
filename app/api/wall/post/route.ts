import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireBearerUser } from '@/lib/access'

const supabase = createServiceClient()
const MAX_POST_CONTENT_LENGTH = 2000
const ALLOWED_MEDIA_TYPES = new Set(['image', 'video'])

type PostCreateBody = {
  user_id?: unknown
  beer_id?: unknown
  content?: unknown
  photo_url?: unknown
  media_url?: unknown
  image_url?: unknown
  media_type?: unknown
}

export async function POST(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: PostCreateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedUserId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  const beerId = typeof body.beer_id === 'string' && body.beer_id.trim() ? body.beer_id.trim() : null
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const mediaUrl = getOptionalUrl(body.media_url) || getOptionalUrl(body.photo_url) || getOptionalUrl(body.image_url)
  const photoUrl = getOptionalUrl(body.photo_url) || mediaUrl
  const mediaType = normalizeMediaType(body.media_type, mediaUrl)

  if (requestedUserId && requestedUserId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!content && !mediaUrl) {
    return NextResponse.json({ error: 'content or media_url is required' }, { status: 400 })
  }
  if (content.length > MAX_POST_CONTENT_LENGTH) {
    return NextResponse.json({ error: `Post content must be ${MAX_POST_CONTENT_LENGTH} characters or fewer` }, { status: 400 })
  }
  if (mediaType && !ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return NextResponse.json({ error: 'media_type must be image or video' }, { status: 400 })
  }

  const insertPayload = {
    user_id: auth.user.id,
    beer_id: beerId,
    content,
    photo_url: photoUrl,
    media_url: mediaUrl,
    media_type: mediaType,
  }

  let result = await supabase
    .from('posts')
    .insert(insertPayload)
    .select('id, user_id, beer_id, content, photo_url, media_url, media_type, created_at, updated_at')
    .maybeSingle()

  if (isMissingMediaColumnError(result.error)) {
    result = await supabase
      .from('posts')
      .insert({
        user_id: auth.user.id,
        beer_id: beerId,
        content,
        photo_url: photoUrl,
      })
      .select('id, user_id, beer_id, content, photo_url, created_at, updated_at')
      .maybeSingle()
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true, post: result.data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { post_id?: unknown; content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const postId = typeof body.post_id === 'string' ? body.post_id.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!postId) return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
  if (!content) return NextResponse.json({ error: 'Post content cannot be empty' }, { status: 400 })
  if (content.length > MAX_POST_CONTENT_LENGTH) {
    return NextResponse.json({ error: `Post content must be ${MAX_POST_CONTENT_LENGTH} characters or fewer` }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await supabase
    .from('posts')
    .select('id, user_id')
    .eq('id', postId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  if (existing.user_id !== auth.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('posts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', auth.user.id)
    .select('id, user_id, content, updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  return NextResponse.json({ ok: true, post: data })
}

function getOptionalUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeMediaType(value: unknown, mediaUrl: string | null): 'image' | 'video' | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized.startsWith('video')) return 'video'
    if (normalized.startsWith('image')) return 'image'
  }
  if (mediaUrl && /\.(mp4|mov|m4v|webm|3gp|3gpp)(?:$|[?#])/i.test(mediaUrl)) return 'video'
  return mediaUrl ? 'image' : null
}

function isMissingMediaColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const message = error.message || ''
  return error.code === 'PGRST204' || /media_(url|type)|column .* does not exist|Could not find .*media_/i.test(message)
}
