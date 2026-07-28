/**
 * POST /api/push-token
 *
 * Register or update an Expo push token for the authenticated user.
 * Called by the native app after Expo.getExpoPushTokenAsync() succeeds.
 *
 * Body: { user_id, email, token, platform?, device_id? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  let body: {
    user_id?: unknown
    email?: unknown
    token?: unknown
    platform?: unknown
    device_id?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const email = typeof body.email === 'string' ? body.email.trim() : null
  const token = typeof body.token === 'string' ? body.token.trim() : null
  const platform = typeof body.platform === 'string' ? body.platform.trim() : null
  const device_id = typeof body.device_id === 'string' ? body.device_id.trim() : null

  if (!user_id || !token) {
    return NextResponse.json({ error: 'user_id and token are required' }, { status: 400 })
  }

  // Basic Expo token format validation
  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
    return NextResponse.json({ error: 'token does not look like an Expo push token' }, { status: 400 })
  }

  const row = {
    user_id,
    ...(email ? { email } : {}),
    token,
    ...(platform ? { platform } : {}),
    ...(device_id ? { device_id } : {}),
  }

  const { error } = await supabase
    .from('expo_push_tokens')
    .upsert(row, { onConflict: 'user_id,token' })

  if (error) {
    console.error('[push-token] upsert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Ensure a notification_preferences row exists with sensible defaults
  const { error: prefErr } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id, ...(email ? { email } : {}) },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
  if (prefErr) {
    // Non-fatal — log and continue
    console.warn('[push-token] preferences upsert warning:', prefErr.message)
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/push-token
 * Remove a specific token (e.g., on logout or permission revoke).
 * Body: { user_id, token? }  — if token omitted, removes ALL tokens for user.
 */
export async function DELETE(req: NextRequest) {
  let body: { user_id?: unknown; token?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const token = typeof body.token === 'string' ? body.token.trim() : null

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  let query = supabase.from('expo_push_tokens').delete().eq('user_id', user_id)
  if (token) query = query.eq('token', token)

  const { error } = await query
  if (error) {
    console.error('[push-token] delete error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
