import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to read roster preferences.' }, { status: 401 })
  }

  const requestedUserId = req.nextUrl.searchParams.get('user_id')
  const userId = requestedUserId ?? authUser.id
  if (userId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot read roster preferences for another user.' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('member_roster_preferences')
    .select('show_real_name_in_roster, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[roster-preference] GET error:', error.message)
    return NextResponse.json({ error: 'Could not load roster preference.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    show_real_name_in_roster: data?.show_real_name_in_roster !== false,
  })
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to save roster preferences.' }, { status: 401 })
  }

  let body: { user_id?: unknown; show_real_name_in_roster?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedUserId = typeof body.user_id === 'string' ? body.user_id.trim() : null
  if (requestedUserId && requestedUserId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot save roster preferences for another user.' }, { status: 403 })
  }

  if (typeof body.show_real_name_in_roster !== 'boolean') {
    return NextResponse.json({ error: 'show_real_name_in_roster must be a boolean.' }, { status: 400 })
  }

  const showRealName = body.show_real_name_in_roster
  const { error } = await supabase
    .from('member_roster_preferences')
    .upsert(
      {
        user_id: authUser.id,
        show_real_name_in_roster: showRealName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('[roster-preference] POST error:', error.message)
    return NextResponse.json({ error: 'Could not save roster preference.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, show_real_name_in_roster: showRealName })
}

async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email?: string | null } | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}
