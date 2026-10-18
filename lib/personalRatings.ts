export type PersonalRating = { user_id: string; beer_id: string; stars: number }
export type RatingBadgeStars = 1 | 2 | 3 | 4 | 5

export function ratingBadgeStars(stars: number | undefined): RatingBadgeStars | null {
  return stars !== undefined && Number.isInteger(stars) && stars >= 1 && stars <= 5
    ? stars as RatingBadgeStars : null
}

export function ratingBadgeLabel(stars: RatingBadgeStars) {
  return `You rated this beer ${stars} out of 5 stars`
}

// An in-memory, identity-scoped snapshot. Replacing it on refresh also removes deleted ratings.
export function createPersonalRatingsStore(
  userId: string | null,
  load: (userId: string) => Promise<PersonalRating[]>,
) {
  let snapshot: ReadonlyMap<string, PersonalRating> = new Map()
  let revision = 0
  const listeners = new Set<() => void>()
  const publish = (rows: PersonalRating[]) => {
    snapshot = new Map(rows.filter(row => row.user_id === userId).map(row => [row.beer_id, row]))
    listeners.forEach(listener => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    invalidate() { revision++ },
    async refresh() {
      const request = ++revision
      if (!userId) return
      try {
        const rows = await load(userId)
        if (request === revision) publish(rows)
      } catch {
        if (request === revision) publish([])
      }
    },
    record(row: PersonalRating | null | undefined) {
      if (!userId || !row || row.user_id !== userId) return
      revision++
      publish([...snapshot.values()].filter(value => value.beer_id !== row.beer_id).concat(row))
    },
  }
}
