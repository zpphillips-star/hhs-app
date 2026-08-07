export type MembershipTier = 'hallowed' | 'oddballs' | 'unknown' | 'logged_out'
export type BeerVisibilityPreference = 'participating_only' | 'all'

export type BeerVisibilityProfile = {
  tier: MembershipTier
  rawTier: string | null
  preference: BeerVisibilityPreference | null
  effectivePreference: BeerVisibilityPreference
  preferenceColumnAvailable: boolean | null
}

export const DEFAULT_BEER_VISIBILITY_PROFILE: BeerVisibilityProfile = {
  tier: 'logged_out',
  rawTier: null,
  preference: null,
  effectivePreference: 'all',
  preferenceColumnAvailable: null,
}

export function normalizeMembershipTier(tier: string | null | undefined): MembershipTier {
  const normalized = (tier ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!normalized) return 'unknown'
  if (['hallowed', 'full', 'fullsociety', 'hallowedsociety', 'hallowedmember', 'all31', '31'].includes(normalized)) {
    return 'hallowed'
  }
  if (['oddballs', 'oddball', 'odd', 'oddbeer', 'oddbeers', 'oddsonly', 'odddays', '16'].includes(normalized)) {
    return 'oddballs'
  }
  return 'unknown'
}

export function normalizeBeerVisibilityPreference(
  preference: string | null | undefined,
): BeerVisibilityPreference | null {
  const normalized = (preference ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_')
  if (['all', 'show_all', 'show_all_31', 'full_calendar'].includes(normalized)) return 'all'
  if (['participating_only', 'participating', 'included', 'included_only', 'odd_only', 'odds_only'].includes(normalized)) {
    return 'participating_only'
  }
  return null
}

export function getEffectiveBeerVisibilityPreference(
  tier: MembershipTier,
  preference: BeerVisibilityPreference | null,
): BeerVisibilityPreference {
  if (preference) return preference
  if (tier === 'oddballs') return 'participating_only'
  return 'all'
}

export function isParticipatingBeerDay(
  tier: MembershipTier,
  dayNumber: number | null | undefined,
): boolean {
  if (!dayNumber) return true
  if (tier === 'oddballs') return dayNumber % 2 === 1
  return true
}

export function canShowBeerDetails(
  profile: Pick<BeerVisibilityProfile, 'effectivePreference' | 'tier'>,
  dayNumber: number | null | undefined,
): boolean {
  if (profile.effectivePreference === 'all') return true
  return isParticipatingBeerDay(profile.tier, dayNumber)
}

export function canInteractWithBeer(
  profile: Pick<BeerVisibilityProfile, 'tier'>,
  dayNumber: number | null | undefined,
): boolean {
  return isParticipatingBeerDay(profile.tier, dayNumber)
}

export function getBeerAccessMessage(
  profile: Pick<BeerVisibilityProfile, 'tier'>,
  dayNumber: number | null | undefined,
): string | null {
  if (profile.tier !== 'oddballs' || !dayNumber || dayNumber % 2 === 1) return null
  return 'Oddballs members participate on odd days. You can peek at this Full Society beer, but rating and beer-specific Wall posts are reserved for Hallowed members.'
}

export function isMissingBeerVisibilityColumnError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  const message = (error.message ?? '').toLowerCase()
  return (
    ['42703', 'PGRST200', 'PGRST202', 'PGRST204'].includes(error.code ?? '') ||
    message.includes('beer_visibility_preference') ||
    (message.includes('column') && message.includes('not found'))
  )
}
