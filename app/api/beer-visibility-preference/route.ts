import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import {
  getEffectiveBeerVisibilityPreference,
  isMissingBeerVisibilityColumnError,
  normalizeBeerVisibilityPreference,
  normalizeMembershipTier,
  type BeerVisibilityPreference,
} from '@/lib/membership'

const supabase = createServiceClient()

type AuthenticatedUser = {
  id: string
  email?: string | null
}

export async function GET(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to read beer visibility preferences.' }, { status: 401 })
  }

  const requestedUserId = req.nextUrl.searchParams.get('user_id')
  const userId = requestedUserId ?? authUser.id
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })
  }
  if (userId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot read beer visibility preferences for another user.' }, { status: 403 })
  }

  const { data: tierRow, error: tierError } = await supabase
    .from('profiles')
    .select('tier, username, display_name')
    .eq('id', userId)
    .maybeSingle()

  if (tierError) {
    console.error('[beer-visibility-preference] tier GET error:', tierError.message)
    return NextResponse.json({ error: tierError.message }, { status: 500 })
  }

  const tier = normalizeMembershipTier(tierRow?.tier)

  const { data: prefRow, error: prefError } = await supabase
    .from('profiles')
    .select('beer_visibility_preference')
    .eq('id', userId)
    .maybeSingle()

  if (prefError) {
    if (isMissingBeerVisibilityColumnError(prefError)) {
      return NextResponse.json({
        ok: true,
        supported: false,
        tier,
        rawTier: tierRow?.tier ?? null,
        username: tierRow?.username ?? null,
        displayName: tierRow?.display_name ?? null,
        preference: null,
        effectivePreference: getEffectiveBeerVisibilityPreference(tier, null),
      })
    }
    console.error('[beer-visibility-preference] preference GET error:', prefError.message)
    return NextResponse.json({ error: prefError.message }, { status: 500 })
  }

  const preference = normalizeBeerVisibilityPreference(prefRow?.beer_visibility_preference)
  return NextResponse.json({
    ok: true,
    supported: true,
    tier,
    rawTier: tierRow?.tier ?? null,
    username: tierRow?.username ?? null,
    displayName: tierRow?.display_name ?? null,
    preference,
    effectivePreference: getEffectiveBeerVisibilityPreference(tier, preference),
  })
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req)
  if (!authUser) {
    return NextResponse.json({ error: 'Sign in is required to save beer visibility preferences.' }, { status: 401 })
  }

  let body: { user_id?: unknown; preference?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestedUserId = typeof body.user_id === 'string' ? body.user_id.trim() : null
  if (requestedUserId && requestedUserId !== authUser.id) {
    return NextResponse.json({ error: 'Cannot save beer visibility preferences for another user.' }, { status: 403 })
  }

  const userId = authUser.id
  const preference = normalizeBeerVisibilityPreference(typeof body.preference === 'string' ? body.preference : null)

  if (!preference) {
    return NextResponse.json({ error: 'preference must be participating_only or all' }, { status: 400 })
  }

  const savedPreference: BeerVisibilityPreference = preference
  const { error } = await supabase
    .from('profiles')
    .update({ beer_visibility_preference: savedPreference })
    .eq('id', userId)

  if (error) {
    if (isMissingBeerVisibilityColumnError(error)) {
      return NextResponse.json({
        ok: false,
        supported: false,
        error: 'Beer visibility preferences are not available in this Supabase schema yet.',
      }, { status: 409 })
    }
    console.error('[beer-visibility-preference] POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, supported: true, preference })
}

async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}
