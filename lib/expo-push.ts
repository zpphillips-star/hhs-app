/**
 * lib/expo-push.ts
 *
 * Server-side helper for sending Expo push notifications.
 * Respects per-user notification_preferences and expo_push_tokens.
 * All errors are surfaced/logged — no silent failures.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase-server'

export type NotificationCategory =
  | 'daily_beer'
  | 'social_new_comment'
  | 'social_new_reaction'
  | 'social_reaction_to_your_items'
  | 'social_comment_on_your_items'

export type SendPushOptions = {
  /** Supabase service-role client to use (passed in to avoid re-creating per call) */
  supabase?: SupabaseClient
  /** Target specific user IDs; omit or pass [] to broadcast to all */
  userIds?: string[]
  /** User IDs to exclude from the send (e.g. the actor who triggered the event) */
  excludeUserIds?: string[]
  title: string
  body: string
  /** Deep-link path within the app, e.g. '/beers' */
  url?: string
  /** Extra data forwarded to the app */
  data?: Record<string, unknown>
  /** Category used to gate by user preference */
  category: NotificationCategory
}

type ExpoMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default'
  channelId?: string
}

type ExpoTicket = {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

type ExpoResponse = {
  data: ExpoTicket[]
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

function getServiceClient(): SupabaseClient {
  return createServiceClient()
}

/**
 * Returns the Supabase column name that controls this category.
 * Daily Beer is controlled by daily_beer.
 * Social native pushes are controlled by both social_all and the category column.
 */
function prefColumn(category: NotificationCategory): string {
  const columnMap: Record<NotificationCategory, string> = {
    daily_beer: 'daily_beer',
    social_new_comment: 'social_new_comment',
    social_new_reaction: 'social_new_reaction',
    social_reaction_to_your_items: 'social_reaction_to_your_items',
    social_comment_on_your_items: 'social_comment_on_your_items',
  }
  return columnMap[category]
}

/**
 * Send Expo push notifications to one or more users for a given category.
 * Only sends if the user has an expo_push_token AND their preferences allow it.
 */
export async function sendExpoPush(opts: SendPushOptions): Promise<{
  sent: number
  skipped: number
  failed: string[]
}> {
  const sb = opts.supabase ?? getServiceClient()
  const userIds = opts.userIds ?? []
  const excludeSet = new Set(opts.excludeUserIds ?? [])

  // 1. Fetch tokens — if userIds provided, filter; else fetch all
  let tokenQuery = sb
    .from('expo_push_tokens')
    .select('user_id, token')
  if (userIds.length > 0) {
    tokenQuery = tokenQuery.in('user_id', userIds)
  }
  const { data: tokenRows, error: tokenErr } = await tokenQuery
  if (tokenErr) {
    console.error('[expo-push] token fetch error:', tokenErr.message)
    throw new Error(`expo-push token fetch failed: ${tokenErr.message}`)
  }
  if (!tokenRows || tokenRows.length === 0) {
    return { sent: 0, skipped: 0, failed: [] }
  }

  const tokenUserIds = tokenRows.map(r => r.user_id)

  // 2. Fetch preferences for these users
  const { data: prefRows, error: prefErr } = await sb
    .from('notification_preferences')
    .select('user_id, daily_beer, social_all, social_new_comment, social_new_reaction, social_reaction_to_your_items, social_comment_on_your_items')
    .in('user_id', tokenUserIds)
  if (prefErr) {
    console.error('[expo-push] prefs fetch error:', prefErr.message)
    throw new Error(`expo-push prefs fetch failed: ${prefErr.message}`)
  }

  // Build preference map — users with NO row default to all-enabled
  const prefMap: Record<string, Record<string, boolean>> = {}
  for (const p of prefRows ?? []) {
    prefMap[p.user_id] = p
  }

  const col = prefColumn(opts.category)

  // 3. Filter tokens by preference
  const eligibleTokens: string[] = []
  let skipped = 0

  for (const row of tokenRows) {
    // Apply excludeUserIds list (e.g. skip the actor who triggered the event)
    if (excludeSet.has(row.user_id)) {
      skipped++
      continue
    }
    const prefs = prefMap[row.user_id]
    if (prefs) {
      // User has explicit preferences — check the category toggle.
      // For social native pushes, the master social_enabled toggle also gates delivery.
      const catEnabled = prefs[col] !== false
      const socialEnabled = opts.category === 'daily_beer' || prefs.social_all !== false
      if (!catEnabled || !socialEnabled) {
        skipped++
        continue
      }
    }
    // No pref row → defaults to enabled
    eligibleTokens.push(row.token)
  }

  if (eligibleTokens.length === 0) {
    return { sent: 0, skipped, failed: [] }
  }

  // 4. Build Expo messages (batch-friendly)
  const messages: ExpoMessage[] = eligibleTokens.map(to => ({
    to,
    title: opts.title,
    body: opts.body,
    sound: 'default',
    channelId: 'hhs-updates',
    data: {
      url: opts.url ?? '/',
      category: opts.category,
      ...(opts.data ?? {}),
    },
  }))

  // 5. POST to Expo push endpoint (batches of 100)
  const BATCH_SIZE = 100
  let sent = 0
  const failed: string[] = []

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      })

      if (!res.ok) {
        const text = await res.text()
        const msg = `Expo push HTTP ${res.status}: ${text}`
        console.error('[expo-push]', msg)
        failed.push(msg)
        continue
      }

      const json = (await res.json()) as ExpoResponse
      for (const ticket of json.data ?? []) {
        if (ticket.status === 'ok') {
          sent++
        } else {
          const msg = ticket.message ?? ticket.details?.error ?? 'unknown ticket error'
          console.error('[expo-push] ticket error:', msg)
          failed.push(msg)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[expo-push] fetch error:', msg)
      failed.push(msg)
    }
  }

  return { sent, skipped, failed }
}
