/**
 * POST /api/wall/comment
 *
 * Create a post_comment and, when appropriate, send push notifications:
 *   - To the post owner: "social_comment_on_your_items"
 *   - To all commenters on the post: "social_new_comment" (other participants)
 *
 * Body: { post_id, user_id, content }
 * Returns: the inserted comment row
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendExpoPush } from '@/lib/expo-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  let body: { post_id?: unknown; user_id?: unknown; content?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const post_id = typeof body.post_id === 'string' ? body.post_id.trim() : null
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const content = typeof body.content === 'string' ? body.content.trim() : null

  if (!post_id || !user_id || !content) {
    return NextResponse.json({ error: 'post_id, user_id, and content are required' }, { status: 400 })
  }

  // 1. Insert the comment
  const { data: comment, error: insertErr } = await supabase
    .from('post_comments')
    .insert({ post_id, user_id, content })
    .select()
    .single()

  if (insertErr) {
    console.error('[wall/comment] insert error:', insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // 2. Fetch post + existing commenters for notification targeting (fire-and-forget)
  void triggerCommentNotifications(post_id, user_id, content).catch(err => {
    console.error('[wall/comment] notification error:', err instanceof Error ? err.message : err)
  })

  return NextResponse.json({ ok: true, comment })
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
