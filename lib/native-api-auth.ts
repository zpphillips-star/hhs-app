import { createClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function getAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('Supabase publishable key is not configured')
  }
  return anonKey
}

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getAnonKey(),
  )
}

export async function getBearerUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null, error: 'missing_token' as const }

  const anonClient = getSupabaseAnon()
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return { user: null, error: 'invalid_token' as const }

  return { user, error: null }
}

export function isAuthorizedForUser(user: User | null, expectedUserId: string | null) {
  return Boolean(user?.id && expectedUserId && user.id === expectedUserId)
}
