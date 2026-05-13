/**
 * HHS Inbox Checker — v3 (time-based + full thread + bounce detection)
 * - Checks last 2 hours regardless of read/unread status
 * - Reads full thread before classifying sentiment
 * - Detects MAILER-DAEMON bounces, updates notes with which address failed
 * - Only flips status to 'bounced' if ALL sent addresses have bounced
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { createClient } = require('@supabase/supabase-js');

// Load env from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const GMAIL_USER = process.env.HHS_GMAIL_USER || 'hallowedhopsociety@gmail.com';
const GMAIL_APP_PASSWORD = process.env.HHS_GMAIL_APP_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!GMAIL_APP_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing credentials — check .env.local for HHS_GMAIL_APP_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// How far back to check (2 hours in ms)
const WINDOW_MS = 2 * 60 * 60 * 1000;

// --- Bounce detection ---
function isBounceEmail(from, subject) {
  const f = (from || '').toLowerCase();
  const s = (subject || '').toLowerCase();
  return (
    f.includes('mailer-daemon') ||
    f.includes('postmaster') ||
    f.includes('mail delivery') ||
    s.includes('delivery status notification') ||
    s.includes('undeliverable') ||
    s.includes('delivery failure') ||
    s.includes('returned mail') ||
    s.includes('address not found') ||
    s.includes('mail delivery failed')
  );
}

// Extract bounced email addresses from a delivery failure body
function extractBouncedAddresses(body) {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = body.match(emailRegex) || [];
  // Filter out Gmail's own addresses and common system addresses
  return [...new Set(
    matches.filter(e =>
      !e.includes('gmail.com') &&
      !e.includes('google.com') &&
      !e.includes('hallowedhopsociety')
    )
  )];
}

// Parse which emails were originally sent from the notes field
// Notes format: "[YYYY-MM-DD] Initial outreach sent to N emails: a@x, b@x."
function parseSentAddresses(notes) {
  if (!notes) return [];
  const match = notes.match(/sent to \d+ emails?: ([^\n.]+)/i);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim().replace(/\.$/, '').toLowerCase());
}

// --- Sentiment classifier ---
function classifyReply(subject, body) {
  const text = (subject + ' ' + body).toLowerCase();

  const positiveSignals = [
    'yes', 'interested', 'love to', 'would love', 'sounds great', 'count us in',
    'absolutely', 'sure', 'happy to', "let's do", 'let us know', 'great idea',
    "we'd be happy", 'we would be happy', 'definitely', 'sign us up',
    'sounds fun', 'sounds awesome', 'reach out', 'please contact', 'contact us',
    'we are in', "we're in", 'excited', 'draft', 'please contact'
  ];

  const negativeSignals = [
    'not interested', 'no thank', 'unfortunately', 'unable to', "can't participate",
    'cannot participate', 'not at this time', 'not able', 'pass on this',
    'decline', 'not a fit', 'not for us', "don't participate", 'do not participate',
    "won't be able", 'will not be able', 'not available'
  ];

  const positiveScore = positiveSignals.filter(s => text.includes(s)).length;
  const negativeScore = negativeSignals.filter(s => text.includes(s)).length;

  if (negativeScore > positiveScore) return 'declined';
  if (positiveScore > 0) return 'interested';
  return 'replied'; // replied but unclear — needs human review
}

// --- Find brewery by sender email ---
async function findBreweryByEmail(fromEmail) {
  const email = fromEmail.toLowerCase().trim();

  const { data } = await supabase
    .from('brewery_outreach')
    .select('*')
    .or(
      `contact_1.ilike.%${email}%,contact_2.ilike.%${email}%,contact_3.ilike.%${email}%,contact_4.ilike.%${email}%`
    );

  return data?.[0] || null;
}

// --- Fetch all emails from a sender (full thread context) ---
function fetchAllFromSender(imap, fromAddr) {
  return new Promise((resolve) => {
    const sanitized = fromAddr.replace(/['"]/g, '').trim();
    imap.search([['FROM', sanitized]], (err, uids) => {
      if (err || !uids?.length) return resolve('');

      const messages = [];
      const fetch = imap.fetch(uids, { bodies: 'TEXT', struct: false });

      fetch.on('message', (msg) => {
        const p = new Promise((res) => {
          msg.on('body', (stream) => {
            simpleParser(stream, (e, parsed) => {
              if (e) return res('');
              const d = parsed.date ? `[${parsed.date.toLocaleDateString('en-CA')}] ` : '';
              res(d + (parsed.text || '').substring(0, 500));
            });
          });
        });
        messages.push(p);
      });

      fetch.once('end', async () => {
        const parts = await Promise.all(messages);
        resolve(parts.filter(Boolean).join('\n\n---\n\n'));
      });

      fetch.once('error', () => resolve(''));
    });
  });
}

// --- Main inbox check ---
function checkInbox() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: GMAIL_USER,
      password: GMAIL_APP_PASSWORD.replace(/\s/g, ''),
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const results = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        // IMAP SINCE is date-only — go back 2 days, filter by time client-side
        const cutoffTime = new Date(Date.now() - WINDOW_MS);
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 2);
        const dateStr = sinceDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

        // Search ALL emails (read OR unread) — no UNSEEN filter
        imap.search([['SINCE', dateStr]], async (err, uids) => {
          if (err || !uids?.length) {
            console.log(`No emails found since ${dateStr}`);
            imap.end();
            return resolve([]);
          }

          console.log(`${uids.length} emails since ${dateStr} — filtering to last 2 hours...`);
          const fetch = imap.fetch(uids, { bodies: '' });
          const parsePromises = [];

          fetch.on('message', (msg) => {
            const p = new Promise((res) => {
              msg.on('body', (stream) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) return res(null);

                  // Time-gate: only process emails from the last 2 hours
                  const emailDate = parsed.date ? new Date(parsed.date) : new Date(0);
                  if (emailDate < cutoffTime) return res(null);

                  const fromAddr = parsed.from?.value?.[0]?.address || '';
                  const subject = parsed.subject || '';
                  const textBody = parsed.text || '';

                  console.log(`\n  [${emailDate.toISOString()}] From: ${fromAddr}`);
                  console.log(`  Subject: ${subject}`);

                  // Skip emails we sent
                  if (fromAddr.toLowerCase() === GMAIL_USER.toLowerCase()) {
                    return res(null);
                  }

                  // ── BOUNCE DETECTION ────────────────────────────────────────
                  if (isBounceEmail(fromAddr, subject)) {
                    const bouncedAddrs = extractBouncedAddresses(textBody);
                    console.log(`  -> Bounce notification — failed addresses: ${bouncedAddrs.join(', ') || 'unknown'}`);

                    // Try to match to a brewery via the bounced addresses
                    let brewery = null;
                    for (const addr of bouncedAddrs) {
                      brewery = await findBreweryByEmail(addr);
                      if (brewery) break;
                    }

                    if (!brewery) {
                      console.log(`  -> Could not match bounce to a brewery`);
                      return res({ fromAddr, subject, matched: false, bounce: true });
                    }

                    const timestamp = emailDate.toLocaleDateString('en-CA');
                    const existingNotes = brewery.notes || '';
                    const sentAddrs = parseSentAddresses(existingNotes);
                    const totalSent = sentAddrs.length;

                    // Which of the sent addresses have now bounced?
                    const alreadyBounced = (existingNotes.match(/bounced: ([^\n]+)/g) || [])
                      .flatMap(l => l.replace('bounced: ', '').split(',').map(s => s.trim().toLowerCase()));
                    const newBounced = bouncedAddrs.map(a => a.toLowerCase());
                    const allBounced = [...new Set([...alreadyBounced, ...newBounced])];

                    // Build note
                    const bounceNote = `[${timestamp}] Bounce: ${newBounced.join(', ')} — address not found.`;
                    const updatedNotes = existingNotes ? existingNotes + '\n' + bounceNote : bounceNote;

                    // Only flip to 'bounced' status if all sent addresses have bounced
                    const allAddressesBounceed = totalSent > 0 && allBounced.length >= totalSent;
                    const newStatus = allAddressesBounceed ? 'bounced' : brewery.status;

                    if (allAddressesBounceed) {
                      console.log(`  -> ALL ${totalSent} addresses bounced for ${brewery.brewery_name} — marking bounced`);
                    } else {
                      console.log(`  -> ${allBounced.length}/${totalSent || '?'} addresses bounced for ${brewery.brewery_name} — keeping status: ${brewery.status}`);
                    }

                    await supabase.from('brewery_outreach').update({
                      status: newStatus,
                      notes: updatedNotes,
                      last_updated: new Date().toISOString(),
                    }).eq('id', brewery.id);

                    results.push({ brewery: brewery.brewery_name, from: fromAddr, subject, sentiment: 'bounced', bounce: true, bouncedAddrs: newBounced, allBounceed: allAddressesBounceed });
                    return res({ matched: true, brewery: brewery.brewery_name, sentiment: 'bounced', bounce: true });
                  }
                  // ── END BOUNCE DETECTION ─────────────────────────────────────

                  // Find matching brewery by sender email (normal reply)
                  const brewery = await findBreweryByEmail(fromAddr);
                  if (!brewery) {
                    console.log(`  -> No brewery match for ${fromAddr}`);
                    return res({ fromAddr, subject, matched: false });
                  }

                  // Fetch full thread context
                  let threadText = '';
                  try {
                    threadText = await fetchAllFromSender(imap, fromAddr);
                  } catch (e) {
                    threadText = textBody;
                  }

                  const fullContext = threadText || textBody;
                  const sentiment = classifyReply(subject, fullContext);
                  const snippet = textBody.substring(0, 400).replace(/\n+/g, ' ').trim();
                  const timestamp = emailDate.toLocaleDateString('en-CA');

                  const statusMap = {
                    interested: 'interested',
                    declined: 'declined',
                    replied: 'replied',
                  };

                  // Deduplicate: skip if already noted
                  const existingNotes = brewery.notes || '';
                  const snippetKey = snippet.substring(0, 60);
                  if (existingNotes.includes(snippetKey)) {
                    console.log(`  -> Already logged for ${brewery.brewery_name}, skipping`);
                    return res({ matched: true, brewery: brewery.brewery_name, sentiment, alreadyProcessed: true });
                  }

                  const newNote = `[${timestamp}] Reply from ${fromAddr} — ${sentiment.toUpperCase()}: "${snippet}"`;
                  const updatedNotes = existingNotes ? existingNotes + '\n\n' + newNote : newNote;

                  const { error: updateErr } = await supabase
                    .from('brewery_outreach')
                    .update({
                      status: statusMap[sentiment],
                      notes: updatedNotes,
                      last_updated: new Date().toISOString(),
                    })
                    .eq('id', brewery.id);

                  if (updateErr) {
                    console.error(`  -> Supabase error: ${updateErr.message}`);
                  } else {
                    console.log(`  -> ${brewery.brewery_name}: ${sentiment.toUpperCase()} — Supabase updated`);
                  }

                  results.push({ brewery: brewery.brewery_name, from: fromAddr, subject, sentiment, snippet });
                  res({ matched: true, brewery: brewery.brewery_name, sentiment });
                });
              });
            });
            parsePromises.push(p);
          });

          fetch.once('end', async () => {
            await Promise.all(parsePromises);
            imap.end();
            resolve(results);
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// --- Entry point ---
async function main() {
  console.log(`[${new Date().toISOString()}] HHS Inbox Check — window: last 2 hours`);

  try {
    const results = await checkInbox();

    if (results.length === 0) {
      console.log('\nNo new brewery replies in the last 2 hours.');
    } else {
      console.log(`\n=== SUMMARY (${results.length} new replies) ===`);
      for (const r of results) {
        if (r.matched) {
          console.log(`  ${r.brewery}: ${r.sentiment.toUpperCase()}`);
          console.log(`    "${r.snippet?.substring(0, 100)}..."`);
        } else {
          console.log(`  UNMATCHED from ${r.fromAddr} (subject: ${r.subject})`);
        }
      }
    }

    process.stdout.write('\n__RESULTS_JSON__\n');
    process.stdout.write(JSON.stringify(results, null, 2));
    process.stdout.write('\n__END_RESULTS_JSON__\n');

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

main();
