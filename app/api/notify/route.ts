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

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get today's beer
  const today = new Date()
  const dayNumber = today.getDate() // 1-31
  const { data: beer } = await supabase
    .from('beers')
    .select('name, brewery, style')
    .eq('day_number', dayNumber)
    .maybeSingle()

  const title = '🍺 Today\'s Beer is Ready'
  const body = beer
    ? `Day ${dayNumber}: ${beer.name} by ${beer.brewery}`
    : `Day ${dayNumber} beer has been poured. Come rate it!`

  // Get all subscriptions
  const { data: subs } = await supabase.from('push_subscriptions').select('subscription')
  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({ title, body, url: '/beers' })
  let sent = 0
  const failed: string[] = []

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription)
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        failed.push(err instanceof Error ? err.message : String(err))
      }
    })
  )

  return NextResponse.json({ sent, failed })
}
