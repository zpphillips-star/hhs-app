/**
 * HHS pre-October redirect middleware.
 *
 * While the current UTC time is before Oct 1 2026 00:00 PDT (= 07:00 UTC),
 * visiting "/" is redirected to "/pre-october".
 * On/after Oct 1 the middleware is a no-op and the existing home/Today page serves normally.
 *
 * Intentionally narrow: only matches "/", touches no other routes.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { OCT_1_2026_UTC_MS } from '@/lib/october'

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/' && Date.now() < OCT_1_2026_UTC_MS) {
    return NextResponse.redirect(new URL('/pre-october', request.url))
  }
  return NextResponse.next()
}

export const config = {
  /** Only run on the root path — no other routes affected. */
  matcher: ['/'],
}
