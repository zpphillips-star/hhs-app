import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { sendExpoPush } from '@/lib/expo-push'

function configureWebPush() {
  const subject = process.env.VAPID_EMAIL
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    throw new Error('Web push is not configured. Set VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

async function broadcast(title: string, body: string, url = '/', tiers?: string[]) {
  try {
    configureWebPush()
  } catch (err) {
    return {
      sent: 0,
      failed: [err instanceof Error ? err.message : String(err)],
      skipped: 0,
      notificationId: null,
      configured: false,
    }
  }

  // Get all push subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription, user_id')
  if (!subs || subs.length === 0) return { sent: 0, failed: [], skipped: 0, notificationId: null, configured: true }

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

  if (filteredSubs.length === 0) return { sent: 0, failed: [], skipped: 0, notificationId: null, configured: true }

  const filteredUserIds = filteredSubs.map(s => s.user_id).filter(Boolean)
  const { data: prefRows, error: prefErr } = await supabase
    .from('notification_preferences')
    .select('user_id, daily_beer')
    .in('user_id', filteredUserIds)
  if (prefErr) {
    return {
      sent: 0,
      failed: [`notification_preferences lookup failed: ${prefErr.message}`],
      skipped: filteredSubs.length,
      notificationId: null,
      configured: true,
    }
  }

  const prefMap: Record<string, { daily_beer?: boolean }> = {}
  for (const pref of prefRows ?? []) prefMap[pref.user_id] = pref
  const eligibleSubs = filteredSubs.filter(row => prefMap[row.user_id]?.daily_beer !== false)
  const skipped = filteredSubs.length - eligibleSubs.length

  if (eligibleSubs.length === 0) return { sent: 0, failed: [], skipped, notificationId: null, configured: true }

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
    eligibleSubs.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription)
        const payload = JSON.stringify({ title, body, url, notificationId, userId: row.user_id })
        await webpush.sendNotification(sub, payload)
        sent++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          // Subscription is gone — clean it out so setup re-triggers for this user
          await supabase.from('push_subscriptions').delete().eq('user_id', row.user_id)
          await supabase.from('profiles').update({ has_notifications: false }).eq('id', row.user_id)
        }
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

  return { sent, failed, skipped, notificationId, configured: true }
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
  const webResult = await broadcast(title, body, '/beers', tiers)

  // Also send to Expo (native) push tokens, respecting daily_beer preference
  const expoResult = await sendExpoPush({
    supabase,
    // userIds omitted = all registered tokens (preferences filter applied inside)
    title,
    body,
    url: '/beers',
    category: 'daily_beer',
  }).catch(err => {
    console.error('[notify] expo push error:', err instanceof Error ? err.message : err)
    return { sent: 0, skipped: 0, failed: [String(err)] }
  })

  return NextResponse.json({ web: webResult, expo: expoResult })
}

// POST — admin broadcast with explicit tier targeting
export async function POST(req: NextRequest) {
  const { title, body, url, tiers } = await req.json()
  if (!title || !body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  // tiers: undefined = everyone, ['hallowed'] = Hallowed only, ['oddballs'] = Odd Balls only, ['hallowed','oddballs'] = both
  const webResult = await broadcast(title, body, url || '/', tiers ?? undefined)

  // Also broadcast to Expo tokens
  const expoResult = await sendExpoPush({
    supabase,
    title,
    body,
    url: url || '/',
    category: 'daily_beer',
  }).catch(err => {
    console.error('[notify] expo push broadcast error:', err instanceof Error ? err.message : err)
    return { sent: 0, skipped: 0, failed: [String(err)] }
  })

  return NextResponse.json({ web: webResult, expo: expoResult })
}

