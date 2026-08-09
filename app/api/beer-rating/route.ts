import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { canUserInteractWithBeerId, requireBearerUser } from '@/lib/access'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { beer_id?: unknown; stars?: unknown; notes?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const beerId = typeof body.beer_id === 'string' ? body.beer_id.trim() : ''
  const stars = typeof body.stars === 'number' ? body.stars : Number(body.stars)
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null

  if (!beerId) return NextResponse.json({ error: 'beer_id is required' }, { status: 400 })
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: 'stars must be an integer from 1 to 5' }, { status: 400 })
  }

  const access = await canUserInteractWithBeerId(supabase, auth.user.id, beerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await supabase
    .from('ratings')
    .upsert(
      { user_id: auth.user.id, beer_id: beerId, stars, notes },
      { onConflict: 'user_id,beer_id' },
    )
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rating: data })
}
