import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    const resolvedUserId = userId || null

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
