/**
 * HHS — Send next 10 breweries
 */

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const GMAIL_USER = 'hallowedhopsociety@gmail.com';
const GMAIL_APP_PASSWORD = 'dgrd hvko lhmo ufrh';
const SUPABASE_URL = 'https://dnicdsjvqxthkktlcshe.supabase.co';
const SUPABASE_KEY = 'process.env.SUPABASE_SECRET_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, '') }
});

function isEmail(s) {
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function buildHtml(b) {
  const alts = [b.beer_2, b.beer_3, b.beer_4].filter(Boolean);
  const altSentence = alts.length
    ? ' We were also looking at your ' + alts.map(a => '<b>' + a + '</b>').join(', ') + ' &mdash; and would love to ask for your expertise in choosing the right one for our lineup.'
    : '';
  // If beer_1 is unverified, fall back to first alternate
  const beer1 = (b.beer_1 && !b.beer_1.toLowerCase().includes('not verified'))
    ? b.beer_1
    : (alts[0] || 'your flagship beer');

  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:600px;">
  <p>Hi ${b.brewery_name} team,</p>
  <p>My name is Zach and I run the <b>Hallowed Hop Society</b> &mdash; a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.</p>
  <p style="margin-bottom:2px;">&#127866; <b>Why we&rsquo;re reaching out</b></p>
  <p style="margin-top:2px;">We are preparing for this upcoming season and want to discuss including your beer for this year&rsquo;s Hallowed Hop Society &mdash; PNNW - Canada (Pacific North Northwest - Canada) Edition!</p>
  <p style="margin-bottom:2px;">&#128197; <b>How it works</b></p>
  <p style="margin-top:2px;">We select 31 breweries and assign each one a day in October. All 48 members of the society drink <b>${beer1}</b> on their assigned day.${altSentence}</p>
  <p style="margin-bottom:2px;">&#128176; <b>The purchase</b></p>
  <p style="margin-top:2px;">We&rsquo;d like to purchase 48 cans of the beer we decide on for pick up in August. All funds collected go purely toward purchasing the beer &mdash; and any extra is donated to <b>VISION Young Leaders&rsquo; Academy</b>, a close-to-home non-profit dedicated to mentoring youth and building the next generation of community leaders.</p>
  <p style="margin-bottom:2px;">&#128248; <b>Follow along</b></p>
  <p style="margin-top:2px;">Check us out at <b>@hallowedhopsociety</b> on Instagram &mdash; we&rsquo;d love to feature ${b.brewery_name} as part of this year&rsquo;s lineup!</p>
  <p>If you&rsquo;re interested, please reply and we can discuss further details.</p>
  <p>Cheers,<br>Zach<br>Hallowed Hop Society</p>
</div>`;
}

async function run() {
  const ids = [90, 57, 107, 61, 62, 93, 108, 94, 54, 91, 63];
  const { data, error } = await supabase
    .from('brewery_outreach')
    .select('*')
    .in('id', ids)
    .order('brewery_name');

  if (error) { console.error(error); return; }

  let sent = 0;
  for (const b of data) {
    const to = b.contact_1;
    const ccRaw = [b.contact_2, b.contact_3, b.contact_4].filter(Boolean);
    const cc = ccRaw.filter(isEmail);
    const skipped = ccRaw.filter(s => !isEmail(s));

    if (!to || !isEmail(to)) {
      console.log('[SKIP] ' + b.brewery_name + ' — invalid TO: ' + to);
      continue;
    }

    const html = buildHtml(b);
    const mailOptions = {
      from: 'Hallowed Hop Society <' + GMAIL_USER + '>',
      to,
      cc: cc.length ? cc.join(', ') : undefined,
      subject: 'We Want to Buy Your Beer \u2014 Hallowed Hop Society 2026',
      html,
    };

    try {
      await transporter.sendMail(mailOptions);

      // Build delivery note
      const allRecipients = [to, ...cc];
      const deliveryNote = `[${new Date().toLocaleDateString('en-CA')}] Initial outreach sent to ${allRecipients.length} email${allRecipients.length > 1 ? 's' : ''}: ${allRecipients.join(', ')}.`;

      await supabase.from('brewery_outreach').update({
        status: 'initial_send',
        last_updated: new Date().toISOString(),
        notes: deliveryNote,
      }).eq('id', b.id);

      const ccNote = cc.length ? ' | CC: ' + cc.join(', ') : '';
      const skipNote = skipped.length ? ' (non-emails skipped: ' + skipped.join(', ') + ')' : '';
      console.log('[SENT] ' + b.brewery_name + ' -> ' + to + ccNote + skipNote);
      sent++;
      await new Promise(r => setTimeout(r, 1200));
    } catch (e) {
      console.error('[ERROR] ' + b.brewery_name + ': ' + e.message);
    }
  }

  console.log('\nDone. ' + sent + '/10 sent.');
}

run().catch(console.error);






