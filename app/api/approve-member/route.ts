import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  // Require CRON_SECRET (sent from admin UI via env) or skip auth header check for now
  // In production you'd verify the logged-in user is admin
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET || ''
  if (secret && authHeader !== `Bearer ${secret}`) {
    // Also allow if no secret is set (dev mode)
    if (secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

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

    // Approve: invite the user via Supabase
    const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      memberReq.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hallowedhopsociety.com'}/auth/complete`,
        data: {
          first_name: memberReq.first_name,
          last_name: memberReq.last_name,
        }
      }
    )

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 })
    }

    // Mark request as approved
    await supabaseAdmin
      .from('member_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', request_id)

    // Also create/update profile with first/last name and approved status
    const userId = inviteData.user?.id
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

    // Send welcome email via Resend (Supabase also sends the invite, this is supplemental)
    await resend.emails.send({
      from: 'HHS <notifications@hallowedhopsociety.com>',
      to: memberReq.email,
      subject: 'You\'ve been admitted to the Hallowed Hop Society',
      html: `
        <div style="font-family: Georgia, serif; background: #0d0b0f; color: #e8dcc8; padding: 32px; max-width: 480px; margin: 0 auto; border: 1px solid #2a1f3d; border-radius: 8px;">
          <h2 style="color: #c8973a; font-size: 1.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">You're In.</h2>
          <p style="line-height: 1.7;">Welcome to the Hallowed Hop Society, ${memberReq.first_name}. Your membership has been approved.</p>
          <p style="line-height: 1.7;">Check your email for a separate message with a link to finish setting up your account — choose your Society name and you'll be ready to go.</p>
          <p style="line-height: 1.7; color: #9c8a6e; font-size: 0.9rem;">The link expires in 24 hours.</p>
        </div>
      `,
    })

    return NextResponse.json({ success: true, action: 'approved', user_id: userId })
  } catch (err) {
    console.error('approve-member error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
