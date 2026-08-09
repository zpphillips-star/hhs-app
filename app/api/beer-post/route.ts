import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { canUserInteractWithBeerId, requireBearerUser } from '@/lib/access'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const auth = await requireBearerUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { beer_id?: unknown; content?: unknown; photo_url?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const beerId = typeof body.beer_id === 'string' ? body.beer_id.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, 2000) : ''
  const photoUrl = typeof body.photo_url === 'string' && body.photo_url.trim() ? body.photo_url.trim() : null

  if (!beerId) return NextResponse.json({ error: 'beer_id is required' }, { status: 400 })
  if (!content && !photoUrl) return NextResponse.json({ error: 'content or photo_url is required' }, { status: 400 })

  const access = await canUserInteractWithBeerId(supabase, auth.user.id, beerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: auth.user.id,
      beer_id: beerId,
      content,
      photo_url: photoUrl,
    })
    .select('id, user_id, beer_id, content, photo_url, created_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, post: data }, { status: 201 })
}
