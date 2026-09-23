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

type BeerRow = {
  id: string
  day_number: number
  name: string
  brewery: string
  style: string | null
  abv: number | null
}

type ActivityRow = {
  user_id: string | null
  reaction?: string | null
  content?: string | null
}

type ProfileRow = {
  id: string
  username: string | null
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
  topUsername: string | null
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

  const [postsResult, commentsResult, reactionsResult, ratingsResult, clicksResult] = await Promise.all([
    supabase.from('posts').select('user_id, content').gte('created_at', start).lt('created_at', end),
    supabase.from('post_comments').select('user_id').gte('created_at', start).lt('created_at', end),
    supabase.from('post_reactions').select('user_id, reaction').gte('created_at', start).lt('created_at', end),
    supabase.from('ratings').select('user_id').eq('beer_id', beer.id).gte('created_at', start).lt('created_at', end),
    supabase.from('notification_opens').select('user_id').gte('opened_at', start).lt('opened_at', end),
  ])

  for (const result of [postsResult, commentsResult, reactionsResult, ratingsResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  const botUserId = process.env.WALL_GOBLIN_USER_ID?.trim()
  const posts = ((postsResult.data || []) as ActivityRow[]).filter(row => {
    if (botUserId && row.user_id === botUserId) return false
    return !row.content?.includes(MARKER_PREFIX)
  })
  const comments = (commentsResult.data || []) as ActivityRow[]
  const reactions = (reactionsResult.data || []) as ActivityRow[]
  const ratings = (ratingsResult.data || []) as ActivityRow[]
  const clicks = clicksResult.error ? [] : ((clicksResult.data || []) as ActivityRow[])

  const actorIds = new Set<string>()
  const scores = new Map<string, number>()
  const reactionCounts: Record<string, number> = {}

  for (const row of [...posts, ...comments, ...reactions, ...ratings, ...clicks]) {
    if (botUserId && row.user_id === botUserId) continue
    if (row.user_id) {
      actorIds.add(row.user_id)
      scores.set(row.user_id, (scores.get(row.user_id) || 0) + 1)
    }
    if (row.reaction) reactionCounts[row.reaction] = (reactionCounts[row.reaction] || 0) + 1
  }

  const usernamesById = await fetchUsernames([...actorIds])
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
    topUsername,
  }
}

async function fetchUsernames(userIds: string[]) {
  const usernamesById = new Map<string, string>()
  if (!userIds.length) return usernamesById

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)

  if (error) throw new Error(error.message)

  for (const profile of (data || []) as ProfileRow[]) {
    const username = safeUsername(profile.username)
    if (username) usernamesById.set(profile.id, username)
  }

  return usernamesById
}

async function generateRecap(context: RecapContext) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return deterministicRecap(context)

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: process.env.WALL_GOBLIN_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 190,
      temperature: 0.8,
      system: [
        'You write the Hallowed Hop Society Wall Goblin daily recap.',
        'Write exactly two short sentences in a sharper, playful snark tone.',
        'No sensitive/private info. Never use display names, real names, or emails.',
        'If calling out a member, use only supplied @username handles; otherwise say someone or one brave soul.',
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
            allowedUserHandles: [...context.usernamesById.values()].map(username => `@${username}`).slice(0, 12),
            preferredOpening: 'Wall Goblin recap:',
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
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, 'someone')
    .replace(/@\w[\w.-]*/g, handle => (allowedHandles.has(handle) ? handle : 'someone'))
    .replace(/\s+/g, ' ')
    .replace(new RegExp(MARKER_PREFIX, 'gi'), 'Goblin note:')
    .slice(0, 650)
    .trim()
}

function deterministicRecap(context: RecapContext) {
  const { beer, counts, reactionCounts, topUsername } = context
  const handle = topUsername ? `@${topUsername}` : 'one brave soul'
  const reactionSummary = summarizeReactions(reactionCounts)
  const style = beer.style ? `${beer.style} ` : ''
  const totalWallActions = counts.posts + counts.comments + counts.reactions

  if (totalWallActions === 0) {
    return `Wall Goblin recap: ${beer.name} day brought zero posts, zero comments, and zero reactions — a silence so crisp ${beer.brewery} may try to can it as a ${style}limited release. Someone probably consumed the beer, but the Wall was treated like a tasting note written in invisible ink.`
  }

  if (counts.posts === 0) {
    return `Wall Goblin recap: ${beer.name} day delivered zero new posts, ${plural(counts.comments, 'comment')}, and ${reactionSummary} — engagement best described as “technically carbonated.” ${handle} kept the lights flickering while the rest of you approached this ${style}from ${beer.brewery} like it might ask for eye contact.`
  }

  return `Wall Goblin recap: ${beer.name} day produced ${plural(counts.posts, 'post')}, ${plural(counts.comments, 'comment')}, and ${reactionSummary}, which is almost enough activity to qualify as a pulse. ${handle} wandered closest to the cauldron while the rest of the Society let this ${style}from ${beer.brewery} do most of the talking.`
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
