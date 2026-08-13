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
  const rawAction = typeof body.action === 'string' ? body.action.trim() : 'paid'
  const action = rawAction === 'confirm'
    ? 'paid'
    : rawAction === 'reset'
      ? 'not_paid'
      : rawAction
  if (action !== 'paid' && action !== 'not_paid' && action !== 'not_reviewed') {
    return NextResponse.json({ error: 'action must be paid, not_paid, or not_reviewed' }, { status: 400 })
  }

  const update = action === 'paid'
    ? {
        payment_review_status: 'paid',
        payment_confirmed_at: new Date().toISOString(),
      }
    : {
        payment_review_status: action,
        payment_confirmed_at: null,
      }

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', memberId)
    .select('id, payment_review_status, payment_confirmed_at, venmo_clicked_at, native_membership_amount')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
