import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { verifyApprovalSetupToken } from '@/lib/approval-token'

function completeUrl(req: NextRequest, setupError?: string) {
  const url = new URL('/auth/complete', req.url)
  url.searchParams.set('browser', '1')
  if (setupError) url.searchParams.set('setup_error', setupError)
  return url
}

function redirectToComplete(req: NextRequest, setupError: string) {
  return NextResponse.redirect(completeUrl(req, setupError))
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const verified = verifyApprovalSetupToken(token)

  if (!verified.ok) {
    return redirectToComplete(req, verified.reason === 'expired' ? 'expired' : 'invalid')
  }

  const supabaseAdmin = createServiceClient()

  const { data: memberReq, error: requestError } = await supabaseAdmin
    .from('member_requests')
    .select('id, email, status')
    .eq('id', verified.requestId)
    .eq('email', verified.email)
    .maybeSingle()

  if (requestError || !memberReq || memberReq.status !== 'approved') {
    return redirectToComplete(req, 'not_approved')
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, status, tier, tier_selected_at')
    .eq('id', verified.userId)
    .maybeSingle()

  if (profileError || !profile) {
    return redirectToComplete(req, 'profile_missing')
  }

  if (
    profile.status !== 'approved' ||
    (profile.email && String(profile.email).toLowerCase() !== verified.email)
  ) {
    return redirectToComplete(req, 'not_approved')
  }

  // Reusable approval links are valid only until the member commits the first
  // setup page (Society name/password/tier). Landing on setup does not consume
  // the link; choosing a tier and submitting does.
  if (profile.tier || profile.tier_selected_at) {
    return redirectToComplete(req, 'already_completed')
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: verified.email,
    options: {
      redirectTo: completeUrl(req).toString(),
    },
  })

  const actionLink = linkData?.properties?.action_link
  if (linkError || !actionLink) {
    console.error('[auth/approved] generateLink failed:', linkError?.message)
    return redirectToComplete(req, 'link_generation_failed')
  }

  return NextResponse.redirect(actionLink)
}

