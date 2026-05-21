/**
 * HHS Resend — Barnside Brewing, personalized to Darren Lof + Glen Hutton
 */
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dnicdsjvqxthkktlcshe.supabase.co',
  'process.env.SUPABASE_SECRET_KEY'
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'hallowedhopsociety@gmail.com', pass: 'dgrdhvkolhmoufrh' },
});

const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:600px;">
<p>Hi Darren,</p>
<p>My name is Zach and I run the <b>Hallowed Hop Society</b> &mdash; a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.</p>
<p style="margin-bottom:2px;">&#127866; <b>Why we're reaching out</b></p>
<p style="margin-top:2px;">We are preparing for this upcoming season and want to discuss including your beer for this year's Hallowed Hop Society - PNNW - Canada (Pacific North Northwest - Canada) Edition!</p>
<p style="margin-bottom:2px;">&#128197; <b>How it works</b></p>
<p style="margin-top:2px;">We select 31 breweries and assign each one a day in October. All 48 members of the society drink <b>Five For Fighting Hazy Pale</b> on their assigned day. We were also looking at your <b>Batch 300 Estate Barleywine</b>, <b>Ladera Pilsner</b>, <b>Cranberry Sour</b> &mdash; and would love to ask for your expertise (and Glen's!) in choosing the right one for our lineup.</p>
<p style="margin-bottom:2px;">&#128176; <b>The purchase</b></p>
<p style="margin-top:2px;">We'd like to purchase 48 cans of the beer we decide on for pick up in August. All funds collected go purely toward purchasing the beer &mdash; and any extra is donated to <b>VISION Young Leaders' Academy</b>, a close-to-home non-profit dedicated to mentoring youth and building the next generation of community leaders.</p>
<p style="margin-bottom:2px;">&#128248; <b>Follow along</b></p>
<p style="margin-top:2px;">Check us out at <b>@hallowedhopsociety</b> on Instagram &mdash; we'd love to feature Barnside Brewing as part of this year's lineup!</p>
<p>If you're interested, please reply and we can discuss further details.</p>
<p>Cheers,<br>Zach<br>Hallowed Hop Society</p>
</div>`;

async function main() {
  await transporter.sendMail({
    from: 'Hallowed Hop Society <hallowedhopsociety@gmail.com>',
    to: 'beer@barnsidebrewing.ca',
    cc: 'glenh@barnsidebrewing.ca',
    subject: "We Want to Buy Your Beer \u2014 Hallowed Hop Society 2026",
    html,
  });

  await supabase.from('brewery_outreach').update({
    notes: 'Replied to initial outreach. Darren Lof (beer@barnsidebrewing.ca) primary. Glen Hutton (glenh@barnsidebrewing.ca) CC\'d for draft selection. Personalized resend 2026-05-13.',
    last_updated: new Date().toISOString(),
  }).ilike('brewery_name', '%Barnside%');

  console.log('Sent to Darren Lof (beer@barnsidebrewing.ca), CC Glen Hutton (glenh@barnsidebrewing.ca)');
}

main().catch(console.error);
