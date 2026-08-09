import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// GET /api/notification-prefs
// Header: x-user-id: <uuid>  OR Authorization: Bearer <token>
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('daily_beer_enabled,social_enabled,social_new_comment,social_new_reaction,social_reaction_to_yours,social_comment_on_yours')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? null)
}

// POST /api/notification-prefs — upsert preferences
export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'daily_beer_enabled',
    'social_enabled',
    'social_new_comment',
    'social_new_reaction',
    'social_reaction_to_yours',
    'social_comment_on_yours',
  ]

  const patch: Record<string, unknown> = { user_id: userId }
  for (const key of allowed) {
    if (key in body && typeof body[key] === 'boolean') {
      patch[key] = body[key]
    }
  }

  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(patch, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function resolveUserId(req: NextRequest): Promise<string | null> {
  // Option 1: Bearer token
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) return data.user.id
  }
  // Option 2: x-user-id header (only trusted if caller is server-side / same-origin)
  const userId = req.headers.get('x-user-id')
  if (userId) return userId
  return null
}
