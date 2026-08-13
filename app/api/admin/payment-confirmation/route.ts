import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/access'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { member_id?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const memberId = typeof body.member_id === 'string' ? body.member_id.trim() : ''
  if (!memberId) {
    return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
  }
  const action = typeof body.action === 'string' ? body.action.trim() : 'confirm'
  if (action !== 'confirm' && action !== 'reset') {
    return NextResponse.json({ error: 'action must be confirm or reset' }, { status: 400 })
  }

  const update = action === 'confirm'
    ? { payment_confirmed_at: new Date().toISOString() }
    : {
        payment_confirmed_at: null,
        venmo_clicked_at: null,
        native_membership_amount: null,
      }

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', memberId)
    .select('id, payment_confirmed_at, venmo_clicked_at, native_membership_amount')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
