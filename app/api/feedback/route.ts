import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminUser } from '@/lib/access'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// GET /api/feedback — list all feedback (public) or report admin status.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('adminStatus') === '1') {
    const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
    return NextResponse.json({ isAdmin: !('error' in auth) }, { status: 'error' in auth ? 403 : 200 })
  }

  const { data, error } = await supabase
    .from('feedback')
    .select('id, title, description, name, status, image_urls, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

// POST /api/feedback — submit new feedback (public)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, name, image_urls } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      title: title.trim().slice(0, 200),
      description: typeof description === 'string' ? description.trim().slice(0, 2000) || null : null,
      name: typeof name === 'string' ? name.trim().slice(0, 100) || null : null,
      image_urls: Array.isArray(image_urls) && image_urls.length > 0 ? image_urls : null,
      status: 'submitted',
    })
    .select('id, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/feedback?id=... — legacy admin status update used by older admin UI.
export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 })

  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

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
