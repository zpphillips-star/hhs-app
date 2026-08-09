import { type SupabaseClient, type User } from '@supabase/supabase-js'
import { canInteractWithBeer, normalizeMembershipTier } from '@/lib/membership'

export type AuthResult =
  | { user: User; token: string }
  | { error: Response }

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function requireBearerUser(
  supabase: SupabaseClient,
  authorization: string | null,
): Promise<AuthResult> {
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { error: jsonError('Unauthorized', 401) }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return { error: jsonError('Unauthorized', 401) }

  return { user: data.user, token }
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    [
      process.env.HHS_ADMIN_EMAILS,
      process.env.HHS_ADMIN_EMAIL,
      process.env.NEXT_PUBLIC_HHS_ADMIN_EMAILS,
    ]
      .filter(Boolean)
      .flatMap(value => String(value).split(','))
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminUser(user: User): boolean {
  const appRole = String(user.app_metadata?.role ?? '').toLowerCase()
  if (appRole === 'admin' || user.app_metadata?.admin === true) return true

  const email = (user.email ?? '').trim().toLowerCase()
  const adminEmails = configuredAdminEmails()
  if (email && adminEmails.has(email)) return true

  // Current HHS admin accounts predate a formal admin role. Keep this narrow
  // and server-side only so regular signed-in users cannot move feedback.
  const first = String(user.user_metadata?.first_name ?? '').trim().toLowerCase()
  const last = String(user.user_metadata?.last_name ?? '').trim().toLowerCase()
  return first === 'zach' && last === 'phillips'
}

export async function requireAdminUser(
  supabase: SupabaseClient,
  authorization: string | null,
): Promise<AuthResult> {
  const auth = await requireBearerUser(supabase, authorization)
  if ('error' in auth) return auth
  if (!isAdminUser(auth.user)) return { error: jsonError('Forbidden', 403) }
  return auth
}

export async function canUserInteractWithBeerId(
  supabase: SupabaseClient,
  userId: string,
  beerId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const [{ data: beer, error: beerError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('beers').select('id, day_number').eq('id', beerId).maybeSingle(),
    supabase.from('profiles').select('tier').eq('id', userId).maybeSingle(),
  ])

  if (beerError) return { ok: false, status: 500, error: beerError.message }
  if (!beer) return { ok: false, status: 404, error: 'Beer not found' }
  if (profileError) return { ok: false, status: 500, error: profileError.message }

  const tier = normalizeMembershipTier(profile?.tier)
  if (!canInteractWithBeer({ tier }, beer.day_number)) {
    return {
      ok: false,
      status: 403,
      error: 'Oddballs members can view this beer, but rating and beer-tagged Wall posts are limited to eligible odd-day beers.',
    }
  }

  return { ok: true }
}
