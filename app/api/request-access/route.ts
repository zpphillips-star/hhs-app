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
    const { first_name, last_name, email } = await req.json()

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    // Check if already requested
    const { data: existing } = await supabaseAdmin
      .from('member_requests')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      if (existing.status === 'approved') {
        return NextResponse.json({ error: 'This email is already an approved member. Sign in above.' }, { status: 409 })
      }
      return NextResponse.json({ error: 'A request from this email is already pending review.' }, { status: 409 })
    }

    // Insert the request
    const { error: insertError } = await supabaseAdmin
      .from('member_requests')
      .insert({ first_name, last_name, email: email.toLowerCase() })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Notify Zach
    await resend.emails.send({
      from: 'HHS <notifications@hallowedhopsociety.com>',
      to: 'hallowedhopsociety@gmail.com',
      subject: `New membership request — ${first_name} ${last_name}`,
      html: `
        <div style="font-family: Georgia, serif; background: #0d0b0f; color: #e8dcc8; padding: 32px; max-width: 480px; margin: 0 auto; border: 1px solid #2a1f3d; border-radius: 8px;">
          <h2 style="color: #c8973a; font-size: 1.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 16px;">New Membership Request</h2>
          <p style="margin: 8px 0;"><strong>Name:</strong> ${first_name} ${last_name}</p>
          <p style="margin: 8px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 8px 0;"><strong>Requested:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}</p>
          <div style="margin-top: 24px; text-align: center;">
            <a href="https://hallowedhopsociety.com/admin" style="background: #c8973a; color: #0d0b0f; padding: 12px 24px; text-decoration: none; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.8rem; border-radius: 4px;">
              Review in Admin Panel
            </a>
          </div>
        </div>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('request-access error:', err)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
