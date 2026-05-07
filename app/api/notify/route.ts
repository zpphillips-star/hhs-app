import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function broadcast(title: string, body: string, url = '/') {
  const { data: subs } = await supabase.from('push_subscriptions').select('subscription, user_id')
  if (!subs || subs.length === 0) return { sent: 0, failed: [], notificationId: null }

  // Log the broadcast first so we have an ID to embed in each payload
  const { data: logEntry } = await supabase
    .from('notification_log')
    .insert({ title, body, url, total_sent: 0 })
    .select('id')
    .single()

  const notificationId = logEntry?.id ?? null

  let sent = 0
  const failed: string[] = []

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription)
        // Each subscriber gets their own userId embedded so click tracking knows who opened it
        const payload = JSON.stringify({ title, body, url, notificationId, userId: row.user_id })
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        failed.push(err instanceof Error ? err.message : String(err))
      }
    })
  )

  // Update the log with actual sent count
  if (notificationId) {
    await supabase
      .from('notification_log')
      .update({ total_sent: sent })
      .eq('id', notificationId)
  }

  return { sent, failed, notificationId }
}

// GET — scheduled daily beer notification (cron)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const dayNumber = today.getDate()
  const { data: beer } = await supabase
    .from('beers')
    .select('name, brewery, style')
    .eq('day_number', dayNumber)
    .maybeSingle()

  const title = '🍺 Today\'s Beer is Ready'
  const body = beer
    ? `Day ${dayNumber}: ${beer.name} by ${beer.brewery}`
    : `Day ${dayNumber} beer has been poured. Come rate it!`

  const result = await broadcast(title, body, '/beers')
  return NextResponse.json(result)
}

// POST — on-demand broadcast from admin panel (or ZAP)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, body, url } = await req.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const result = await broadcast(title, body, url || '/')
  return NextResponse.json(result)
}
