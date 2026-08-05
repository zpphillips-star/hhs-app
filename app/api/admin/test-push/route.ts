/**
 * POST /api/admin/test-push
 *
 * Admin endpoint: inspect tokens/preferences or send a test push to a single user.
 * Gated by CRON_SECRET (same pattern as /api/notify GET).
 *
 * Body (inspect): { action: 'inspect', user_id }
 * Body (send):    { action: 'send', user_id, title, body }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { sendExpoPush } from '@/lib/expo-push'

const supabase = createServiceClient()

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action?: unknown; user_id?: unknown; title?: unknown; body?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : 'inspect'
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : null

  if (!user_id) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  if (action === 'inspect') {
    const [{ data: tokens }, { data: prefs }] = await Promise.all([
      supabase
        .from('expo_push_tokens')
        .select('token, platform, device_id, created_at, updated_at')
        .eq('user_id', user_id),
      supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle(),
    ])
    return NextResponse.json({ ok: true, tokens: tokens ?? [], prefs: prefs ?? null })
  }

  if (action === 'send') {
    const title = typeof body.title === 'string' ? body.title : '🍺 Test Push'
    const bodyText = typeof body.body === 'string' ? body.body : 'This is a test notification from HHS admin.'

    const result = await sendExpoPush({
      supabase,
      userIds: [user_id],
      title,
      body: bodyText,
      url: '/',
      category: 'daily_beer', // use daily_beer so pref check still applies
    })
    return NextResponse.json({ ok: true, ...result })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
