const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dnicdsjvqxthkktlcshe.supabase.co';
const SUPABASE_KEY = 'process.env.SUPABASE_SECRET_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hallowedhopsociety@gmail.com',
    pass: 'dgrd hvko lhmo ufrh'
  }
});

const alreadySentBreweries = [
  'Barnside Brewing',
  'Beva Brewing & Blending',
  'Five Roads Brewing',
  'North Point Brewing',
  'Steamworks Brewery & Taproom',
  'Steamworks Brew Pub',
  'Way Back Brewing'
];

const subject = 'Update on Our 2026 Hallowed Hop Society Outreach';

const bodyText = `Hi there,

I reached out to you yesterday about Hallowed Hop Society 2026 — and I wanted to follow up with some disappointing news.

It is looking like the cost and logistics to get 1,500 cans across the border is climbing too high for this year's international location for HHS to be viable.

Over the past day I've been speaking with customs brokers, ATF, and customs agents. Even though we are not reselling this, they would treat this quantity as a corporation and tax us quite a bit — not to mention the custom brokerage fees.

I apologize, but I'm going to have to shut down the operation focusing on Vancouver, BC for this year and stick to US breweries. I have all of your contact information — WE WILL get a Vancouver, BC HHS run in!

In the meantime, feel free to follow along on Instagram -> @HallowedHopSociety

Thanks,
Zach`;

function isValidEmail(str) {
  return str && str.includes('@') && str.includes('.');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { data: breweries, error } = await supabase
    .from('brewery_outreach')
    .select('id, brewery_name, contact_1, status, notes')
    .not('status', 'eq', 'bounced')
    .order('brewery_name');

  if (error) { console.error('Supabase error:', JSON.stringify(error)); process.exit(1); }

  console.log('Total non-bounced breweries:', breweries.length);
  let sent = 0, skipped = 0, failed = 0;

  for (const b of breweries) {
    if (alreadySentBreweries.includes(b.brewery_name)) {
      console.log('SKIP (already sent):', b.brewery_name);
      skipped++;
      continue;
    }
    if (!isValidEmail(b.contact_1)) {
      console.log('SKIP (no email):', b.brewery_name);
      skipped++;
      continue;
    }

    try {
      await transporter.sendMail({
        from: '"Zach | Hallowed Hop Society" <hallowedhopsociety@gmail.com>',
        to: b.contact_1,
        subject: subject,
        text: bodyText
      });
      const today = new Date().toISOString().split('T')[0];
      const newNote = (b.notes ? b.notes + '\n' : '') + `[${today}] Shutdown email sent — Vancouver BC cancelled for 2026 due to border/customs costs.`;
      await supabase.from('brewery_outreach').update({ notes: newNote, last_updated: new Date().toISOString() }).eq('id', b.id);
      console.log('SENT:', b.brewery_name, '->', b.contact_1);
      sent++;
      await sleep(400);
    } catch (err) {
      console.log('FAIL:', b.brewery_name, err.message);
      failed++;
    }
  }

  console.log(`\nDONE: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

main();
