/**
 * lib/expo-push.ts
 *
 * Server-side helper for sending HHS native push notifications.
 * Supports existing Expo tokens and direct Android FCM tokens.
 * All errors are surfaced/logged — no silent failures.
 */

import { GoogleAuth } from 'google-auth-library'
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

type TokenRow = {
  user_id: string
  token: string
  platform: string | null
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
 * social_all is NOT a gate — it is a UI convenience toggle only.
 * Delivery is controlled exclusively by each category's own column.
 */
function prefColumn(category: NotificationCategory): string {
  return category // column names match category names 1:1
}

function inferTokenProvider(token: string, platform: string | null) {
  if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) {
    return 'expo' as const
  }
  if (platform === 'android') {
    return 'fcm' as const
  }
  return 'unknown' as const
}

function normalizeFcmData(data: Record<string, unknown> | undefined, opts: SendPushOptions) {
  const normalized: Record<string, string> = {
    url: opts.url ?? '/',
    category: opts.category,
    title: opts.title,
    body: opts.body,
    channelId: 'hhs-updates',
  }

  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') {
      normalized[key] = value
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = String(value)
      continue
    }
    if (value != null) {
      normalized[key] = JSON.stringify(value)
    }
  }

  return normalized
}

function getFcmCredentials() {
  const raw = process.env.HHS_FCM_SERVICE_ACCOUNT_JSON
    ?? process.env.FCM_SERVICE_ACCOUNT_JSON
    ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON

  if (!raw) return null

  const parsed = JSON.parse(raw) as {
    project_id?: string
    client_email?: string
    private_key?: string
  }

  const projectId = process.env.HHS_FCM_PROJECT_ID ?? parsed.project_id
  if (!projectId || !parsed.client_email || !parsed.private_key) {
    throw new Error('FCM service account JSON is missing project_id, client_email, or private_key.')
  }

  return {
    projectId,
    credentials: {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    },
  }
}

async function sendDirectFcmPush(targets: TokenRow[], opts: SendPushOptions) {
  if (targets.length === 0) {
    return { sent: 0, failed: [] as string[] }
  }

  const config = getFcmCredentials()
  if (!config) {
    return {
      sent: 0,
      failed: ['FCM service account credentials are not configured on the server.'],
    }
  }

  const auth = new GoogleAuth({
    credentials: config.credentials,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })
  const accessToken = await auth.getAccessToken()
  if (!accessToken) {
    throw new Error('Could not obtain a Google access token for Firebase Cloud Messaging.')
  }

  let sent = 0
  const failed: string[] = []

  for (const target of targets) {
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: target.token,
              notification: {
                title: opts.title,
                body: opts.body,
              },
              data: normalizeFcmData(opts.data, opts),
              android: {
                priority: 'high',
                notification: {
                  channelId: 'hhs-updates',
                  sound: 'default',
                },
              },
            },
          }),
        }
      )

      if (!response.ok) {
        const text = await response.text()
        failed.push(`FCM ${response.status} for ${target.user_id}: ${text}`)
        continue
      }

      sent++
    } catch (err) {
      failed.push(err instanceof Error ? err.message : String(err))
    }
  }

  return { sent, failed }
}

/**
 * Send native push notifications to one or more users for a given category.
 * Only sends if the user has a registered push token and their preferences allow it.
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
    .select('user_id, token, platform')
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
  const eligibleTargets: TokenRow[] = []
  let skipped = 0
  const failed: string[] = []

  const hasDirectAndroidTokenByUser = new Set(
    tokenRows
      .filter(row => inferTokenProvider(row.token, row.platform) === 'fcm')
      .map(row => row.user_id)
  )

  for (const row of tokenRows) {
    // Apply excludeUserIds list (e.g. skip the actor who triggered the event)
    if (excludeSet.has(row.user_id)) {
      skipped++
      continue
    }
    const prefs = prefMap[row.user_id]
    if (prefs) {
      // User has explicit preferences — check only the category's own toggle.
      // social_all is a UI select-all convenience; it does NOT gate delivery.
      const catEnabled = prefs[col] !== false
      if (!catEnabled) {
        skipped++
        continue
      }
    }
    const provider = inferTokenProvider(row.token, row.platform)
    if (provider === 'expo' && row.platform === 'android' && hasDirectAndroidTokenByUser.has(row.user_id)) {
      skipped++
      continue
    }

    if (provider === 'unknown') {
      skipped++
      failed.push(`Unsupported push token for user ${row.user_id}`)
      continue
    }

    eligibleTargets.push(row)
  }

  if (eligibleTargets.length === 0) {
    return { sent: 0, skipped, failed }
  }

  const expoTargets = eligibleTargets.filter(target => inferTokenProvider(target.token, target.platform) === 'expo')
  const fcmTargets = eligibleTargets.filter(target => inferTokenProvider(target.token, target.platform) === 'fcm')

  // 4. Build Expo messages (batch-friendly)
  const messages: ExpoMessage[] = expoTargets.map(({ token: to }) => ({
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

  if (messages.length > 0) {
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
  }

  if (fcmTargets.length > 0) {
    try {
      const fcmResult = await sendDirectFcmPush(fcmTargets, opts)
      sent += fcmResult.sent
      failed.push(...fcmResult.failed)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[expo-push] direct FCM error:', msg)
      failed.push(msg)
    }
  }

  return { sent, skipped, failed }
}
