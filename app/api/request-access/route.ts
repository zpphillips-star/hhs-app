import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { membershipRequestEmail } from '@/lib/email-templates'

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
      if (existing.status === 'pending') {
        return NextResponse.json({ error: 'A request from this email is already pending review.' }, { status: 409 })
      }
      // Previously rejected — allow them to re-request (update to pending)
      await supabaseAdmin
        .from('member_requests')
        .update({ first_name, last_name, status: 'pending', reviewed_at: null, created_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      // Fresh request — insert
      const { error: insertError } = await supabaseAdmin
        .from('member_requests')
        .insert({ first_name, last_name, email: email.toLowerCase() })

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
    await resend.emails.send({
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
