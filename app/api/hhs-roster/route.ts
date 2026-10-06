import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

type RosterPreferenceRow = {
  user_id: string
  show_real_name_in_roster: boolean | null
}

type ProfileRow = {
  id: string
  username: string | null
  first_name: string | null
  status: string | null
}

type RosterMember = {
  id: string
  username: string
  first_name: string | null
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to view the HHS Roster.' }, { status: 401 })
  }

  const approved = await requireApprovedProfile(authUser.id)
  if (!approved.ok) {
    return NextResponse.json({ error: approved.error }, { status: approved.status })
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, first_name, status')
    .eq('status', 'approved')
    .order('first_name', { ascending: true, nullsFirst: false })
    .order('username', { ascending: true, nullsFirst: false })

  if (profilesError) {
    console.error('[hhs-roster] profiles GET error:', profilesError.message)
    return NextResponse.json({ error: 'Could not load the HHS Roster.' }, { status: 500 })
  }

  const profileRows = ((profiles ?? []) as ProfileRow[]).filter((profile) => Boolean(profile.id))
  const userIds = profileRows.map((profile) => profile.id)

  let preferenceByUser = new Map<string, boolean>()
  if (userIds.length) {
    const { data: preferences, error: preferencesError } = await supabase
      .from('member_roster_preferences')
      .select('user_id, show_real_name_in_roster')
      .in('user_id', userIds)

    if (preferencesError) {
      console.error('[hhs-roster] preferences GET error:', preferencesError.message)
      return NextResponse.json({ error: 'Could not load roster privacy preferences.' }, { status: 500 })
    }

    preferenceByUser = new Map(
      ((preferences ?? []) as RosterPreferenceRow[]).map((preference) => [
        preference.user_id,
        preference.show_real_name_in_roster !== false,
      ]),
    )
  }

  const members: RosterMember[] = profileRows
    .map((profile) => {
      const username = profile.username?.trim()
      if (!username) return null

      const showRealName = preferenceByUser.get(profile.id) ?? true
      const firstName = showRealName ? profile.first_name?.trim() || null : null

      return {
        id: profile.id,
        username,
        first_name: firstName,
      }
    })
    .filter((member): member is RosterMember => Boolean(member))
    .sort((a, b) => {
      const aFirst = a.first_name?.toLocaleLowerCase() ?? ''
      const bFirst = b.first_name?.toLocaleLowerCase() ?? ''
      if (aFirst && bFirst && aFirst !== bFirst) return aFirst.localeCompare(bFirst)
      if (aFirst && !bFirst) return -1
      if (!aFirst && bFirst) return 1
      return a.username.toLocaleLowerCase().localeCompare(b.username.toLocaleLowerCase())
    })

  return NextResponse.json({ ok: true, members })
}

async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email?: string | null } | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}

async function requireApprovedProfile(
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[hhs-roster] approved profile check error:', error.message)
    return { ok: false, status: 500, error: 'Could not confirm membership status.' }
  }

  if (data?.status !== 'approved') {
    return { ok: false, status: 403, error: 'The HHS Roster is only available to approved members.' }
  }

  return { ok: true }
}
