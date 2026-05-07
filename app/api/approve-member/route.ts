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
          <!DOCTYPE html>
          <html><body style="margin:0; padding:0; background:#0d0a14;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0a14; padding: 40px 16px;">
            <tr><td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px; background:#201d30; border:1px solid rgba(217,124,43,0.25); border-radius:12px; padding:40px 36px; font-family:Georgia,'Times New Roman',serif; color:#d9d8d2;">
                <tr><td>
                  <p style="font-size:0.6rem; letter-spacing:0.25em; text-transform:uppercase; color:rgba(217,124,43,0.65); margin:0 0 24px 0;">Hallowed Hop Society</p>
                  <h2 style="font-size:1.4rem; font-weight:700; letter-spacing:0.04em; color:#d9d8d2; margin:0 0 20px 0; line-height:1.35;">The Society<br/>Has Spoken.</h2>
                  <div style="width:32px; height:1px; background:rgba(217,124,43,0.45); margin:0 0 28px 0;"></div>
                  <p style="line-height:1.85; color:#d9d8d2; margin:0 0 16px 0; font-size:0.95rem;">Thank you for your interest, ${memberReq.first_name}.</p>
                  <p style="line-height:1.85; color:#7a7468; margin:0 0 16px 0; font-size:0.95rem; font-style:italic;">After careful deliberation, the Society has decided not to extend membership this season. The circle is small, and the selection is never easy.</p>
                  <p style="line-height:1.85; color:#7a7468; margin:0 0 32px 0; font-size:0.95rem; font-style:italic;">You're welcome to petition again next year.</p>
                  <div style="border-top:1px solid rgba(217,124,43,0.15); padding-top:24px;">
                    <p style="font-size:0.65rem; letter-spacing:0.15em; text-transform:uppercase; color:rgba(217,124,43,0.55); margin:0;">Until then — may your pints be cold.</p>
                  </div>
                </td></tr>
              </table>
            </td></tr>
          </table>
          </body></html>
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
      // Step 2: Create the user (triggers handle_new_user → inserts profile)
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        memberReq.email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hallowedhopsociety.com'}/auth/complete`,
          data: {
            first_name: memberReq.first_name,
            last_name: memberReq.last_name,
          },
        }
      )

      if (inviteErr) {
        // Still failing — user may exist under a different profile state
        console.error('inviteUserByEmail failed:', inviteErr.message)
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const existing = userList?.users?.find(u => u.email === memberReq.email)
        if (!existing) {
          return NextResponse.json({
            error: `Could not create account: ${inviteErr.message}. Please run supabase/fix-trigger-conflict.sql in Supabase.`
          }, { status: 500 })
        }
        userId = existing.id
      } else {
        userId = inviteData?.user?.id
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
        <!DOCTYPE html>
        <html><body style="margin:0; padding:0; background:#0d0a14;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0a14; padding: 40px 16px;">
          <tr><td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:440px; background:#201d30; border:1px solid rgba(217,124,43,0.25); border-radius:12px; padding:40px 36px; font-family:Georgia,'Times New Roman',serif; color:#d9d8d2;">
              <tr><td>
                <p style="font-size:0.6rem; letter-spacing:0.25em; text-transform:uppercase; color:rgba(217,124,43,0.65); margin:0 0 24px 0;">Hallowed Hop Society</p>
                <h2 style="font-size:1.4rem; font-weight:700; letter-spacing:0.04em; color:#d9d8d2; margin:0 0 20px 0; line-height:1.35;">You're In.</h2>
                <div style="width:32px; height:1px; background:rgba(217,124,43,0.45); margin:0 0 28px 0;"></div>
                <p style="line-height:1.85; color:#d9d8d2; margin:0 0 16px 0; font-size:0.95rem;">Welcome to the Hallowed Hop Society, ${memberReq.first_name}. Your membership has been approved.</p>
                <p style="line-height:1.85; color:#7a7468; margin:0 0 32px 0; font-size:0.95rem; font-style:italic;">Tap below to choose your Society name and complete your account setup.</p>
                <a href="${setupLink}" style="display:block; text-align:center; padding:14px 28px; background:#d97c2b; color:#0d0a14; font-family:Georgia,serif; font-weight:700; text-decoration:none; border-radius:8px; letter-spacing:0.08em; font-size:0.8rem; text-transform:uppercase;">Enter the Society →</a>
                <div style="border-top:1px solid rgba(217,124,43,0.15); padding-top:24px; margin-top:32px;">
                  <p style="font-size:0.65rem; letter-spacing:0.1em; color:rgba(217,124,43,0.4); margin:0; font-style:italic;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
                </div>
              </td></tr>
            </table>
          </td></tr>
        </table>
        </body></html>
      `,
    })

    return NextResponse.json({ success: true, action: 'approved', user_id: userId })
  } catch (err) {
    console.error('approve-member error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
