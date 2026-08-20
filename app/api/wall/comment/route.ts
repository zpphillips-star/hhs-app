/**
 * POST /api/wall/comment
 *
 * Create a post_comment and, when appropriate, send push notifications:
 *   - To the post owner: "social_comment_on_your_items"
 *   - To all commenters on the post: "social_new_comment" (other participants)
 *
 * Body: { post_id, content }
 * Returns: the inserted comment row
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { requireBearerUser } from '@/lib/access'
import { sendExpoPush } from '@/lib/expo-push'

const supabase = createServiceClient()
const MAX_COMMENT_CONTENT_LENGTH = 2000

export async function POST(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { post_id?: unknown; user_id?: unknown; content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const post_id = typeof body.post_id === 'string' ? body.post_id.trim() : null
  const requested_user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (requested_user_id && requested_user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!post_id) {
    return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
  }
  const validationError = validateCommentContent(content)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  // 1. Insert the comment
  const { data: comment, error: insertErr } = await supabase
    .from('post_comments')
    .insert({ post_id, user_id: auth.user.id, content })
    .select()
    .single()

  if (insertErr) {
    console.error('[wall/comment] insert error:', insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // 2. Fetch post + existing commenters for notification targeting (fire-and-forget)
  void triggerCommentNotifications(post_id, auth.user.id, content).catch(err => {
    console.error('[wall/comment] notification error:', err instanceof Error ? err.message : err)
  })

  return NextResponse.json({ ok: true, comment })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { comment_id?: unknown; content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const commentId = typeof body.comment_id === 'string' ? body.comment_id.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!commentId) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 })
  const validationError = validateCommentContent(content)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const { data: existing, error: fetchError } = await supabase
    .from('post_comments')
    .select('id, user_id')
    .eq('id', commentId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  if (existing.user_id !== auth.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('post_comments')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', auth.user.id)
    .select('id, user_id, content, updated_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  return NextResponse.json({ ok: true, comment: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { comment_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const commentId = typeof body.comment_id === 'string' ? body.comment_id.trim() : ''
  if (!commentId) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 })

  const { data: existing, error: fetchError } = await supabase
    .from('post_comments')
    .select('id, post_id, user_id')
    .eq('id', commentId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  if (existing.user_id !== auth.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', auth.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, post_id: existing.post_id })
}

function validateCommentContent(content: string): string | null {
  if (!content) return 'Comment content cannot be empty'
  if (content.length > MAX_COMMENT_CONTENT_LENGTH) {
    return `Comment content must be ${MAX_COMMENT_CONTENT_LENGTH} characters or fewer`
  }
  return null
}

async function triggerCommentNotifications(
  postId: string,
  commenterId: string,
  content: string
) {
  // Fetch post owner
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .maybeSingle()

  if (!post) return

  const ownerId: string = post.user_id
  const snippet = content.length > 60 ? content.slice(0, 57) + '…' : content

  // Notify post owner (unless they're the commenter) — "Comment on Your Items"
  if (ownerId !== commenterId) {
    await sendExpoPush({
      supabase,
      userIds: [ownerId],
      title: '💬 New comment on your post',
      body: snippet,
      url: '/wall',
      category: 'social_comment_on_your_items',
    }).catch(err => {
      console.error('[wall/comment] notify owner error:', err instanceof Error ? err.message : err)
    })
  }

  // Broadcast "new comment on any post" to all token holders — "New Comment".
  // Excludes the commenter and the post owner (owner got the more specific alert above).
  await sendExpoPush({
    supabase,
    // no userIds = broadcast; excludeUserIds removes actor + owner
    excludeUserIds: [commenterId, ownerId].filter(Boolean),
    title: '💬 New comment on a post',
    body: snippet,
    url: '/wall',
    category: 'social_new_comment',
  }).catch(err => {
    console.error('[wall/comment] notify all error:', err instanceof Error ? err.message : err)
  })
}
