// ─────────────────────────────────────────────────────────────────────────────
// HHS Feedback API  —  GET / POST / PATCH
//
// GET  /api/feedback          → returns all feedback items (public)
// POST /api/feedback          → submit new feedback item (public)
// GET  /api/feedback?adminStatus=1 → returns whether the bearer token can manage feedback
// PATCH /api/feedback?id=...        → update status (admin only)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) {
    throw new Error('Supabase service key is not configured')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )
}

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

const VALID_STATUSES = new Set(['submitted', 'backlog', 'in_progress', 'live'])

function getFeedbackAdminEmails() {
  return new Set(
    (process.env.HHS_FEEDBACK_ADMIN_EMAILS ?? process.env.HHS_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

function hasAdminClaim(user: User) {
  const appMetadata = user.app_metadata ?? {}
  const userMetadata = user.user_metadata ?? {}
  const roles = [
    appMetadata.role,
    appMetadata.roles,
    userMetadata.role,
    userMetadata.roles,
  ].flat()

  return appMetadata.admin === true ||
    appMetadata.hhs_admin === true ||
    userMetadata.admin === true ||
    userMetadata.hhs_admin === true ||
    roles.some(role => typeof role === 'string' && ['admin', 'hhs_admin', 'feedback_admin'].includes(role.toLowerCase()))
}

function isFeedbackAdmin(user: User) {
  const email = user.email?.trim().toLowerCase()
  return Boolean(email && getFeedbackAdminEmails().has(email)) || hasAdminClaim(user)
}

async function getBearerUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { user: null, error: 'missing_token' as const }

  const anonClient = getSupabaseAnon()
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return { user: null, error: 'invalid_token' as const }

  return { user, error: null }
}

function normalizeFeedbackItem(item: Record<string, unknown>) {
  const rawImages = item.image_urls
  return {
    ...item,
    status: typeof item.status === 'string' && VALID_STATUSES.has(item.status) ? item.status : 'submitted',
    image_urls: Array.isArray(rawImages)
      ? rawImages.filter((url): url is string => typeof url === 'string' && /^https:\/\//i.test(url))
      : [],
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('adminStatus') === '1') {
      const { user } = await getBearerUser(req)
      return NextResponse.json({ isAdmin: Boolean(user && isFeedbackAdmin(user)) })
    }

    const supabase = getSupabaseAnon()
    const { data, error } = await supabase
      .from('feedback_items')
      .select('id, title, description, name, email, status, image_urls, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ items: (data ?? []).map(item => normalizeFeedbackItem(item)) })
  } catch (err) {
    console.error('[feedback] GET error:', err)
    return NextResponse.json({ items: [] })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, name, email, image_urls } = body as {
      title?: string
      description?: string
      name?: string
      email?: string
      image_urls?: string[]
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const supabase = getSupabaseAnon()
    const { data, error } = await supabase
      .from('feedback_items')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        name: name?.trim() || null,
        email: email?.trim() || null,
        status: 'submitted',
        image_urls: Array.isArray(image_urls)
          ? image_urls.filter((url): url is string => typeof url === 'string' && /^https:\/\//i.test(url)).slice(0, 4)
          : [],
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[feedback] POST error:', err)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { user } = await getBearerUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isFeedbackAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { status } = body as { status?: string }

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('feedback_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[feedback] PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }
}
