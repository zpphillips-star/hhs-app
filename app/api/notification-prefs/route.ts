import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const API_TO_DB = {
  daily_beer_enabled: 'daily_beer',
  social_enabled: 'social_all',
  social_new_comment: 'social_new_comment',
  social_new_reaction: 'social_new_reaction',
  social_reaction_to_yours: 'social_reaction_to_your_items',
  social_comment_on_yours: 'social_comment_on_your_items',
} as const

// GET /api/notification-prefs
// Header: Authorization: Bearer <token>
export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('daily_beer,social_all,social_new_comment,social_new_reaction,social_reaction_to_your_items,social_comment_on_your_items')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ? {
    daily_beer_enabled: data.daily_beer,
    social_enabled: data.social_all,
    social_new_comment: data.social_new_comment,
    social_new_reaction: data.social_new_reaction,
    social_reaction_to_yours: data.social_reaction_to_your_items,
    social_comment_on_yours: data.social_comment_on_your_items,
  } : null)
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
      patch[API_TO_DB[key as keyof typeof API_TO_DB]] = body[key]
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

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) return data.user.id
  }
  return null
}
