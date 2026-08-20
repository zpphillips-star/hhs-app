import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireBearerUser } from '@/lib/access'

const supabase = createServiceClient()
const MAX_POST_CONTENT_LENGTH = 2000

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