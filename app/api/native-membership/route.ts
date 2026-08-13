import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS so native app can write membership data
// even before the user's own session is available in the server context.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      user_id,
      email,
      name,
      tier,
      tier_selected_at,
      venmo_clicked,
      venmo_clicked_at,
      selected_amount,
      source,
    } = body as {
      user_id?: string
      email?: string
      name?: string
      tier?: 'hallowed' | 'oddballs'
      tier_selected_at?: string
      venmo_clicked?: boolean
      venmo_clicked_at?: string | null
      selected_amount?: number
      source?: string
    }

    // Must have at least user_id or email to identify the profile
    if (!user_id && !email) {
      return NextResponse.json(
        { error: 'user_id or email is required' },
        { status: 400 },
      )
    }

    if (tier && tier !== 'hallowed' && tier !== 'oddballs') {
      return NextResponse.json({ error: 'Invalid tier value' }, { status: 400 })
    }

    // Resolve user_id from email if not provided
    let resolvedUserId = user_id
    if (!resolvedUserId && email) {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })
      const found = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      )
      if (!found) {
        return NextResponse.json(
          { error: 'No user found for that email' },
          { status: 404 },
        )
      }
      resolvedUserId = found.id
    }

    // Build the update payload — only include fields we actually received
    const update: Record<string, unknown> = {}
    if (tier) update.tier = tier
    if (tier_selected_at) update.tier_selected_at = tier_selected_at
    if (venmo_clicked && venmo_clicked_at) {
      update.venmo_clicked_at = venmo_clicked_at
      update.payment_review_status = 'not_reviewed'
      update.payment_confirmed_at = null
    }
    if (email) update.email = email
    if (name) {
      // Split name into first/last for consistency with existing schema
      const [first, ...rest] = name.trim().split(/\s+/)
      update.first_name = first
      if (rest.length) update.last_name = rest.join(' ')
    }
    if (selected_amount) update.native_membership_amount = selected_amount
    if (source) update.native_source = source

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, updated: false, reason: 'nothing to update' })
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', resolvedUserId!)

    if (updateErr) {
      console.warn('[native-membership] full update failed, falling back to safe columns:', updateErr.message)
      // Unknown columns (e.g. email/native_source not yet migrated) — fall back to the
      // columns we know exist from tier-selection-migration.sql
      const safeFallback: Record<string, unknown> = {}
      if (update.tier) safeFallback.tier = update.tier
      if (update.tier_selected_at) safeFallback.tier_selected_at = update.tier_selected_at
      if (update.venmo_clicked_at) safeFallback.venmo_clicked_at = update.venmo_clicked_at
      if (update.first_name) safeFallback.first_name = update.first_name
      if (update.last_name) safeFallback.last_name = update.last_name

      if (Object.keys(safeFallback).length) {
        const { error: fallbackErr } = await supabaseAdmin
          .from('profiles')
          .update(safeFallback)
          .eq('id', resolvedUserId!)

        if (fallbackErr) {
          console.error('[native-membership] fallback update failed:', fallbackErr.message)
          return NextResponse.json(
            { error: fallbackErr.message },
            { status: 500 },
          )
        }
      }
    }

    return NextResponse.json({ ok: true, updated: true })
  } catch (err) {
    console.error('[native-membership] error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
