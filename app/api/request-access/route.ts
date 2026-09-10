import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { membershipRequestEmail } from '@/lib/email-templates'
import { validateRequestAccessInput } from '@/lib/request-access-validation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_PER_IP = 8
const RATE_LIMIT_MAX_PER_EMAIL = 2
const RATE_LIMIT_MAX_BUCKETS = 500
const requestAccessRateBuckets = new Map<string, number[]>()

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = req.headers.get('x-real-ip')?.trim()
  return forwardedFor || realIp || 'unknown'
}

function getRecentHits(key: string, now: number): number[] {
  const recentHits = (requestAccessRateBuckets.get(key) ?? []).filter(
    (hitAt) => now - hitAt < RATE_LIMIT_WINDOW_MS
  )

  if (recentHits.length) {
    requestAccessRateBuckets.set(key, recentHits)
  } else {
    requestAccessRateBuckets.delete(key)
  }

  return recentHits
}

function pruneRateLimitBuckets(now: number): void {
  if (requestAccessRateBuckets.size <= RATE_LIMIT_MAX_BUCKETS) return

  for (const key of requestAccessRateBuckets.keys()) {
    getRecentHits(key, now)
    if (requestAccessRateBuckets.size <= RATE_LIMIT_MAX_BUCKETS) return
  }
}

function checkRequestAccessRateLimit(req: NextRequest, email: string): NextResponse | null {
  const now = Date.now()
  const ipKey = `ip:${getClientIp(req)}`
  const emailKey = `email:${email}`
  const ipHits = getRecentHits(ipKey, now)
  const emailHits = getRecentHits(emailKey, now)

  if (ipHits.length >= RATE_LIMIT_MAX_PER_IP || emailHits.length >= RATE_LIMIT_MAX_PER_EMAIL) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a bit and try again.' },
      { status: 429 }
    )
  }

  ipHits.push(now)
  emailHits.push(now)
  requestAccessRateBuckets.set(ipKey, ipHits)
  requestAccessRateBuckets.set(emailKey, emailHits)
  pruneRateLimitBuckets(now)

  return null
}

export async function POST(req: NextRequest) {
  try {
    let requestBody: unknown
    try {
      requestBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const validation = validateRequestAccessInput(requestBody)

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { first_name, last_name, email } = validation.data

    // Check if already requested
    const { data: existing } = await supabaseAdmin
      .from('member_requests')
      .select('id, status')
      .eq('email', email)
      .single()

    if (existing) {
      if (existing.status === 'approved') {
        return NextResponse.json({ error: 'This email is already an approved member. Sign in above.' }, { status: 409 })
      }
      if (existing.status === 'pending') {
        return NextResponse.json({ error: 'A request from this email is already pending review.' }, { status: 409 })
      }

      const rateLimitResponse = checkRequestAccessRateLimit(req, email)
      if (rateLimitResponse) return rateLimitResponse

      // Previously rejected — allow them to re-request (update to pending)
      await supabaseAdmin
        .from('member_requests')
        .update({ first_name, last_name, status: 'pending', reviewed_at: null, created_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      const rateLimitResponse = checkRequestAccessRateLimit(req, email)
      if (rateLimitResponse) return rateLimitResponse

      // Fresh request — insert
      const { error: insertError } = await supabaseAdmin
        .from('member_requests')
        .insert({ first_name, last_name, email })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    // Notify Zach
    const requestTpl = membershipRequestEmail({
      first_name,
      last_name,
      email,
      requested_at: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
    })
    await getResend().emails.send({
      from: 'HHS <notifications@hallowedhopsociety.com>',
      to: 'hallowedhopsociety@gmail.com',
      ...requestTpl,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('request-access error:', err)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
