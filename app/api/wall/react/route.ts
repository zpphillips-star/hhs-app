/**
 * POST /api/wall/react
 *
 * Create, swap, or remove a post reaction, then notify:
 *   - Post owner (if not the reactor): "social_reaction_to_your_items"
 *   - All other users who reacted on this post: "social_new_reaction"
 *
 * Body: { post_id, user_id, reaction }
 *   reaction: 'cheers' | 'dead' | 'fire' | 'trophy' | 'rough' | null (null = remove)
 * Returns: { action: 'inserted' | 'updated' | 'deleted' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendExpoPush } from '@/lib/expo-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const VALID_REACTIONS = ['cheers', 'dead', 'fire', 'trophy', 'rough'] as const
type Reaction = typeof VALID_REACTIONS[number]

export async function POST(req: NextRequest) {
  let body: { post_id?: unknown; user_id?: unknown; reaction?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const post_id = typeof body.post_id === 'string' ? body.post_id.trim() : null
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const reaction = body.reaction === null ? null
    : typeof body.reaction === 'string' ? body.reaction.trim() as Reaction : null

  if (!post_id || !user_id) {
    return NextResponse.json({ error: 'post_id and user_id are required' }, { status: 400 })
  }
  if (reaction !== null && !VALID_REACTIONS.includes(reaction as Reaction)) {
    return NextResponse.json({ error: 'Invalid reaction value' }, { status: 400 })
  }

  // Check for existing reaction
  const { data: existing, error: fetchErr } = await supabase
    .from('post_reactions')
    .select('id, reaction')
    .eq('post_id', post_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (fetchErr) {
    console.error('[wall/react] fetch error:', fetchErr.message)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  let action: 'inserted' | 'updated' | 'deleted'

  if (existing) {
    if (reaction === null || existing.reaction === reaction) {
      // Remove
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', user_id)
      if (error) {
        console.error('[wall/react] delete error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      action = 'deleted'
    } else {
      // Swap
      const { error } = await supabase
        .from('post_reactions')
        .update({ reaction })
        .eq('post_id', post_id)
        .eq('user_id', user_id)
      if (error) {
        console.error('[wall/react] update error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      action = 'updated'
    }
  } else {
    if (!reaction) {
      return NextResponse.json({ ok: true, action: 'noop' })
    }
    const { error } = await supabase
      .from('post_reactions')
      .insert({ post_id, user_id, reaction })
    if (error) {
      console.error('[wall/react] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    action = 'inserted'
  }

  // Send notifications only when a reaction was added/swapped (not removed)
  if (action !== 'deleted' && reaction) {
    void triggerReactionNotifications(post_id, user_id, reaction).catch(err => {
      console.error('[wall/react] notification error:', err instanceof Error ? err.message : err)
    })
  }

  return NextResponse.json({ ok: true, action })
}

async function triggerReactionNotifications(
  postId: string,
  reactorId: string,
  reaction: Reaction
) {
  const EMOJI: Record<Reaction, string> = {
    cheers: '🍺',
    dead: '💀',
    fire: '🔥',
    trophy: '🏆',
    rough: '🤢',
  }

  const [{ data: post }] = await Promise.all([
    supabase.from('posts').select('user_id').eq('id', postId).maybeSingle(),
  ])

  if (!post) return

  const ownerId: string = post.user_id
  const emoji = EMOJI[reaction] ?? reaction

  // Notify post owner — "Reaction to Your Items"
  if (ownerId !== reactorId) {
    await sendExpoPush({
      supabase,
      userIds: [ownerId],
      title: `${emoji} Someone reacted to your post`,
      body: `A member left a ${reaction} reaction`,
      url: '/wall',
      category: 'social_reaction_to_your_items',
    }).catch(err => {
      console.error('[wall/react] notify owner error:', err instanceof Error ? err.message : err)
    })
  }

  // Broadcast "new reaction on any post" to all token holders — "New Reaction".
  // Excludes the reactor and the post owner (owner got the more specific alert above).
  await sendExpoPush({
    supabase,
    // no userIds = broadcast; excludeUserIds removes actor + owner
    excludeUserIds: [reactorId, ownerId].filter(Boolean),
    title: `${emoji} New reaction on a post`,
    body: `Someone added a ${reaction} reaction`,
    url: '/wall',
    category: 'social_new_reaction',
  }).catch(err => {
    console.error('[wall/react] notify all error:', err instanceof Error ? err.message : err)
  })
}
