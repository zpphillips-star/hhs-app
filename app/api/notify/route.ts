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

async function broadcast(title: string, body: string, url = '/', tiers?: string[]) {
  // Get all push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
  if (!subs || subs.length === 0) return { sent: 0, failed: [], notificationId: null }

  // If tiers specified, filter to only those members
  let filteredSubs = subs
  if (tiers && tiers.length > 0) {
    const userIds = subs.map(s => s.user_id).filter(Boolean)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, tier')
      .in('id', userIds)

    const tierMap: Record<string, string | null> = {}
    for (const p of (profiles || [])) tierMap[p.id] = p.tier

    filteredSubs = subs.filter(s => {
      const tier = tierMap[s.user_id]
      return tiers.includes(tier ?? 'hallowed') // unknown tier treated as hallowed
    })
  }

  if (filteredSubs.length === 0) return { sent: 0, failed: [], notificationId: null }

  // Log the broadcast
  const { data: logEntry } = await supabase
    .from('notification_log')
    .insert({ title, body, url, total_sent: 0 })
    .select('id')
    .single()

  const notificationId = logEntry?.id ?? null

  let sent = 0
  const failed: string[] = []

  await Promise.allSettled(
    filteredSubs.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription)
        const payload = JSON.stringify({ title, body, url, notificationId, userId: row.user_id })
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        failed.push(err instanceof Error ? err.message : String(err))
      }
    })
  )

  if (notificationId) {
    await supabase
      .from('notification_log')
      .update({ total_sent: sent })
      .eq('id', notificationId)
  }

  return { sent, failed, notificationId }
}

// GET — cron-triggered beer notification (tier-aware by day)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  const dayNumber = today.getDate()
  const isOddDay = dayNumber % 2 !== 0

  const { data: beer } = await supabase
    .from('beers')
    .select('name, brewery, style')
    .eq('day_number', dayNumber)
    .maybeSingle()

  const title = '🍺 Your Next Beer is Ready'
  const body = beer
    ? `Day ${dayNumber}: ${beer.name} by ${beer.brewery}`
    : `Day ${dayNumber} beer has been poured. Come rate it!`

  // Odd days: both tiers. Even days: Hallowed only.
  const tiers = isOddDay ? ['hallowed', 'oddballs'] : ['hallowed']
  const result = await broadcast(title, body, '/beers', tiers)
  return NextResponse.json(result)
}

// POST — admin broadcast with explicit tier targeting
export async function POST(req: NextRequest) {
  const { title, body, url, tiers } = await req.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  // tiers: undefined = everyone, ['hallowed'] = Hallowed only, ['oddballs'] = Odd Balls only, ['hallowed','oddballs'] = both
  const result = await broadcast(title, body, url || '/', tiers ?? undefined)
  return NextResponse.json(result)
}

