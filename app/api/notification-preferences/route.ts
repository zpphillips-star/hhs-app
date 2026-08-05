/**
 * GET  /api/notification-preferences?user_id=<uuid>
 * POST /api/notification-preferences
 *
 * Read or write per-user notification preferences.
 * The native app calls these (bridged through the WebView) to persist settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

const VALID_KEYS = [
  'daily_beer',
  'social_all',
  'social_new_comment',
  'social_new_reaction',
  'social_reaction_to_your_items',
  'social_comment_on_your_items',
] as const

type PrefKey = typeof VALID_KEYS[number]

/** Default: all enabled */
const DEFAULTS: Record<PrefKey, boolean> = {
  daily_beer: true,
  social_all: true,
  social_new_comment: true,
  social_new_reaction: true,
  social_reaction_to_your_items: true,
  social_comment_on_your_items: true,
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('daily_beer, social_all, social_new_comment, social_new_reaction, social_reaction_to_your_items, social_comment_on_your_items, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[notification-preferences] GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If no row yet return defaults so the native app can hydrate its UI
  const prefs = data ?? DEFAULTS
  return NextResponse.json({ ok: true, prefs })
}

export async function POST(req: NextRequest) {
  let body: { user_id?: unknown; email?: unknown } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const email = typeof body.email === 'string' ? body.email.trim() : null

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  // Pick only recognised pref keys with boolean values
  const update: Partial<Record<PrefKey, boolean>> = {}
  for (const key of VALID_KEYS) {
    if (key in body && typeof body[key] === 'boolean') {
      update[key] = body[key] as boolean
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid preference keys provided' }, { status: 400 })
  }

  const row: Record<string, unknown> = { user_id, ...update }
  if (email) row.email = email

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('[notification-preferences] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
