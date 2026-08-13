import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/access'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { member_ids?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const memberIds = Array.isArray(body.member_ids)
    ? Array.from(new Set(
        body.member_ids
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map(id => id.trim()),
      ))
    : []

  if (memberIds.length === 0) {
    return NextResponse.json({ emails: {} })
  }

  if (memberIds.length > 200) {
    return NextResponse.json({ error: 'Too many member ids' }, { status: 400 })
  }

  const emails: Record<string, string | null> = {}
  await Promise.all(memberIds.map(async id => {
    const { data } = await supabase.auth.admin.getUserById(id)
    emails[id] = data?.user?.email ?? null
  }))

  return NextResponse.json({ emails })
}
