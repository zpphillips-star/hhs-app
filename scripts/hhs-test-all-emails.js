const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const resend = new Resend('re_Pnftnwan_BYNayxM8EmejGWZ6mAcHg4bm');
const TO = 'zpphillips@gmail.com';
const FROM = 'HHS <notifications@hallowedhopsociety.com>';

// ─── Shared design helpers (mirrors lib/email-templates.ts) ──────────────────
const bg='#191726',bgCard='#201d30',text='#e8dcc8',textMuted='#7a7468',textSub='#a09a92',gold='#d97c2b',border='rgba(217,124,43,0.18)';
const base = c => `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:${bg};font-family:Georgia,'Times New Roman',serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:48px 20px;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:480px;" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:28px;"><div style="display:inline-block;border:2px solid rgba(217,124,43,0.45);border-radius:50%;width:72px;height:72px;line-height:72px;text-align:center;font-size:1.1rem;font-weight:700;color:${text};letter-spacing:0.05em;">HHS</div><div style="margin-top:16px;font-size:1.3rem;font-weight:700;color:${text};letter-spacing:0.12em;text-transform:uppercase;">Hallowed Hop Society</div><div style="margin-top:5px;font-size:0.82rem;color:${textMuted};font-style:italic;">Members Only</div></td></tr><tr><td style="padding-bottom:24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(217,124,43,0.22);"></td></tr></table></td></tr><tr><td style="background:${bgCard};border:1px solid ${border};border-radius:16px;padding:36px 36px 32px;">${c}</td></tr><tr><td align="center" style="padding-top:24px;"><div style="font-size:0.62rem;letter-spacing:0.15em;text-transform:uppercase;color:${textMuted};opacity:0.6;">The Society will be in touch.</div><div style="margin-top:8px;"><a href="https://hallowedhopsociety.com" style="font-size:0.7rem;color:${textMuted};text-decoration:none;letter-spacing:0.08em;opacity:0.5;">hallowedhopsociety.com</a></div></td></tr></table></td></tr></table></body></html>`;
const eye = l => `<div style="font-size:0.58rem;letter-spacing:0.35em;text-transform:uppercase;color:${gold};margin-bottom:12px;">${l}</div>`;
const h1 = t => `<div style="font-size:1.35rem;font-weight:700;color:${text};letter-spacing:0.05em;line-height:1.3;margin-bottom:14px;">${t}</div>`;
const p = t => `<p style="font-size:0.95rem;color:${textSub};line-height:1.8;margin:0 0 22px;font-style:italic;">${t}</p>`;
const btn = (href,lbl) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;"><tr><td align="center"><a href="${href}" style="display:inline-block;background:${gold};color:${bg};font-size:0.75rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;padding:14px 40px;border-radius:8px;">${lbl}</a></td></tr></table>`;
const fine = t => `<p style="font-size:0.72rem;color:${textMuted};line-height:1.7;margin:0;text-align:center;">${t}</p>`;
const divider = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-top:1px solid rgba(217,124,43,0.12);"></td></tr></table>`;

async function sendAll() {

  // 1. Password reset (our custom Supabase template from file)
  const resetHtml = fs.readFileSync(
    path.join(__dirname, '..', 'supabase/email-templates/reset-password.html'), 'utf8'
  ).replace(/\{\{ \.ConfirmationURL \}\}/g, 'https://hallowedhopsociety.com/auth/reset-password?token=TEST');
  let r = await resend.emails.send({ from: FROM, to: TO, subject: '[TEST 1/6] HHS — Password Recovery', html: resetHtml });
  console.log('1. Password reset:', r.error ? r.error : 'sent ✅');

  // 2. Email confirm (Supabase default — not yet customized)
  r = await resend.emails.send({ from: FROM, to: TO, subject: '[TEST 2/6] Confirm your HHS email', html: base(`
    ${eye('Email Confirmation')}
    ${h1('Confirm your email address.')}
    ${p('Follow this link to confirm your account and join the circle.')}
    ${btn('https://hallowedhopsociety.com/auth/complete?token=TEST', 'Confirm Email')}
    ${divider}
    ${fine('⚠️ This is the DEFAULT Supabase template — not yet customized in the dashboard.')}
  `)});
  console.log('2. Email confirm:', r.error ? r.error : 'sent ✅');

  // 3. Membership request alert (→ Zach)
  r = await resend.emails.send({ from: FROM, to: TO, subject: '[TEST 3/6] New membership request — Test Applicant', html: base(`
    ${eye('Membership Request')}
    ${h1('Someone wants in.')}
    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:22px;">
      <tr><td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;width:90px;">Name</td><td style="font-size:0.9rem;color:${text};padding:6px 0;">Test Applicant</td></tr>
      <tr><td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;">Email</td><td style="font-size:0.9rem;color:${text};padding:6px 0;">test@example.com</td></tr>
      <tr><td style="font-size:0.8rem;color:${textMuted};padding:6px 0;letter-spacing:0.05em;text-transform:uppercase;">Requested</td><td style="font-size:0.9rem;color:${text};padding:6px 0;">${new Date().toLocaleString('en-US',{timeZone:'America/Los_Angeles'})}</td></tr>
    </table>
    ${btn('https://hallowedhopsociety.com/admin', 'Review in Admin')}
    ${fine('Approve or reject from the admin panel.')}
  `)});
  console.log('3. Membership request:', r.error ? r.error : 'sent ✅');

  // 4. Welcome / You're In
  r = await resend.emails.send({ from: FROM, to: TO, subject: "[TEST 4/6] You've been admitted to the Hallowed Hop Society", html: base(`
    ${eye('Membership Approved')}
    ${h1("You're in.")}
    ${p("Welcome to the Hallowed Hop Society, Zach. Your membership has been approved.")}
    ${p("Tap the button below to choose your Society name and complete your account setup.")}
    ${btn('https://hallowedhopsociety.com/auth/complete?token=TEST', 'Enter the Society →')}
    ${divider}
    ${fine('This link expires in <strong>24 hours</strong>.')}
  `)});
  console.log('4. Welcome email:', r.error ? r.error : 'sent ✅');

  // 5. Rejection
  r = await resend.emails.send({ from: FROM, to: TO, subject: '[TEST 5/6] Your Hallowed Hop Society petition', html: base(`
    ${eye('The Society Has Spoken')}
    ${h1('Not this season.')}
    ${p('Thank you for your interest in the Hallowed Hop Society, Zach.')}
    ${p('After careful deliberation, the Society has decided not to extend membership this season. The circle is small, and the selection is never easy.')}
    ${p("You're welcome to petition again next year.")}
    ${divider}
    ${fine('May your pints be cold.')}
  `)});
  console.log('5. Rejection email:', r.error ? r.error : 'sent ✅');

  // 6. Brewery outreach (Gmail SMTP)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'hallowedhopsociety@gmail.com', pass: 'dgrd hvko lhmo ufrh' },
  });
  await transporter.sendMail({
    from: '"Hallowed Hop Society" <hallowedhopsociety@gmail.com>',
    to: TO,
    subject: '[TEST 6/6] HHS Brewery Outreach Sample',
    text: `Hi Test Brewery team,

My name is Zach and I run the Hallowed Hop Society — a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.

Our theme for this year's HHS is The PNW Corner and we are reaching out to select craft breweries along the I-5 corridor from Marysville to the Canadian border.

You are on our list of breweries we would love to feature. Rather than pick a beer ourselves, we'd love to connect and discuss which of your beers would be the right fit for our group.

Interested? Please message me at hallowedhopsociety@gmail.com

Cheers,
Zach Phillips
Hallowed Hop Society`,
  });
  console.log('6. Brewery outreach (Gmail):', 'sent ✅');

  console.log('\nAll 6 done!');
}

sendAll().catch(console.error);
