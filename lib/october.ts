/**
 * Canonical October 2026 Pacific-time date helpers.
 *
 * Oct 1, 2026 00:00 PDT  =  07:00 UTC  (PDT = UTC-7)
 * Safe for both Edge (middleware) and client/server components.
 */
export const OCT_1_2026_UTC_MS = Date.UTC(2026, 9, 1, 7, 0, 0)

/** Returns true while it is still before Oct 1 2026 Pacific midnight. */
export const isBeforeOctober2026 = (): boolean => Date.now() < OCT_1_2026_UTC_MS
