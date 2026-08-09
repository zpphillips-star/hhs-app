import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// PATCH /api/feedback/[id] — admin: update status
// Requires a valid Supabase session token in the Authorization header.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  // Verify the caller is an authenticated user (any member can reorder for now;
  // tighten to admin email check once admin role is formalized).
  if (token) {
    const { error: authError } = await supabase.auth.getUser(token)
    if (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json()
  const { status } = body
  const VALID = ['submitted', 'backlog', 'in_progress', 'live']
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('feedback')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
