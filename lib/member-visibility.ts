const HIDDEN_MEMBER_USERNAMES = new Set(['zacula', 'zpphillips'])

export function normalizeUsername(username: string | null | undefined) {
  return username?.trim().toLowerCase() ?? ''
}

export function isHiddenMemberUsername(username: string | null | undefined) {
  return HIDDEN_MEMBER_USERNAMES.has(normalizeUsername(username))
}

export function isVisibleMember(profile: { username?: string | null } | null | undefined) {
  return !isHiddenMemberUsername(profile?.username)
}
