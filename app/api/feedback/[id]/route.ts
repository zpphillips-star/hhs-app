import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/access'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const FEEDBACK_TABLE = 'feedback_items'

// PATCH /api/feedback/[id] — admin: update status
// Requires a valid Supabase session token in the Authorization header.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  const body = await req.json()
  const { status } = body
  const VALID = ['submitted', 'backlog', 'in_progress', 'live']
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from(FEEDBACK_TABLE)
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
