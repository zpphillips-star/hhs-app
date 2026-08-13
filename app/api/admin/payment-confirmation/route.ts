import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/access'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { member_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const memberId = typeof body.member_id === 'string' ? body.member_id.trim() : ''
  if (!memberId) {
    return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ payment_confirmed_at: new Date().toISOString() })
    .eq('id', memberId)
    .select('id, payment_confirmed_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
