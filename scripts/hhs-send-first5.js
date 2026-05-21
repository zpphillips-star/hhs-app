/**
 * HHS Send First 5 — sends to first 5 pending breweries
 */
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const GMAIL_USER = 'hallowedhopsociety@gmail.com';
const GMAIL_PASS = 'dgrdhvkolhmoufrh';
const supabase = createClient(
  'https://dnicdsjvqxthkktlcshe.supabase.co',
  'process.env.SUPABASE_SECRET_KEY'
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

function buildHtml(b) {
  const alts = [b.beer_2, b.beer_3, b.beer_4].filter(Boolean);
  let altLine = '';
  if (alts.length > 0) {
    altLine = ' We were also looking at your ' + alts.map(x => '<b>' + x + '</b>').join(', ') + ' &mdash; and would love to ask for your expertise in choosing the right one for our lineup.';
  }
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:600px;">
<p>Hi ${b.brewery_name} team,</p>
<p>My name is Zach and I run the <b>Hallowed Hop Society</b> &mdash; a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.</p>
<p style="margin-bottom:2px;">&#127866; <b>Why we're reaching out</b></p>
<p style="margin-top:2px;">We are preparing for this upcoming season and want to discuss including your beer for this year's Hallowed Hop Society - PNNW - Canada (Pacific North Northwest - Canada) Edition!</p>
<p style="margin-bottom:2px;">&#128197; <b>How it works</b></p>
<p style="margin-top:2px;">We select 31 breweries and assign each one a day in October. All 48 members of the society drink <b>${b.beer_1}</b> on their assigned day.${altLine}</p>
<p style="margin-bottom:2px;">&#128176; <b>The purchase</b></p>
<p style="margin-top:2px;">We'd like to purchase 48 cans of the beer we decide on for pick up in August. All funds collected go purely toward purchasing the beer &mdash; and any extra is donated to <b>VISION Young Leaders' Academy</b>, a close-to-home non-profit dedicated to mentoring youth and building the next generation of community leaders.</p>
<p style="margin-bottom:2px;">&#128248; <b>Follow along</b></p>
<p style="margin-top:2px;">Check us out at <b>@hallowedhopsociety</b> on Instagram &mdash; we'd love to feature ${b.brewery_name} as part of this year's lineup!</p>
<p>If you're interested, please reply and we can discuss further details.</p>
<p>Cheers,<br>Zach<br>Hallowed Hop Society</p>
</div>`;
}

async function main() {
  const { data: breweries, error } = await supabase
    .from('brewery_outreach')
    .select('*')
    .in('status', ['pending'])
    .not('contact_1', 'is', null)
    .not('beer_1', 'is', null)
    .order('id')
    .limit(5);

  if (error) { console.error(error); process.exit(1); }

  for (const b of breweries) {
    const cc = [b.contact_2, b.contact_3, b.contact_4].filter(Boolean).join(', ');
    try {
      await transporter.sendMail({
        from: `Hallowed Hop Society <${GMAIL_USER}>`,
        to: b.contact_1,
        cc: cc || undefined,
        subject: "We Want to Buy Your Beer \u2014 Hallowed Hop Society 2026",
        html: buildHtml(b),
      });

      await supabase.from('brewery_outreach').update({
        status: 'initial_send',
        notes: `Initial outreach sent ${new Date().toLocaleDateString('en-CA')}`,
        last_updated: new Date().toISOString(),
      }).eq('id', b.id);

      console.log('[SENT] ' + b.brewery_name + ' -> ' + b.contact_1);
    } catch (err) {
      console.error('[ERROR] ' + b.brewery_name + ': ' + err.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('\nDone.');
}

main().catch(console.error);
