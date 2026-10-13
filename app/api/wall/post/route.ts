import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'
import { requireBearerUser } from '@/lib/access'
import { parseWallPostInput, WallPostInputError } from '@/lib/wall-post-input'

const MAX_POST_CONTENT_LENGTH = 2000

// GET and POST use the same verified caller JWT, never a service-role client.
async function authenticatedPostClient(req: NextRequest) {
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)\s*$/i)?.[1]
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized', committed: false }, { status: 401 }) }
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  )
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError) {
    const status = authError.status === 400 || authError.status === 401 || authError.status === 403
      ? 401 : 500
    return { error: NextResponse.json({
      error: status === 401 ? 'Unauthorized' : 'Authentication failed',
      ...(status === 401 ? { committed: false } : {}),
    }, { status }) }
  }
  if (!auth.user) return { error: NextResponse.json({ error: 'Unauthorized', committed: false }, { status: 401 }) }
  return { supabase, user: auth.user }
}

export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const auth = await authenticatedPostClient(req)
    if (auth.error) {
      auth.error.headers.set('Cache-Control', 'no-store')
      return auth.error
    }
    const { data: version, error } = await auth.supabase.rpc('wall_media_capabilities')
    if (error || version !== 1) {
      return NextResponse.json({ error: 'Atomic media unavailable' }, { status: 503, headers })
    }
    return NextResponse.json({
      ok: true,
      atomic_media_version: 1,
      capabilities: { atomic_wall_post: 1, idempotency_key: 1, ordered_media: 1 },
    }, { headers })
  } catch {
    return NextResponse.json({ error: 'Atomic media unavailable' }, { status: 503, headers })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticatedPostClient(req)
    if (auth.error) return auth.error
    const { supabase } = auth
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body', committed: false }, { status: 400 })
    }
    const input = parseWallPostInput(body, req.headers.get('idempotency-key'))
    if (input.userId && input.userId !== auth.user.id.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden', committed: false }, { status: 403 })
    }

    const { data: post, error } = await supabase.rpc('create_wall_post_with_media', {
      p_content: input.content,
      p_beer_id: input.beerId,
      p_media: input.media,
      p_request_id: input.requestId,
    })
    if (error) {
      const status = ({ '22023': 400, '23505': 409, '42501': 403 } as Record<string, number>)[error.code] ?? 500
      // These SQLSTATEs reject the atomic transaction; no writes survive.
      // A conflict may refer to an earlier commit. Unknown/server failures also
      // remain ambiguous. This marker never disproves a previous attempt.
      const rolledBack = error.code === '22023' || error.code === '42501'
      return NextResponse.json({
        error: error.message,
        ...(rolledBack ? { committed: false } : {}),
      }, { status })
    }
    if (!post || typeof post !== 'object' || Array.isArray(post) || typeof post.id !== 'string' || !post.id) {
      return NextResponse.json({ error: 'Invalid post response' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, post, id: post.id }, { status: 201 })
  } catch (error) {
    if (error instanceof WallPostInputError) {
      return NextResponse.json({ error: error.message, committed: false }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unable to create post' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()
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
