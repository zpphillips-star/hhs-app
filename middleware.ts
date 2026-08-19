/**
 * HHS middleware.
 *
 * The pre-October authenticated-member redirect was previously handled here,
 * but doing so also redirected unauthenticated public visitors away from the
 * public landing page at "/".  That was a regression.
 *
 * The redirect is now handled client-side inside app/page.tsx, gated on
 * confirmed auth state, so anonymous visitors always reach the public page.
 *
 * This file is intentionally a pass-through; it is kept so the module
 * boundary and import of OCT_1_2026_UTC_MS remain intact for future use.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  /** No routes actively intercepted — middleware is a pass-through. */
  matcher: [],
}
