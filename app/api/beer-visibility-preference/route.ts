import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getEffectiveBeerVisibilityPreference,
  isMissingBeerVisibilityColumnError,
  normalizeBeerVisibilityPreference,
  normalizeMembershipTier,
  type BeerVisibilityPreference,
} from '@/lib/membership'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id query param required' }, { status: 400 })
  }

  const { data: tierRow, error: tierError } = await supabase
    .from('profiles')
    .select('tier')
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
    preference,
    effectivePreference: getEffectiveBeerVisibilityPreference(tier, preference),
  })
}

export async function POST(req: NextRequest) {
  let body: { user_id?: unknown; preference?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : null
  const preference = normalizeBeerVisibilityPreference(typeof body.preference === 'string' ? body.preference : null)

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }
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
