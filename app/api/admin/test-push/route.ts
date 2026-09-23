/**
 * POST /api/admin/test-push
 *
 * Admin endpoint: inspect targets or send a one-off push to one selected user.
 * Gated by signed-in admin auth. Defaults to dry-run so implementation/testing
 * never contacts real devices unless an admin explicitly opts into a live send.
 *
 * Body (inspect): { action: 'inspect', user_id }
 * Body (send):    { action: 'send', user_id, title, body, dry_run?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { requireAdminUser } from '@/lib/access'
import { sendExpoPush } from '@/lib/expo-push'
import { createServiceClient } from '@/lib/supabase-server'

const supabase = createServiceClient()

type WebSubscriptionRow = {
  user_id: string
  subscription: string | null
}

type ExpoTokenRow = {
  token: string
  platform: string | null
  device_id: string | null
  created_at: string | null
  updated_at: string | null
}

type NotificationPrefs = {
  user_id?: string
  daily_beer?: boolean
  social_all?: boolean
  social_new_comment?: boolean
  social_new_reaction?: boolean
  social_reaction_to_your_items?: boolean
  social_comment_on_your_items?: boolean
}

function configureWebPush() {
  const subject = process.env.VAPID_EMAIL
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!subject || !publicKey || !privateKey) {
    throw new Error('Web push is not configured. Set VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY.')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
}

async function getPushReadiness(userId: string) {
  const [{ data: profile }, { data: webSubscriptions, error: webError }, { data: expoTokens, error: expoError }, { data: prefs, error: prefsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, first_name, last_name, email, status, tier')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .eq('user_id', userId),
    supabase
      .from('expo_push_tokens')
      .select('token, platform, device_id, created_at, updated_at')
      .eq('user_id', userId),
    supabase
      .from('notification_preferences')
      .select('user_id, daily_beer, social_all, social_new_comment, social_new_reaction, social_reaction_to_your_items, social_comment_on_your_items')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (webError) throw new Error(`web subscription lookup failed: ${webError.message}`)
  if (expoError) throw new Error(`Expo token lookup failed: ${expoError.message}`)
  if (prefsError) throw new Error(`notification preferences lookup failed: ${prefsError.message}`)

  return {
    profile: profile ?? null,
    webSubscriptions: (webSubscriptions ?? []) as WebSubscriptionRow[],
    expoTokens: (expoTokens ?? []) as ExpoTokenRow[],
    prefs: (prefs ?? null) as NotificationPrefs | null,
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(supabase, req.headers.get('authorization'))
  if ('error' in auth) return auth.error

  let body: { action?: unknown; user_id?: unknown; title?: unknown; body?: unknown; dry_run?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : 'inspect'
  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : null

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

  let readiness: Awaited<ReturnType<typeof getPushReadiness>>
  try {
    readiness = await getPushReadiness(userId)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  if (!readiness.profile) {
    return NextResponse.json({ error: 'Selected user was not found' }, { status: 404 })
  }

  const validWebTargets = readiness.webSubscriptions.filter(row => Boolean(row.subscription))
  const dailyBeerEnabled = readiness.prefs?.daily_beer !== false
  const summary = {
    webTargets: validWebTargets.length,
    expoTargets: readiness.expoTokens.length,
    dailyBeerEnabled,
  }

  if (action === 'inspect') {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      profile: readiness.profile,
      targets: {
        web: validWebTargets.map(() => ({ hasSubscription: true })),
        expo: readiness.expoTokens.map(row => ({
          platform: row.platform,
          device_id: row.device_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
      },
      prefs: readiness.prefs,
      summary,
    })
  }

  if (action === 'send') {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const bodyText = typeof body.body === 'string' ? body.body.trim() : ''
    const dryRun = body.dry_run !== false

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        sent: 0,
        skipped: validWebTargets.length + readiness.expoTokens.length,
        failed: [],
        web: { sent: 0, skipped: validWebTargets.length, failed: [] },
        expo: { sent: 0, skipped: readiness.expoTokens.length, failed: [] },
        summary,
      })
    }

    const eligibleWebSubscriptions = dailyBeerEnabled ? validWebTargets : []
    let webSent = 0
    const webFailed: string[] = []
    let webConfigured = true

    if (eligibleWebSubscriptions.length > 0) {
      try {
        configureWebPush()
        await Promise.allSettled(
          eligibleWebSubscriptions.map(async row => {
            if (!row.subscription) return
            try {
              const sub = JSON.parse(row.subscription)
              const payload = JSON.stringify({ title, body: bodyText, url: '/', userId, oneOff: true })
              await webpush.sendNotification(sub, payload)
              webSent++
            } catch (err) {
              webFailed.push(err instanceof Error ? err.message : String(err))
            }
          }),
        )
      } catch (err) {
        webConfigured = false
        webFailed.push(err instanceof Error ? err.message : String(err))
      }
    }

    const expoResult = await sendExpoPush({
      supabase,
      userIds: [userId],
      title,
      body: bodyText,
      url: '/',
      category: 'daily_beer',
      data: { oneOff: true },
    }).catch(err => ({
      sent: 0,
      skipped: 0,
      failed: [err instanceof Error ? err.message : String(err)],
    }))

    return NextResponse.json({
      ok: true,
      dryRun: false,
      sent: webSent + expoResult.sent,
      skipped: (dailyBeerEnabled ? validWebTargets.length - eligibleWebSubscriptions.length : validWebTargets.length) + expoResult.skipped,
      failed: [...webFailed, ...expoResult.failed],
      web: {
        sent: webSent,
        skipped: dailyBeerEnabled ? validWebTargets.length - eligibleWebSubscriptions.length : validWebTargets.length,
        failed: webFailed,
        configured: webConfigured,
      },
      expo: expoResult,
      summary,
    })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
