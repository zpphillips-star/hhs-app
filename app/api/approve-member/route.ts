import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { request_id, action } = await req.json()

    if (!request_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Get the request
    const { data: memberReq, error: fetchErr } = await supabaseAdmin
      .from('member_requests')
      .select('*')
      .eq('id', request_id)
      .single()

    if (fetchErr || !memberReq) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (action === 'reject') {
      await supabaseAdmin
        .from('member_requests')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', request_id)

      // Send rejection email
      await resend.emails.send({
        from: 'HHS <notifications@hallowedhopsociety.com>',
        to: memberReq.email,
        subject: 'Your Hallowed Hop Society petition',
        html: `
          <div style="font-family: Georgia, serif; background: #0d0b0f; color: #e8dcc8; padding: 32px; max-width: 480px; margin: 0 auto; border: 1px solid #2a1f3d; border-radius: 8px;">
            <p style="font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(217,124,43,0.65); margin: 0 0 20px 0;">Hallowed Hop Society</p>
            <h2 style="color: #d97c2b; font-size: 1.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">The Society Has Spoken</h2>
            <p style="line-height: 1.8; color: #e8dcc8;">Thank you for your interest in the Hallowed Hop Society, ${memberReq.first_name}.</p>
            <p style="line-height: 1.8; color: #e8dcc8;">After careful deliberation, the Society has decided not to extend membership this season. The circle is small, and the selection is never easy.</p>
            <p style="line-height: 1.8; color: #e8dcc8; font-style: italic;">You're welcome to petition again next year.</p>
            <p style="margin-top: 24px; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(217,124,43,0.6);">Until then — may your pints be cold.</p>
          </div>
        `,
      })

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // Approve: create the user account
    let userId: string | undefined

    // Step 1: Pre-clean orphaned profiles that would conflict with the trigger.
    // The handle_new_user trigger inserts username = email-prefix. If a profile
    // with that username already exists but the auth user is gone, the INSERT
    // hits the UNIQUE constraint → "Database error creating new user".
    const emailPrefix = memberReq.email.split('@')[0]
    const { data: conflictProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('username', emailPrefix)
      .maybeSingle()

    if (conflictProfile) {
      // Check if its auth user still exists
      const { data: authCheck } = await supabaseAdmin.auth.admin.getUserById(conflictProfile.id)
      if (!authCheck?.user) {
        // Orphaned — delete it so the trigger can create a fresh one
        await supabaseAdmin.from('profiles').delete().eq('id', conflictProfile.id)
        console.log('Cleaned up orphaned profile for username:', emailPrefix)
      } else if (authCheck.user.email === memberReq.email) {
        // Auth user already exists with this email — skip creation, use magic link
        userId = authCheck.user.id
      }
    }

    if (!userId) {
      // Step 2: Check if user already exists in auth (ghost/soft-deleted state) before creating
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existingAuthUser = userList?.users?.find(u => u.email === memberReq.email)

      if (existingAuthUser) {
        // User exists in auth — reuse their ID, just update metadata
        console.log('Auth user already exists, reusing:', existingAuthUser.id)
        userId = existingAuthUser.id
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            first_name: memberReq.first_name,
            last_name: memberReq.last_name,
          },
          email_confirm: true,
        })
      } else {
        // Fresh create
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: memberReq.email,
          email_confirm: true,
          user_metadata: {
            first_name: memberReq.first_name,
            last_name: memberReq.last_name,
          },
        })

        if (createErr || !createdUser?.user?.id) {
          console.error('createUser failed:', createErr?.message)
          return NextResponse.json({
            error: `Could not create account: ${createErr?.message ?? 'unknown error'}`
          }, { status: 500 })
        }
        userId = createdUser.user.id
      }
    }

    // Mark request as approved
    await supabaseAdmin
      .from('member_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request_id)

    // Update profile with full details (trigger may have created a minimal one)
    if (userId) {
      // Compute a safe username (check for conflicts with other users first)
      let finalUsername = emailPrefix
      const { data: usernameTaken } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', emailPrefix)
        .neq('id', userId)
        .maybeSingle()
      if (usernameTaken) finalUsername = `${emailPrefix}_${Date.now().toString().slice(-4)}`

      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          username: finalUsername,
          first_name: memberReq.first_name,
          last_name: memberReq.last_name,
          status: 'approved',
        }, { onConflict: 'id' })
    }

    // Send welcome email via Resend
    // Generate a fresh setup link to embed in the email
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: memberReq.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hallowedhopsociety.com'}/auth/complete`,
      }
    })
    const setupLink = linkData?.properties?.action_link || 'https://hallowedhopsociety.com/auth'

    await resend.emails.send({
      from: 'HHS <notifications@hallowedhopsociety.com>',
      to: memberReq.email,
      subject: 'You\'ve been admitted to the Hallowed Hop Society',
      html: `
        <div style="font-family: Georgia, serif; background: #0d0b0f; color: #e8dcc8; padding: 32px; max-width: 480px; margin: 0 auto; border: 1px solid #2a1f3d; border-radius: 8px;">
          <p style="font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(217,124,43,0.65); margin: 0 0 20px 0;">Hallowed Hop Society</p>
          <h2 style="color: #c8973a; font-size: 1.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">You're In.</h2>
          <p style="line-height: 1.7;">Welcome to the Hallowed Hop Society, ${memberReq.first_name}. Your membership has been approved.</p>
          <p style="line-height: 1.7;">Tap the button below to choose your Society name and complete your account setup.</p>
          <a href="${setupLink}" style="display: inline-block; margin: 20px 0; padding: 12px 28px; background: #c8973a; color: #0d0b0f; font-family: Georgia, serif; font-weight: 700; text-decoration: none; border-radius: 6px; letter-spacing: 0.05em;">Enter the Society →</a>
          <p style="line-height: 1.7; color: #9c8a6e; font-size: 0.9rem;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true, action: 'approved', user_id: userId })
  } catch (err) {
    console.error('approve-member error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
