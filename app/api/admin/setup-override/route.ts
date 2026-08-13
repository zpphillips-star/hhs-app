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

  const action = typeof body.action === 'string' ? body.action.trim() : ''
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ error: 'action must be enable or disable' }, { status: 400 })
  }

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('id, status')
    .eq('id', memberId)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (existing.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved members can receive an entry override.' }, { status: 400 })
  }

  const update = action === 'enable'
    ? {
        setup_override_at: new Date().toISOString(),
        setup_override_by: auth.user.id,
      }
    : {
        setup_override_at: null,
        setup_override_by: null,
      }

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', memberId)
    .select('id, setup_override_at, setup_override_by')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data })
}
