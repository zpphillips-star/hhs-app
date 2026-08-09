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

type AuthenticatedUser = {
  id: string
  email?: string | null
}

const VALID_KEYS = [
  'daily_beer',
  'social_all',
  'social_new_comment',
  'social_new_reaction',
  'social_reaction_to_your_items',
  'social_comment_on_your_items',
] as const

type PrefKey = typeof VALID_KEYS[number]

const DB_COLUMNS: Record<PrefKey, string> = {
  daily_beer: 'daily_beer',
  social_all: 'social_all',
  social_new_comment: 'social_new_comment',
  social_new_reaction: 'social_new_reaction',
  social_reaction_to_your_items: 'social_reaction_to_your_items',
  social_comment_on_your_items: 'social_comment_on_your_items',
}

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
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to read notification preferences.' }, { status: 401 })
  }

  const requestedUserId = req.nextUrl.searchParams.get('user_id')
  const userId = requestedUserId ?? authUser.id
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })
  }
  if (userId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot read notification preferences for another user.' }, { status: 403 })
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
  const prefs = data ? {
    daily_beer: data.daily_beer,
    social_all: data.social_all,
    social_new_comment: data.social_new_comment,
    social_new_reaction: data.social_new_reaction,
    social_reaction_to_your_items: data.social_reaction_to_your_items,
    social_comment_on_your_items: data.social_comment_on_your_items,
  } : DEFAULTS
  return NextResponse.json({ ok: true, prefs })
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to save notification preferences.' }, { status: 401 })
  }

  let body: { user_id?: unknown; email?: unknown } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedUserId = typeof body.user_id === 'string' ? body.user_id.trim() : null
  if (requestedUserId && requestedUserId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot save notification preferences for another user.' }, { status: 403 })
  }

  const user_id = authUser.id

  // Pick only recognised pref keys with boolean values
  const update: Record<string, boolean> = {}
  for (const key of VALID_KEYS) {
    if (key in body && typeof body[key] === 'boolean') {
      update[DB_COLUMNS[key]] = body[key] as boolean
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid preference keys provided' }, { status: 400 })
  }

  const row: Record<string, unknown> = { user_id, ...update }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error('[notification-preferences] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}
