import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const authUserId = await resolveUserId(req)
  if (!authUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription, user_id } = await req.json()
  if (!subscription) {
    return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
  }
  if (user_id && user_id !== authUserId) {
    return NextResponse.json({ error: 'Cannot register browser notifications for another user.' }, { status: 403 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: authUserId, subscription: JSON.stringify(subscription) },
    { onConflict: 'user_id' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await Promise.all([
    supabase.from('profiles').update({ has_notifications: true }).eq('id', authUserId),
    supabase
      .from('notification_preferences')
      .upsert({ user_id: authUserId }, { onConflict: 'user_id', ignoreDuplicates: true }),
  ])

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const authUserId = await resolveUserId(req)
  if (!authUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id } = await req.json()
  if (user_id && user_id !== authUserId) {
    return NextResponse.json({ error: 'Cannot unregister browser notifications for another user.' }, { status: 403 })
  }
  await Promise.all([
    supabase.from('push_subscriptions').delete().eq('user_id', authUserId),
    supabase.from('profiles').update({ has_notifications: false }).eq('id', authUserId),
  ])
  return NextResponse.json({ ok: true })
}

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
