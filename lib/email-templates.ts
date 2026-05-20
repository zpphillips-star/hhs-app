/**
 * HHS Email Templates
 *
 * All transactional email HTML lives here.
 * Edit copy/styles in this file — no redeploy needed for content changes
 * as long as variable names stay the same.
 *
 * Sent via Resend from: HHS <notifications@hallowedhopsociety.com>
 */

// ─── Shared design tokens ────────────────────────────────────────────────────
const bg       = '#191726'
const bgCard   = '#201d30'
const text     = '#e8dcc8'
const textMuted= '#7a7468'
const textSub  = '#a09a92'
const gold     = '#d97c2b'
const border   = 'rgba(217,124,43,0.18)'

const base = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${bg};padding:48px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td align="center" style="padding-bottom:28px;">
          <div style="display:inline-block;border:2px solid rgba(217,124,43,0.45);border-radius:50%;
                      width:72px;height:72px;line-height:72px;text-align:center;
                      font-size:1.1rem;font-weight:700;color:${text};letter-spacing:0.05em;">HHS</div>
          <div style="margin-top:16px;font-size:1.3rem;font-weight:700;color:${text};
                      letter-spacing:0.12em;text-transform:uppercase;">Hallowed Hop Society</div>
          <div style="margin-top:5px;font-size:0.82rem;color:${textMuted};font-style:italic;">Members Only</div>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding-bottom:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-top:1px solid rgba(217,124,43,0.22);"></td></tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:${bgCard};border:1px solid ${border};border-radius:16px;padding:36px 36px 32px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding-top:24px;">
          <div style="font-size:0.62rem;letter-spacing:0.15em;text-transform:uppercase;color:${textMuted};opacity:0.6;">
            The Society will be in touch.
          </div>
          <div style="margin-top:8px;">
            <a href="https://hallowedhopsociety.com"
               style="font-size:0.7rem;color:${textMuted};text-decoration:none;letter-spacing:0.08em;opacity:0.5;">
              hallowedhopsociety.com
            </a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`

const eyebrow = (label: string) =>
  `<div style="font-size:0.58rem;letter-spacing:0.35em;text-transform:uppercase;color:${gold};margin-bottom:12px;">${label}</div>`

const headline = (txt: string) =>
  `<div style="font-size:1.35rem;font-weight:700;color:${text};letter-spacing:0.05em;line-height:1.3;margin-bottom:14px;">${txt}</div>`

const body = (txt: string) =>
  `<p style="font-size:0.95rem;color:${textSub};line-height:1.8;margin:0 0 22px;font-style:italic;">${txt}</p>`

const ctaButton = (href: string, label: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
    <tr><td align="center">
      <a href="${href}"
         style="display:inline-block;background:${gold};color:${bg};
                font-size:0.75rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;
                text-decoration:none;padding:14px 40px;border-radius:8px;">
        ${label}
      </a>
    </td></tr>
  </table>
`

const divider = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr><td style="border-top:1px solid rgba(217,124,43,0.12);"></td></tr>
  </table>
`

const fine = (txt: string) =>
  `<p style="font-size:0.72rem;color:${textMuted};line-height:1.7;margin:0;text-align:center;">${txt}</p>`


// ─── Template 1: New membership request alert (→ Zach) ────────────────────────

export interface MembershipRequestData {
  first_name: string
  last_name: string
  email: string
  requested_at: string   // e.g. "May 20, 2026, 10:02 AM"
}

export function membershipRequestEmail(d: MembershipRequestData) {
  return {
    subject: `New membership request — ${d.first_name} ${d.last_name}`,
    html: base(`
      ${eyebrow('Membership Request')}
      ${headline('Someone wants in.')}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:22px;">
        <tr>
          <td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;width:90px;">Name</td>
          <td style="font-size:0.9rem;color:${text};padding:6px 0;">${d.first_name} ${d.last_name}</td>
        </tr>
        <tr>
          <td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;">Email</td>
          <td style="font-size:0.9rem;color:${text};padding:6px 0;">${d.email}</td>
        </tr>
        <tr>
          <td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;">Requested</td>
          <td style="font-size:0.9rem;color:${text};padding:6px 0;">${d.requested_at}</td>
        </tr>
      </table>
      ${ctaButton('https://hallowedhopsociety.com/admin', 'Review in Admin')}
      ${fine('Approve or reject from the admin panel.')}
    `),
  }
}


// ─── Template 2: Welcome / approved (→ new member) ───────────────────────────

export interface WelcomeEmailData {
  first_name: string
  setup_link: string
}

export function welcomeEmail(d: WelcomeEmailData) {
  return {
    subject: "You've been admitted to the Hallowed Hop Society",
    html: base(`
      ${eyebrow('Membership Approved')}
      ${headline("You're in.")}
      ${body(`Welcome to the Hallowed Hop Society, ${d.first_name}. Your membership has been approved.`)}
      ${body('Tap the button below to choose your Society name and complete your account setup.')}
      ${ctaButton(d.setup_link, 'Enter the Society →')}
      ${divider}
      ${fine('This link expires in <strong style="color:${textSub}">24 hours</strong>.')}
    `),
  }
}


// ─── Template 3: Rejection (→ rejected person) ───────────────────────────────

export interface RejectionEmailData {
  first_name: string
}

export function rejectionEmail(d: RejectionEmailData) {
  return {
    subject: 'Your Hallowed Hop Society petition',
    html: base(`
      ${eyebrow('The Society Has Spoken')}
      ${headline('Not this season.')}
      ${body(`Thank you for your interest in the Hallowed Hop Society, ${d.first_name}.`)}
      ${body('After careful deliberation, the Society has decided not to extend membership this season. The circle is small, and the selection is never easy.')}
      ${body("You're welcome to petition again next year.")}
      ${divider}
      ${fine('May your pints be cold.')}
    `),
  }
}
