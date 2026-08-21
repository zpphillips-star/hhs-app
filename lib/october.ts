/**
 * Canonical October 2026 Pacific-time date helpers.
 *
 * Oct 1, 2026 00:00 PDT  =  07:00 UTC  (PDT = UTC-7)
 * Safe for both Edge (middleware) and client/server components.
 */
export const OCT_1_2026_UTC_MS = Date.UTC(2026, 9, 1, 7, 0, 0)

/** Returns true while it is still before Oct 1 2026 Pacific midnight. */
export const isBeforeOctober2026 = (): boolean => Date.now() < OCT_1_2026_UTC_MS

const PACIFIC_TIME_ZONE = 'America/Los_Angeles'

export type PacificDateParts = {
  year: number
  month: number
  day: number
}

const pacificDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: PACIFIC_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

/** Returns the current date components in Pacific time to avoid UTC day rollover bugs. */
export function getPacificDateParts(date = new Date()): PacificDateParts {
  const parts = pacificDateFormatter.formatToParts(date)
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}

  for (const part of parts) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      values[part.type] = Number(part.value)
    }
  }

  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
  }
}

/** Returns true only during October 2026 in Pacific time. */
export function isOctober2026Pacific(date = new Date()): boolean {
  const pacificDate = getPacificDateParts(date)
  return pacificDate.year === 2026 && pacificDate.month === 10
}
