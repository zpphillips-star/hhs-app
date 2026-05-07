import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// POST — called by the service worker when a notification is clicked
// Body: { notificationId: string, userId?: string }
export async function POST(req: NextRequest) {
  try {
    const { notificationId, userId } = await req.json()

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    }

    // Try to get the authenticated user from session if userId not provided
    let resolvedUserId = userId || null
    if (!resolvedUserId) {
      try {
        const cookieStore = await cookies()
        const sessionSupabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { cookies: { getAll: () => cookieStore.getAll() } }
        )
        const { data: { user } } = await sessionSupabase.auth.getUser()
        resolvedUserId = user?.id || null
      } catch {
        // Service worker context — no session cookie available, that's fine
      }
    }

    // Upsert to avoid duplicates (one open per user per notification)
    await adminSupabase
      .from('notification_opens')
      .upsert(
        { notification_id: notificationId, user_id: resolvedUserId },
        { onConflict: resolvedUserId ? 'notification_id,user_id' : undefined, ignoreDuplicates: true }
      )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('notification-open error:', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
