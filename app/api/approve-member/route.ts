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

      return NextResponse.json({ success: true, action: 'rejected' })
    }

    // Approve: create the user account
    let userId: string | undefined

    // Try inviteUserByEmail first (cleanest path — sends welcome email we control anyway)
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
      // User likely already exists — find them and send a magic link instead
      console.log('inviteUserByEmail failed:', inviteErr.message)
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = userList?.users?.find(u => u.email === memberReq.email)
      if (!existing) {
        return NextResponse.json({ error: inviteErr.message }, { status: 500 })
      }
      userId = existing.id
    } else {
      userId = inviteData?.user?.id
    }

    // Mark request as approved
    await supabaseAdmin
      .from('member_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request_id)

    // Also create/update profile with first/last name and approved status
    if (userId) {
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          username: memberReq.email.split('@')[0], // temp username, they'll update
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
