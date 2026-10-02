import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIME_ZONE = 'America/Los_Angeles'
const CAMPAIGN_YEAR = Number(process.env.WALL_GOBLIN_YEAR || '2026')
const FIRST_POST_DATE = `${CAMPAIGN_YEAR}-10-02`
const FINAL_POST_DATE = `${CAMPAIGN_YEAR}-11-01`
const MAX_POST_CONTENT_LENGTH = 2000
const MARKER_PREFIX = 'Goblin receipt:'
const PAGE_SIZE = 1000
const MAX_SNIPPET_LENGTH = 180
const GOBLIN_MEMORY_LOOKBACK = 7

type BeerRow = {
  id: string
  day_number: number
  name: string
  brewery: string
  style: string | null
  abv: number | null
}

type BaseActivityRow = {
  user_id: string | null
}

type OpenActivityRow = BaseActivityRow & {
  opened_at: string
}

type PostActivityRow = BaseActivityRow & {
  id: string
  beer_id: string | null
  content: string | null
  created_at: string
}

type RelatedPostRow = {
  user_id: string | null
  beer_id: string | null
  content: string | null
} | null

type CommentActivityRow = BaseActivityRow & {
  id: string
  post_id: string
  content: string | null
  created_at: string
  posts?: RelatedPostRow
}

type ReactionActivityRow = BaseActivityRow & {
  id: string
  post_id: string
  reaction?: string | null
  created_at: string
  posts?: RelatedPostRow
}

type RatingActivityRow = BaseActivityRow & {
  stars?: number | null
  notes?: string | null
  created_at: string
}

type ProfileRow = {
  id: string
  username: string | null
  display_name?: string | null
}

type MemberActivity = {
  userId: string
  label: string
  username: string | null
  displayName: string | null
  score: number
  counts: {
    posts: number
    comments: number
    reactions: number
    ratings: number
    opens: number
  }
  posts: string[]
  comments: string[]
  reactions: string[]
  ratings: string[]
  callbacks: string[]
  standout: string[]
  earliestActivityLocal: string | null
  latestActivityLocal: string | null
  timingRole: string | null
  contentThemes: string[]
  evidence: ActivityEvidence[]
}

type ActivityKind = 'post' | 'comment' | 'reaction' | 'rating' | 'open'

type ActivityEvidence = {
  kind: ActivityKind
  createdAt: string
  localTime: string
  orderLabel: string
  timingLabel: string
  text: string | null
  context: string | null
}

type GoblinMemoryEntry = {
  recapDate: string | null
  content: string
}

type RecapContext = {
  postDate: string
  recapDate: string
  beer: BeerRow
  counts: {
    posts: number
    comments: number
    reactions: number
    clicks: number
    ratings: number
  }
  reactionCounts: Record<string, number>
  usernamesById: Map<string, string>
  labelsById: Map<string, string>
  topUsername: string | null
  memberActivity: MemberActivity[]
  goblinMemory: GoblinMemoryEntry[]
  posts: Array<{
    author: string
    content: string
    beerId: string | null
    createdAt: string
    localTime: string
    orderLabel: string
    timingLabel: string
  }>
  comments: Array<{
    author: string
    content: string
    postAuthor: string | null
    postSnippet: string | null
    createdAt: string
    localTime: string
    orderLabel: string
    timingLabel: string
  }>
  reactions: Array<{
    author: string
    reaction: string
    postAuthor: string | null
    postSnippet: string | null
    createdAt: string
    localTime: string
    orderLabel: string
    timingLabel: string
  }>
}

type RecapResponse = {
  ok: boolean
  dryRun: boolean
  inserted: boolean
  skipped?: boolean
  reason?: string
  postDate: string
  recapDate: string
  activityWindowUtc?: { start: string; end: string }
  beer?: Pick<BeerRow, 'day_number' | 'name' | 'brewery' | 'style'>
  content?: string
  existingPostId?: string
  postId?: string
  warnings?: string[]
}

const supabase = createServiceClient()

export async function GET(req: NextRequest) {
  return handleWallGoblin(req)
}

export async function POST(req: NextRequest) {
  return handleWallGoblin(req)
}

async function handleWallGoblin(req: NextRequest) {
  const authError = authorize(req)
  if (authError) return authError

  const { searchParams } = req.nextUrl
  const dryRun = isTruthy(searchParams.get('dryRun')) || isTruthy(searchParams.get('preview'))
  const requestedPostDate = searchParams.get('date')?.trim()
  const postDate = requestedPostDate || formatPacificDate(new Date())
  const warnings: string[] = []

  if (!isIsoDate(postDate)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD and represents the Pacific post date' }, { status: 400 })
  }

  const recapDate = addDays(postDate, -1)

  if (!isWithinGoblinWindow(postDate)) {
    return NextResponse.json({
      ok: true,
      dryRun,
      inserted: false,
      skipped: true,
      reason: `Outside Wall Goblin posting window (${FIRST_POST_DATE} through ${FINAL_POST_DATE} Pacific).`,
      postDate,
      recapDate,
    } satisfies RecapResponse)
  }

  const botUserId = process.env.WALL_GOBLIN_USER_ID?.trim()
  if (!dryRun && !botUserId) {
    return NextResponse.json(
      {
        ok: false,
        dryRun,
        inserted: false,
        reason: 'WALL_GOBLIN_USER_ID is required before the bot can insert Wall posts.',
        postDate,
        recapDate,
      } satisfies RecapResponse,
      { status: 503 }
    )
  }
  if (dryRun && !botUserId) warnings.push('WALL_GOBLIN_USER_ID is not configured; dry run skipped insert identity checks.')

  const beerDayNumber = Number(recapDate.slice(8, 10))
  const { data: beer, error: beerError } = await supabase
    .from('beers')
    .select('id, day_number, name, brewery, style, abv')
    .eq('day_number', beerDayNumber)
    .maybeSingle()

  if (beerError) return NextResponse.json({ error: beerError.message }, { status: 500 })
  if (!beer) {
    return NextResponse.json(
      {
        ok: false,
        dryRun,
        inserted: false,
        reason: `No beer found for day ${beerDayNumber}; refusing to post a recap without the consumed beer.`,
        postDate,
        recapDate,
      } satisfies RecapResponse,
      { status: 409 }
    )
  }

  if (botUserId) {
    const { data: botProfile, error: botProfileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', botUserId)
      .maybeSingle()

    if (botProfileError) return NextResponse.json({ error: botProfileError.message }, { status: 500 })
    if (!botProfile) {
      return NextResponse.json(
        {
          ok: false,
          dryRun,
          inserted: false,
          reason: 'WALL_GOBLIN_USER_ID does not have a matching profiles row; refusing to fake a human user.',
          postDate,
          recapDate,
        } satisfies RecapResponse,
        { status: 503 }
      )
    }
  }

  const marker = goblinMarker(recapDate)
  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id, content, created_at')
    .eq('beer_id', beer.id)
    .ilike('content', `%${marker}%`)
    .limit(1)
    .maybeSingle()

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
  if (existing) {
    return NextResponse.json({
      ok: true,
      dryRun,
      inserted: false,
      skipped: true,
      reason: 'A Wall Goblin recap already exists for this recap date.',
      postDate,
      recapDate,
      beer: pickBeer(beer),
      existingPostId: existing.id,
      content: existing.content,
      warnings,
    } satisfies RecapResponse)
  }

  const windowStart = zonedDateStartUtc(recapDate)
  const windowEnd = zonedDateStartUtc(addDays(recapDate, 1))
  let context: RecapContext
  try {
    context = await buildRecapContext({
      postDate,
      recapDate,
      beer: beer as BeerRow,
      windowStart,
      windowEnd,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read Wall Goblin activity.' },
      { status: 500 }
    )
  }

  let content = await generateRecap(context)
  content = `${content}\n\n${marker}`
  if (content.length > MAX_POST_CONTENT_LENGTH) content = content.slice(0, MAX_POST_CONTENT_LENGTH - 1).trimEnd()

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun,
      inserted: false,
      postDate,
      recapDate,
      activityWindowUtc: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
      beer: pickBeer(beer),
      content,
      warnings,
    } satisfies RecapResponse)
  }

  const { data: inserted, error: insertError } = await supabase
    .from('posts')
    .insert({
      user_id: botUserId,
      beer_id: beer.id,
      content,
      photo_url: null,
    })
    .select('id')
    .maybeSingle()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    dryRun,
    inserted: true,
    postDate,
    recapDate,
    activityWindowUtc: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    beer: pickBeer(beer),
    content,
    postId: inserted?.id,
    warnings,
  } satisfies RecapResponse, { status: 201 })
}

function authorize(req: NextRequest) {
  const expectedSecrets = [process.env.WALL_GOBLIN_SECRET?.trim(), process.env.CRON_SECRET?.trim()].filter(
    (secret): secret is string => Boolean(secret)
  )
  if (!expectedSecrets.length) {
    return NextResponse.json(
      { error: 'Wall Goblin route is disabled until WALL_GOBLIN_SECRET or CRON_SECRET is configured.' },
      { status: 503 }
    )
  }

  const authorization = req.headers.get('authorization') || ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const headerSecret = req.headers.get('x-wall-goblin-secret')?.trim()
  const querySecret = req.nextUrl.searchParams.get('secret')?.trim()

  if ([bearer, headerSecret, querySecret].some(secret => secret && expectedSecrets.includes(secret))) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function buildRecapContext({
  postDate,
  recapDate,
  beer,
  windowStart,
  windowEnd,
}: {
  postDate: string
  recapDate: string
  beer: BeerRow
  windowStart: Date
  windowEnd: Date
}): Promise<RecapContext> {
  const start = windowStart.toISOString()
  const end = windowEnd.toISOString()

  const [postRows, commentRows, reactionRows, ratingRows, clickRows, goblinMemory] = await Promise.all([
    fetchAllRows<PostActivityRow>((from, to) =>
      supabase
        .from('posts')
        .select('id, user_id, beer_id, content, created_at')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<CommentActivityRow>((from, to) =>
      supabase
        .from('post_comments')
        .select('id, post_id, user_id, content, created_at, posts(user_id, beer_id, content)')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<ReactionActivityRow>((from, to) =>
      supabase
        .from('post_reactions')
        .select('id, post_id, user_id, reaction, created_at, posts(user_id, beer_id, content)')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<RatingActivityRow>((from, to) =>
      supabase
        .from('ratings')
        .select('user_id, stars, notes, created_at')
        .eq('beer_id', beer.id)
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRowsOptional<OpenActivityRow>((from, to) =>
      supabase
        .from('notification_opens')
        .select('user_id, opened_at')
        .gte('opened_at', start)
        .lt('opened_at', end)
        .order('opened_at', { ascending: true })
        .range(from, to)
    ),
    fetchPriorGoblinMemory(windowStart),
  ])

  const botUserId = process.env.WALL_GOBLIN_USER_ID?.trim()
  const posts = postRows.filter(row => {
    if (botUserId && row.user_id === botUserId) return false
    return !row.content?.includes(MARKER_PREFIX)
  })
  const comments = commentRows.filter(row => !botUserId || row.user_id !== botUserId)
  const reactions = reactionRows.filter(row => !botUserId || row.user_id !== botUserId)
  const ratings = ratingRows.filter(row => !botUserId || row.user_id !== botUserId)
  const clicks = clickRows.filter(row => !botUserId || row.user_id !== botUserId)

  const actorIds = new Set<string>()
  const scores = new Map<string, number>()
  const reactionCounts: Record<string, number> = {}

  for (const row of [...posts, ...comments, ...reactions, ...ratings, ...clicks]) {
    if (botUserId && row.user_id === botUserId) continue
    if (row.user_id) {
      actorIds.add(row.user_id)
      scores.set(row.user_id, (scores.get(row.user_id) || 0) + 1)
    }
  }
  for (const row of reactions) {
    if (row.reaction) reactionCounts[row.reaction] = (reactionCounts[row.reaction] || 0) + 1
  }

  const { usernamesById, labelsById, displayNamesById } = await fetchMemberNames([...actorIds])
  const memberActivity = buildMemberActivity({
    actorIds: [...actorIds],
    usernamesById,
    labelsById,
    displayNamesById,
    posts,
    comments,
    reactions,
    ratings,
    clicks,
  })
  attachMemberCallbacks(memberActivity, goblinMemory)
  const topUserId = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const topUsername = topUserId ? usernamesById.get(topUserId) || null : null

  return {
    postDate,
    recapDate,
    beer,
    counts: {
      posts: posts.length,
      comments: comments.length,
      reactions: reactions.length,
      clicks: clicks.length,
      ratings: ratings.length,
    },
    reactionCounts,
    usernamesById,
    labelsById,
    topUsername,
    memberActivity,
    goblinMemory,
    posts: posts.map((post, index) => ({
      author: labelFor(post.user_id, labelsById),
      content: cleanSnippet(post.content),
      beerId: post.beer_id,
      createdAt: post.created_at,
      localTime: formatPacificTime(post.created_at),
      orderLabel: orderLabel(index, posts.length, 'post'),
      timingLabel: timingLabel(post.created_at),
    })),
    comments: comments.map((comment, index) => ({
      author: labelFor(comment.user_id, labelsById),
      content: cleanSnippet(comment.content),
      postAuthor: comment.posts?.user_id ? labelFor(comment.posts.user_id, labelsById) : null,
      postSnippet: comment.posts?.content ? cleanSnippet(comment.posts.content) : null,
      createdAt: comment.created_at,
      localTime: formatPacificTime(comment.created_at),
      orderLabel: orderLabel(index, comments.length, 'comment'),
      timingLabel: timingLabel(comment.created_at),
    })),
    reactions: reactions.map((reaction, index) => ({
      author: labelFor(reaction.user_id, labelsById),
      reaction: reaction.reaction || 'reaction',
      postAuthor: reaction.posts?.user_id ? labelFor(reaction.posts.user_id, labelsById) : null,
      postSnippet: reaction.posts?.content ? cleanSnippet(reaction.posts.content) : null,
      createdAt: reaction.created_at,
      localTime: formatPacificTime(reaction.created_at),
      orderLabel: orderLabel(index, reactions.length, 'reaction'),
      timingLabel: timingLabel(reaction.created_at),
    })),
  }
}

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await buildQuery(from, to)
    if (error) throw new Error(error.message)
    const page = (data || []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function fetchAllRowsOptional<T>(buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  try {
    return await fetchAllRows<T>(buildQuery)
  } catch {
    return [] as T[]
  }
}

async function fetchPriorGoblinMemory(before: Date): Promise<GoblinMemoryEntry[]> {
  try {
    let query = supabase
      .from('posts')
      .select('content, created_at')
      .ilike('content', `%${MARKER_PREFIX}%`)
      .lt('created_at', before.toISOString())
      .order('created_at', { ascending: false })
      .limit(GOBLIN_MEMORY_LOOKBACK)

    const botUserId = process.env.WALL_GOBLIN_USER_ID?.trim()
    if (botUserId) query = query.eq('user_id', botUserId)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return (data || [])
      .map(row => {
        const content = cleanGoblinMemoryText(typeof row.content === 'string' ? row.content : '')
        if (!content) return null
        return {
          recapDate: row.content?.match(new RegExp(`${MARKER_PREFIX}\\s*(\\d{4}-\\d{2}-\\d{2})`, 'i'))?.[1] || null,
          content,
        }
      })
      .filter((entry): entry is GoblinMemoryEntry => Boolean(entry))
  } catch (error) {
    console.warn('[wall-goblin] Prior Goblin memory unavailable; continuing without callbacks:', error instanceof Error ? error.message : error)
    return []
  }
}

async function fetchMemberNames(userIds: string[]) {
  const usernamesById = new Map<string, string>()
  const displayNamesById = new Map<string, string>()
  const labelsById = new Map<string, string>()
  if (!userIds.length) return { usernamesById, displayNamesById, labelsById }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds)

  if (error) throw new Error(error.message)

  for (const profile of (data || []) as ProfileRow[]) {
    const username = safeUsername(profile.username)
    const displayName = safeDisplayName(profile.display_name || null)
    if (username) usernamesById.set(profile.id, username)
    if (displayName) displayNamesById.set(profile.id, displayName)
    if (username) labelsById.set(profile.id, `@${username}`)
    else if (displayName) labelsById.set(profile.id, displayName)
  }

  return { usernamesById, displayNamesById, labelsById }
}

function buildMemberActivity({
  actorIds,
  usernamesById,
  labelsById,
  displayNamesById,
  posts,
  comments,
  reactions,
  ratings,
  clicks,
}: {
  actorIds: string[]
  usernamesById: Map<string, string>
  labelsById: Map<string, string>
  displayNamesById: Map<string, string>
  posts: PostActivityRow[]
  comments: CommentActivityRow[]
  reactions: ReactionActivityRow[]
  ratings: RatingActivityRow[]
  clicks: OpenActivityRow[]
}) {
  const members = new Map<string, MemberActivity>()
  const allEvents = [
    ...posts.map(row => ({ userId: row.user_id, kind: 'post' as const, createdAt: row.created_at })),
    ...comments.map(row => ({ userId: row.user_id, kind: 'comment' as const, createdAt: row.created_at })),
    ...reactions.map(row => ({ userId: row.user_id, kind: 'reaction' as const, createdAt: row.created_at })),
    ...ratings.map(row => ({ userId: row.user_id, kind: 'rating' as const, createdAt: row.created_at })),
    ...clicks.map(row => ({ userId: row.user_id, kind: 'open' as const, createdAt: row.opened_at })),
  ]
    .filter(event => Boolean(event.userId))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const orderByEvent = new Map<string, string>()
  allEvents.forEach((event, index) => {
    orderByEvent.set(eventKey(event.kind, event.createdAt, event.userId), orderLabel(index, allEvents.length, 'wall action'))
  })

  const getMember = (userId: string) => {
    const existing = members.get(userId)
    if (existing) return existing

    const member: MemberActivity = {
      userId,
      label: labelFor(userId, labelsById),
      username: usernamesById.get(userId) || null,
      displayName: displayNamesById.get(userId) || null,
      score: 0,
      counts: { posts: 0, comments: 0, reactions: 0, ratings: 0, opens: 0 },
      posts: [],
      comments: [],
      reactions: [],
      ratings: [],
      callbacks: [],
      standout: [],
      earliestActivityLocal: null,
      latestActivityLocal: null,
      timingRole: null,
      contentThemes: [],
      evidence: [],
    }
    members.set(userId, member)
    return member
  }

  for (const userId of actorIds) getMember(userId)

  for (const post of posts) {
    if (!post.user_id) continue
    const member = getMember(post.user_id)
    member.counts.posts += 1
    member.score += 4
    const snippet = cleanSnippet(post.content)
    if (snippet) member.posts.push(snippet)
    addMemberEvidence(member, 'post', post.created_at, orderByEvent, snippet || null, null, post.user_id)
  }

  for (const comment of comments) {
    if (!comment.user_id) continue
    const member = getMember(comment.user_id)
    member.counts.comments += 1
    member.score += 3
    const snippet = cleanSnippet(comment.content)
    if (snippet) {
      const postContext = comment.posts?.content ? ` on “${cleanSnippet(comment.posts.content)}”` : ''
      member.comments.push(`${snippet}${postContext}`)
    }
    addMemberEvidence(
      member,
      'comment',
      comment.created_at,
      orderByEvent,
      snippet || null,
      comment.posts?.content ? `replying to “${cleanSnippet(comment.posts.content)}”` : null,
      comment.user_id
    )
  }

  for (const reaction of reactions) {
    if (!reaction.user_id) continue
    const member = getMember(reaction.user_id)
    member.counts.reactions += 1
    member.score += 1
    const postContext = reaction.posts?.content ? ` on “${cleanSnippet(reaction.posts.content)}”` : ''
    member.reactions.push(`${reaction.reaction || 'reaction'}${postContext}`)
    addMemberEvidence(
      member,
      'reaction',
      reaction.created_at,
      orderByEvent,
      reaction.reaction || 'reaction',
      reaction.posts?.content ? `reacting to “${cleanSnippet(reaction.posts.content)}”` : null,
      reaction.user_id
    )
  }

  for (const rating of ratings) {
    if (!rating.user_id) continue
    const member = getMember(rating.user_id)
    member.counts.ratings += 1
    member.score += 2
    const stars = rating.stars ? `${rating.stars}★` : 'rated'
    const note = cleanSnippet(rating.notes)
    member.ratings.push(note ? `${stars}: ${note}` : stars)
    addMemberEvidence(member, 'rating', rating.created_at, orderByEvent, note ? `${stars}: ${note}` : stars, null, rating.user_id)
  }

  for (const click of clicks) {
    if (!click.user_id) continue
    const member = getMember(click.user_id)
    member.counts.opens += 1
    member.score += 0.5
    addMemberEvidence(member, 'open', click.opened_at, orderByEvent, null, null, click.user_id)
  }

  for (const member of members.values()) {
    if (member.counts.posts >= 2) member.standout.push('repeat poster')
    if (member.counts.comments >= 3) member.standout.push('comment-section goblin')
    if (member.counts.reactions >= 4) member.standout.push('emoji sprinkler')
    if (member.counts.ratings > 0 && member.posts.length === 0 && member.comments.length === 0) member.standout.push('rated quietly')
    const sortedEvidence = member.evidence.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    member.earliestActivityLocal = sortedEvidence[0]?.localTime || null
    member.latestActivityLocal = sortedEvidence[sortedEvidence.length - 1]?.localTime || null
    member.timingRole = describeTimingRole(sortedEvidence, member.counts)
    member.contentThemes = deriveContentThemes(member)
  }

  return [...members.values()]
    .filter(member => member.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
}

function addMemberEvidence(
  member: MemberActivity,
  kind: ActivityKind,
  createdAt: string,
  orderByEvent: Map<string, string>,
  text: string | null,
  context: string | null,
  userId: string | null
) {
  member.evidence.push({
    kind,
    createdAt,
    localTime: formatPacificTime(createdAt),
    orderLabel: orderByEvent.get(eventKey(kind, createdAt, userId)) || 'wall action',
    timingLabel: timingLabel(createdAt),
    text,
    context,
  })
}

function eventKey(kind: ActivityKind, createdAt: string, userId: string | null) {
  return `${kind}:${createdAt}:${userId || 'unknown'}`
}

function orderLabel(index: number, total: number, noun: string) {
  if (total <= 1) return `only ${noun}`
  if (index === 0) return `first ${noun}`
  if (index === 1) return `second ${noun}`
  if (index <= Math.max(1, Math.floor(total * 0.25))) return `early ${noun}`
  if (index === total - 1) return `last ${noun}`
  if (index >= Math.floor(total * 0.75)) return `late ${noun}`
  return `middle ${noun}`
}

function formatPacificTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

function timingLabel(value: string) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(value)))
  if (hour < 5) return 'after-midnight goblin hours'
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'late night'
}

function describeTimingRole(evidence: ActivityEvidence[], counts: MemberActivity['counts']) {
  if (!evidence.length) return null
  const first = evidence[0]
  const last = evidence[evidence.length - 1]
  if (first.orderLabel.startsWith('first')) return 'first through the door'
  if (evidence.every(item => item.kind === 'comment')) return 'comment lurker'
  if (evidence.every(item => item.kind === 'reaction')) return 'emoji lurker'
  if (last.timingLabel === 'late night' || last.timingLabel === 'after-midnight goblin hours') return 'late-night goblin'
  if (counts.posts > 0 && counts.comments > 0) return 'started a table and stayed to heckle'
  if (counts.posts > 0) return 'post starter'
  if (counts.comments > 0) return 'comment stirrer'
  if (counts.ratings > 0) return 'quiet rater'
  return 'wall lurker'
}

function deriveContentThemes(member: MemberActivity) {
  const sourceSnippets = [...member.posts, ...member.comments, ...member.ratings, ...member.reactions]
    .map(snippet => snippet.replace(/[“”]/g, '"'))
    .filter(Boolean)
  const combined = sourceSnippets.join(' ').toLowerCase()
  const themes: string[] = []
  const addTheme = (label: string, pattern: RegExp) => {
    if (pattern.test(combined) && !themes.includes(label)) themes.push(label)
  }

  addTheme('flavor note', /\b(taste|tastes|tasting|flavor|sweet|bitter|hoppy|malty|citrus|pine|roast|coffee|chocolate|sour|crisp|dry|juicy)\b/)
  addTheme('beer judgment', /\b(good|great|solid|love|liked|favorite|bad|rough|weird|meh|gross|excellent|terrible)\b/)
  addTheme('brewery or beer-name riff', /\b(brewery|brewing|beer|ale|lager|ipa|stout|porter|pils|kolsch|saison|cider)\b/)
  addTheme('timing/weather/life context', /\b(late|night|morning|work|dinner|rain|cold|warm|home|game|kids|today|tonight)\b/)
  addTheme('reaction to someone else', /\bon\s+"[^"]+"/)

  for (const snippet of sourceSnippets) {
    if (themes.length >= 4) break
    const trimmed = snippet.replace(/\s+on\s+“.*$/, '').trim()
    if (trimmed && !themes.some(theme => trimmed.toLowerCase().includes(theme))) themes.push(`said “${trimmed.slice(0, 70)}”`)
  }

  return themes.slice(0, 4)
}

function attachMemberCallbacks(members: MemberActivity[], memory: GoblinMemoryEntry[]) {
  if (!memory.length || !members.length) return

  for (const member of members) {
    const callbacks: string[] = []
    for (const entry of memory) {
      for (const sentence of splitMemorySentences(entry.content)) {
        if (!sentence.includes(member.label)) continue
        const cleaned = sentence
          .replace(member.label, 'this member')
          .replace(/\s+/g, ' ')
          .trim()
        if (cleaned && !callbacks.includes(cleaned)) callbacks.push(cleaned)
        if (callbacks.length >= 2) break
      }
      if (callbacks.length >= 2) break
    }
    member.callbacks = callbacks
  }
}

async function generateRecap(context: RecapContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return deterministicRecap(context)

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: process.env.WALL_GOBLIN_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 460,
      temperature: 0.8,
      system: [
        'You are the Hallowed Hop Society Wall Goblin writing ONE cohesive in-character Wall comment.',
        'This is not a daily recap, not a report, and not a list of per-person actions.',
        'Write as if a goblin/person in the room is jokingly calling out members while the Wall conversation is happening.',
        'When enough activity exists, weave 5 to 7 actual active members into one flowing roast using their supplied labels.',
        'If fewer than five members were active, use only those active members and keep the comment short without pretending there was a crowd.',
        'Ground jokes in the meaning of specific post/comment/reaction/rating/open clues, local timing/order, reply context, and recurring callbacks supplied in the data, but do not show raw stats up front.',
        'Prefer a specific content-based joke over a generic activity joke whenever snippets make one possible.',
        'Use timing when it matters: who was first through the door, who arrived early, who posted late evening/night, who only reacted after someone else said something, and what they were replying/reacting to.',
        'Do not joke only that someone posted/commented/reacted; joke about what their supplied text or reaction was actually about.',
        'Do not use a formula like “@a did this. @b did that. @c did this.” Vary sentence shape and connect members through one scene or bit.',
        'Do not copy examples, templates, or prior posts; priorGoblinMemory is only for lightweight callbacks/themes.',
        'Mention the featured beer only if it helps the joke.',
        'Write 3 to 5 sentences as a single playful HHS-specific comment in a pointed-but-friendly goblin voice.',
        'No sensitive/private info. Never use emails or unsupplied names.',
        'If calling out a member, use only supplied member labels; otherwise say someone or one brave soul.',
        'Keep it funny, not cruel: no harassment, threats, protected-class insults, sexual content, or repeated pile-on.',
        'Do not invent counts, users, breweries, beers, or activity.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            recapDate: context.recapDate,
            beer: {
              name: context.beer.name,
              brewery: context.beer.brewery,
              style: context.beer.style,
              abv: context.beer.abv,
            },
            counts: context.counts,
            reactions: context.reactionCounts,
            memberActivity: context.memberActivity.map(member => ({
              label: member.label,
              username: member.username ? `@${member.username}` : null,
              displayName: member.displayName,
              counts: member.counts,
              standout: member.standout,
              earliestActivityLocal: member.earliestActivityLocal,
              latestActivityLocal: member.latestActivityLocal,
              timingRole: member.timingRole,
              contentThemes: member.contentThemes,
              evidence: member.evidence.map(item => ({
                kind: item.kind,
                localTime: item.localTime,
                orderLabel: item.orderLabel,
                timingLabel: item.timingLabel,
                text: item.text,
                context: item.context,
              })),
              posts: member.posts,
              comments: member.comments,
              reactions: member.reactions,
              ratings: member.ratings,
              recurringCallbacks: member.callbacks,
            })),
            priorGoblinMemory: context.goblinMemory.map(entry => ({
              recapDate: entry.recapDate,
              content: entry.content,
            })),
            wallActivity: {
              posts: context.posts,
              comments: context.comments,
              reactions: context.reactions,
            },
            allowedMemberLabels: [...context.labelsById.values()],
            formatRules: [
              'Do not begin with aggregate counts.',
              'Do not include the words daily recap or recap.',
              'Do not make a bullet list or line-separated list.',
              'Return only the Wall comment text.',
            ],
          }),
        },
      ],
    })

    const text = message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ')
      .trim()

    const cleaned = cleanGeneratedRecap(text, context)
    return cleaned || deterministicRecap(context)
  } catch (error) {
    console.error('[wall-goblin] Anthropic generation failed; using fallback:', error instanceof Error ? error.message : error)
    return deterministicRecap(context)
  }
}

function cleanGeneratedRecap(text: string, context: RecapContext) {
  const allowedHandles = new Set([...context.usernamesById.values()].map(username => `@${username}`))
  const cleaned = text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, 'someone')
    .replace(/@\w[\w.-]*/g, handle => (allowedHandles.has(handle) ? handle : 'someone'))
    .replace(/^wall goblin recap:\s*/i, '')
    .replace(/\bdaily recap\b/gi, 'wall muttering')
    .replace(/\s+/g, ' ')
    .replace(new RegExp(MARKER_PREFIX, 'gi'), 'Goblin note:')
    .slice(0, 650)
    .trim()
  if (looksLikeRecapOrList(cleaned, context)) return ''
  return cleaned
}

function deterministicRecap(context: RecapContext) {
  const { beer, counts, reactionCounts, topUsername, memberActivity } = context
  const handle = topUsername ? `@${topUsername}` : 'one brave soul'
  const reactionSummary = summarizeReactions(reactionCounts)
  const style = beer.style ? `${beer.style} ` : ''
  const totalWallActions = counts.posts + counts.comments + counts.reactions

  if (totalWallActions === 0) {
    return `The Wall Goblin pressed an ear to the Wall and heard the kind of silence normally reserved for a forgotten cooler. ${beer.name} from ${beer.brewery} may be a ${style}worth discussing, but the Society treated it like a cursed bottle that might demand eye contact.`
  }

  const targets = memberActivity.slice(0, 7)
  if (targets.length === 1) {
    const roast = memberRoastClause(targets[0])
    return `The Wall Goblin found just one clear set of muddy footprints today: ${roast}. ${beer.name} from ${beer.brewery} still got a witness statement, even if the rest of the Society chose suspicious silence and ${reactionSummary}.`
  }

  if (targets.length >= 2) {
    const goblinScene = targets.length < 5
      ? 'The room was not exactly packed, but the few brave souls who left crumbs made enough noise for the Goblin to crawl out of the tap lines.'
      : 'The Wall Goblin found a whole little tavern brawl in the evidence pile and immediately started pointing sticky fingers.'
    const wovenRoast = weaveMemberRoasts(targets)
    const beerNod = shouldMentionBeer(context) ? ` ${beer.name} from ${beer.brewery} sat nearby like the official excuse for all this behavior.` : ''
    return `${goblinScene} ${wovenRoast}${beerNod}`
  }

  if (counts.posts === 0) {
    return `The Wall Goblin saw ${handle} rattling the empty comment cage while everyone else practiced advanced lurking. ${beer.name} from ${beer.brewery} deserved at least a little table talk, but the Society mostly answered in ${reactionSummary} and suspicious silence.`
  }

  return `The Wall Goblin caught ${handle} wandering closest to the cauldron while the rest of the Society hovered at safe tasting-room distance. ${beer.name} from ${beer.brewery} did not need a spreadsheet of applause; it just needed somebody to stop lurking long enough to make the Wall look alive.`
}

function weaveMemberRoasts(members: MemberActivity[]) {
  const phrases = members
    .map((member, index) => memberRoastClause(member, index))
    .filter(Boolean)
    .slice(0, 5)

  const callback = firstCallbackFor(members)
  const callbackSentence = callback ? ` The Goblin also remembers how ${callback.label} ${callback.callback.replace(/^this member\s*/i, '')}, so that callback is staying in the rafters for later.` : ''

  if (phrases.length === 0) return `the evidence was mostly creaky floorboards and suspicious glances, which is still enough for one damp little gremlin.${callbackSentence}`
  if (phrases.length === 1) return `${phrases[0]}, which is plenty of evidence for one damp little gremlin.${callbackSentence}`
  if (phrases.length === 2) return `The Goblin clock caught ${phrases[0]}, while also catching ${phrases[1]}.${callbackSentence}`
  const opening = `The Goblin clock caught ${phrases[0]}, while also catching ${phrases[1]}.`
  const rest = phrases.slice(2)
  if (rest.length === 1) return `${opening} Then ${rest[0]}.${callbackSentence}`
  return `${opening} Then ${joinWithSemicolons(rest)}.${callbackSentence}`
}

function memberRoastClause(member: MemberActivity, index = 0) {
  const evidence = bestEvidenceForRoast(member)
  const timing = member.timingRole ? `${member.timingRole} at ${member.earliestActivityLocal || evidence?.localTime}` : evidence?.localTime
  const theme = member.contentThemes[0]

  if (!evidence) return `${member.label} left only enough fingerprints for a suspicious squint`

  if (evidence.kind === 'post') {
    const snippet = quoteSnippet(evidence.text)
    if (snippet) {
      const endings = [
        'making the Goblin sniff the actual words instead of counting empty mugs',
        'which is either Wall evidence or proof the can started arguing back',
        'and the Goblin is legally required to poke that sentence with a tiny stick',
      ]
      return `${member.label} showing up as ${timing} with ${snippet}, ${endings[index % endings.length]}`
    }
    return `${member.label} showing up as ${timing} and making the Wall blink awake`
  }

  if (evidence.kind === 'comment') {
    const snippet = quoteSnippet(evidence.text)
    const context = evidence.context ? ` while ${sanitizeInlineSnippet(evidence.context)}` : ''
    if (snippet) return `${member.label} playing ${timing} with ${snippet}${context}, a tiny spoon clanking directly in someone else's cauldron`
    return `${member.label} playing ${timing}${context}, stirring the comment pot without leaving a full meal`
  }

  if (evidence.kind === 'reaction') {
    const context = evidence.context ? ` ${sanitizeInlineSnippet(evidence.context)}` : ''
    return `${member.label} waiting until ${evidence.localTime} to throw ${evidence.text || 'a reaction'}${context}, classic rafter-goblin behavior`
  }

  if (evidence.kind === 'rating') {
    const snippet = quoteSnippet(evidence.text)
    return `${member.label} filing ${snippet || 'a rating'} during ${evidence.timingLabel}, the official Society paperwork of pretending this is science`
  }

  return `${member.label} only cracking the door during ${evidence.timingLabel}${theme ? ` around ${theme}` : ''}, which the Goblin is counting as lurking with intent`
}

function bestEvidenceForRoast(member: MemberActivity) {
  const priority: Record<ActivityKind, number> = {
    post: 5,
    comment: 4,
    rating: 3,
    reaction: 2,
    open: 1,
  }
  return [...member.evidence].sort((a, b) => {
    const priorityDelta = priority[b.kind] - priority[a.kind]
    if (priorityDelta !== 0) return priorityDelta
    const textDelta = Number(Boolean(b.text)) - Number(Boolean(a.text))
    if (textDelta !== 0) return textDelta
    return Date.parse(a.createdAt) - Date.parse(b.createdAt)
  })[0] || null
}

function quoteSnippet(value: string | null) {
  if (!value) return ''
  const cleaned = sanitizeInlineSnippet(value)
  if (!cleaned) return ''
  return `“${cleaned.slice(0, 110)}”`
}

function sanitizeInlineSnippet(value: string) {
  return value
    .replace(/@\w[\w.-]*/g, 'that handle')
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldMentionBeer(context: RecapContext) {
  return context.counts.ratings > 0 || context.posts.some(post => post.beerId === context.beer.id)
}

function joinWithSemicolons(parts: string[]) {
  if (parts.length === 0) return ''
  if (parts.length === 1) return `${parts[0]}`
  return `${parts.slice(0, -1).join('; ')}; and ${parts[parts.length - 1]}`
}

function firstCallbackFor(members: MemberActivity[]) {
  const member = members.find(candidate => candidate.callbacks.length > 0)
  if (!member) return null
  return { label: member.label, callback: member.callbacks[0] }
}

function summarizeReactions(reactionCounts: Record<string, number>) {
  const entries = Object.entries(reactionCounts).filter(([, count]) => count > 0)
  if (!entries.length) return 'zero reactions'

  const emoji: Record<string, string> = {
    cheers: '🍺',
    dead: '💀',
    fire: '🔥',
    trophy: '🏆',
    rough: '🤢',
  }

  const [reaction, count] = entries.sort((a, b) => b[1] - a[1])[0]
  return `${plural(count, `${emoji[reaction] || reaction} reaction`)}`
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function looksLikeRecapOrList(text: string, context: RecapContext) {
  if (!text) return true
  if (/\brecap\b/i.test(text)) return true
  if (/^\s*[-*•]|\n\s*[-*•]/.test(text)) return true
  const opening = text.slice(0, 180)
  if (/\b(produced|delivered|brought|generated|had)\b/i.test(opening) && /\b\d+\s+(posts?|comments?|reactions?|ratings?)\b/i.test(opening)) return true
  const labels = new Set(context.memberActivity.map(member => member.label))
  const labelLeadSentences = text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => [...labels].some(label => sentence.startsWith(label))).length
  return labelLeadSentences >= 3
}

function cleanGoblinMemoryText(content: string) {
  return content
    .replace(new RegExp(`${MARKER_PREFIX}\\s*\\d{4}-\\d{2}-\\d{2}`, 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)
}

function splitMemorySentences(content: string) {
  return content
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function goblinMarker(recapDate: string) {
  return `${MARKER_PREFIX} ${recapDate}`
}

function isWithinGoblinWindow(postDate: string) {
  return postDate >= FIRST_POST_DATE && postDate <= FINAL_POST_DATE
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function formatPacificDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function zonedDateStartUtc(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0)
  let guess = new Date(localAsUtc)

  for (let i = 0; i < 2; i++) {
    const offset = getTimeZoneOffsetMs(guess)
    guess = new Date(localAsUtc - offset)
  }

  return guess
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const value = (type: string) => Number(parts.find(item => item.type === type)?.value)
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return asUtc - date.getTime()
}

function safeUsername(username: string | null) {
  if (!username) return null
  const cleaned = username.trim().replace(/^@+/, '')
  return /^[A-Za-z0-9_.-]{1,32}$/.test(cleaned) ? cleaned : null
}

function safeDisplayName(displayName: string | null) {
  if (!displayName) return null
  const cleaned = displayName.trim().replace(/\s+/g, ' ')
  if (!cleaned || cleaned.length > 40) return null
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(cleaned)) return null
  return /^[\p{L}\p{N} ._'’-]{1,40}$/u.test(cleaned) ? cleaned : null
}

function labelFor(userId: string | null, labelsById: Map<string, string>) {
  if (!userId) return 'unknown member'
  return labelsById.get(userId) || 'unknown member'
}

function cleanSnippet(value: string | null | undefined) {
  if (!value) return ''
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SNIPPET_LENGTH)
}

function isTruthy(value: string | null) {
  return value === '1' || value === 'true' || value === 'yes'
}

function pickBeer(beer: BeerRow) {
  return {
    day_number: beer.day_number,
    name: beer.name,
    brewery: beer.brewery,
    style: beer.style,
  }
}
