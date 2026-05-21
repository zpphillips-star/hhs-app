/**
 * HHS Test Email — sends formatted HTML test to zpphillips@gmail.com
 */
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dnicdsjvqxthkktlcshe.supabase.co',
  'process.env.SUPABASE_SECRET_KEY'
);

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
  const { data: b, error } = await supabase
    .from('brewery_outreach')
    .select('*')
    .not('contact_1', 'is', null)
    .not('beer_1', 'is', null)
    .limit(1)
    .single();

  if (error) { console.error(error); process.exit(1); }

  const html = buildHtml(b);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'hallowedhopsociety@gmail.com', pass: 'dgrdhvkolhmoufrh' },
  });

  await transporter.sendMail({
    from: 'Hallowed Hop Society <hallowedhopsociety@gmail.com>',
    to: 'zpphillips@gmail.com',
    subject: '[TEST v2] We Want to Buy Your Beer — Hallowed Hop Society 2026',
    html,
  });

  console.log('Sent! Brewery: ' + b.brewery_name);
  console.log('Beer: ' + b.beer_1);
  console.log('Alts: ' + [b.beer_2, b.beer_3, b.beer_4].filter(Boolean).join(', '));
  console.log('Real TO would be: ' + b.contact_1);
}

main().catch(console.error);
