/**
 * lib/supabase-server.ts
 *
 * Server-side Supabase service client using the service/secret key.
 * Supports both SUPABASE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY env
 * var names so local dev (.env.local) and production (Vercel) both work
 * regardless of which naming convention is in use.
 *
 * The native app notification APIs (push-token, notification-preferences,
 * admin/test-push, expo-push) import from here to avoid creating a new
 * client instance on every request.
 */

import { createClient } from '@supabase/supabase-js'

function getServiceKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      'Supabase service key is not configured. Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in your env.'
    )
  }
  return key
}

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getServiceKey()
  )
}
