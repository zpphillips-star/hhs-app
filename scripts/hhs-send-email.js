/**
 * HHS Send Email Script
 * Sends a single outreach email to a brewery using Gmail SMTP
 * Usage: node scripts/hhs-send-email.js <brewery_id>
 *        node scripts/hhs-send-email.js --all (sends to all with status='pending' that haven't been contacted)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const GMAIL_USER = process.env.HHS_GMAIL_USER || 'hallowedhopsociety@gmail.com';
const GMAIL_APP_PASSWORD = process.env.HHS_GMAIL_APP_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!GMAIL_APP_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing credentials — check .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD.replace(/\s/g, ''),
  },
});

function buildEmailBody(brewery) {
  const {
    brewery_name,
    beer_1, beer_2, beer_3, beer_4,
  } = brewery;

  const alternateBeerList = [beer_2, beer_3, beer_4].filter(Boolean);
  let howItWorksExtra = '';
  if (alternateBeerList.length > 0) {
    const beerNames = alternateBeerList.map(b => `<b>${b}</b>`).join(', ');
    howItWorksExtra = ` We were also looking at your ${beerNames} &mdash; and would love to ask for your expertise in choosing the right one for our lineup.`;
  }

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:600px;">
  <p>Hi ${brewery_name} team,</p>
  <p>My name is Zach and I run the <b>Hallowed Hop Society</b> &mdash; a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.</p>

  <p style="margin-bottom:2px;">\uD83C\uDF7A <b>Why we're reaching out</b></p>
  <p style="margin-top:2px;">We are preparing for this upcoming season and want to discuss including your beer for this year's Hallowed Hop Society - PNNW - Canada (Pacific North Northwest - Canada) Edition!</p>

  <p style="margin-bottom:2px;">\uD83D\uDCC5 <b>How it works</b></p>
  <p style="margin-top:2px;">We select 31 breweries and assign each one a day in October. All 48 members of the society drink <b>${beer_1}</b> on their assigned day.${howItWorksExtra}</p>

  <p style="margin-bottom:2px;">\uD83D\uDCB0 <b>The purchase</b></p>
  <p style="margin-top:2px;">We'd like to purchase 48 cans of the beer we decide on for pick up in August. All funds collected go purely toward purchasing the beer &mdash; and any extra is donated to <b>VISION Young Leaders' Academy</b>, a close-to-home non-profit dedicated to mentoring youth and building the next generation of community leaders.</p>

  <p style="margin-bottom:2px;">\uD83D\uDCF8 <b>Follow along</b></p>
  <p style="margin-top:2px;">Check us out at <b>@hallowedhopsociety</b> on Instagram &mdash; we'd love to feature ${brewery_name} as part of this year's lineup!</p>

  <p>If you're interested, please reply and we can discuss further details.</p>
  <p>Cheers,<br>Zach<br>Hallowed Hop Society</p>
</div>`;

  // Plain text fallback
  const text = `Hi ${brewery_name} team,\n\nMy name is Zach and I run the Hallowed Hop Society -- a group of craft beer enthusiasts who celebrate every single day of October by drinking the same beer, together.\n\nWhy we're reaching out\nWe are preparing for this upcoming season and want to discuss including your beer for this year's Hallowed Hop Society - PNNW - Canada (Pacific North Northwest - Canada) Edition!\n\nHow it works\nWe select 31 breweries and assign each one a day in October. All 48 members of the society drink ${beer_1} on their assigned day.${alternateBeerList.length > 0 ? ' We were also looking at your ' + alternateBeerList.join(', ') + ' -- and would love to ask for your expertise in choosing the right one for our lineup.' : ''}\n\nThe purchase\nWe'd like to purchase 48 cans of the beer we decide on for pick up in August. All funds collected go purely toward purchasing the beer -- and any extra is donated to VISION Young Leaders' Academy, a close-to-home non-profit dedicated to mentoring youth and building the next generation of community leaders.\n\nFollow along\nCheck us out at @hallowedhopsociety on Instagram -- we'd love to feature ${brewery_name} as part of this year's lineup!\n\nIf you're interested, please reply and we can discuss further details.\n\nCheers,\nZach\nHallowed Hop Society`;

  return { html, text };
}

async function sendToBrewery(brewery, dryRun = false) {
  const {
    id, brewery_name, contact_1, contact_2, contact_3, contact_4, beer_1
  } = brewery;

  if (!contact_1) {
    console.log(`[SKIP] ${brewery_name} — no contact_1 email`);
    return { skipped: true, reason: 'no email' };
  }

  if (!beer_1) {
    console.log(`[SKIP] ${brewery_name} — no beer listed`);
    return { skipped: true, reason: 'no beer' };
  }

  const ccList = [contact_2, contact_3, contact_4].filter(Boolean).join(', ');
  const subject = 'We Want to Buy Your Beer -- Hallowed Hop Society 2026';
  const body = buildEmailBody(brewery);

  const { html, text } = body;

  if (dryRun) {
    console.log('\n=== DRY RUN ===');
    console.log('TO:', mailOptions_to);
    console.log('CC:', ccList || '(none)');
    console.log('SUBJECT:', subject);
    console.log('BODY (text):\n' + text);
    return { sent: false, dryRun: true };
  }

  const mailOptions = {
    from: `Hallowed Hop Society <${GMAIL_USER}>`,
    to: contact_1,
    cc: ccList || undefined,
    subject,
    html,
    text,
  };

  if (dryRun) {
    console.log('\n=== DRY RUN ===');
    console.log('TO:', mailOptions.to);
    console.log('CC:', mailOptions.cc || '(none)');
    console.log('SUBJECT:', subject);
    console.log('BODY:\n' + body);
    return { sent: false, dryRun: true };
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[SENT] ${brewery_name} -> ${contact_1}`);

    // Build delivery note: "Sent to 3 emails: a@x.com, b@x.com, c@x.com"
    const allRecipients = [contact_1, ...ccList.split(', ').filter(Boolean)];
    const deliveryNote = `[${new Date().toLocaleDateString('en-CA')}] Initial outreach sent to ${allRecipients.length} email${allRecipients.length > 1 ? 's' : ''}: ${allRecipients.join(', ')}.`;

    // Update Supabase
    await supabase
      .from('brewery_outreach')
      .update({
        status: 'initial_send',
        last_updated: new Date().toISOString(),
        notes: deliveryNote,
      })
      .eq('id', id);

    return { sent: true };
  } catch (err) {
    console.error(`[ERROR] ${brewery_name}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (args[0] === '--all') {
    // Send to all breweries that haven't been contacted yet
    const { data, error } = await supabase
      .from('brewery_outreach')
      .select('*')
      .in('status', ['pending', null])
      .not('contact_1', 'is', null);

    if (error) { console.error('Supabase error:', error); process.exit(1); }
    console.log(`Found ${data.length} breweries to contact`);

    for (const brewery of data) {
      await sendToBrewery(brewery, dryRun);
      await new Promise(r => setTimeout(r, 1500)); // polite delay
    }
  } else {
    // Send to a specific brewery by ID or name
    const identifier = args[0];
    if (!identifier) {
      console.error('Usage: node hhs-send-email.js <id|brewery_name> [--dry-run]');
      process.exit(1);
    }

    const isId = !isNaN(parseInt(identifier));
    const query = supabase.from('brewery_outreach').select('*');
    const { data, error } = isId
      ? await query.eq('id', parseInt(identifier))
      : await query.ilike('brewery_name', `%${identifier}%`);

    if (error || !data?.length) {
      console.error('Brewery not found:', identifier);
      process.exit(1);
    }

    const brewery = data[0];
    console.log(`Sending to: ${brewery.brewery_name}`);
    await sendToBrewery(brewery, dryRun);
  }
}

main().catch(console.error);
