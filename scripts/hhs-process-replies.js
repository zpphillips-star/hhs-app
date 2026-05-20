require("dotenv").config({ path: require("path").join(__dirname, "../.env.local") });
const Imap = require("imap");
const { simpleParser } = require("mailparser");
const { createClient } = require("@supabase/supabase-js");

const GMAIL_USER = "hallowedhopsociety@gmail.com";
const GMAIL_PASS = (process.env.HHS_GMAIL_APP_PASSWORD || "dgrd hvko lhmo ufrh").replace(/\s/g,"");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

function isBounce(from, subj) {
  const f = (from||"").toLowerCase(), s = (subj||"").toLowerCase();
  return f.includes("mailer-daemon") || f.includes("postmaster") || f.includes("mail delivery") ||
    s.includes("delivery status") || s.includes("undeliverable") || s.includes("delivery failure") ||
    s.includes("returned mail") || s.includes("address not found") || s.includes("mail delivery failed");
}

function isAutoReply(subj, body) {
  const t = ((subj||"")+" "+(body||"")).toLowerCase();
  return t.includes("auto") || t.includes("out of office") || t.includes("automatic reply") ||
    t.includes("thank you for contacting") || t.includes("thank you for your email") ||
    t.includes("we have received your") || t.includes("this is an automated");
}

function extractEmails(text) {
  return [...new Set((text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)||[])
    .filter(e => !e.includes("gmail.com") && !e.includes("google.com") && !e.includes("hallowedhopsociety") && !e.includes("googlemail.com")))];
}

async function findBrewery(email) {
  if(!email) return null;
  const { data } = await sb.from("brewery_outreach").select("*")
    .or(`contact_1.ilike.%${email}%,contact_2.ilike.%${email}%,contact_3.ilike.%${email}%,contact_4.ilike.%${email}%`);
  return data?.[0] || null;
}

function parseSentAddresses(notes) {
  if(!notes) return [];
  const m = notes.match(/sent to \d+ emails?: ([^\n.]+)/i);
  return m ? m[1].split(",").map(s=>s.trim().toLowerCase().replace(/\.$/,"")) : [];
}

async function run() {
  const TWO_HOURS = 2*60*60*1000;
  const cutoff = new Date(Date.now() - TWO_HOURS);

  const imap = new Imap({
    user: GMAIL_USER, password: GMAIL_PASS,
    host: "imap.gmail.com", port: 993, tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });

  const emails = await new Promise((resolve, reject) => {
    const collected = [];
    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err) => {
        if(err) return reject(err);
        const since = new Date(); since.setDate(since.getDate()-2);
        const dateStr = since.toLocaleDateString("en-US",{day:"2-digit",month:"short",year:"numeric"});
        imap.search([["SINCE", dateStr]], (err, uids) => {
          if(err || !uids?.length) { imap.end(); return resolve([]); }
          const fetch = imap.fetch(uids, { bodies: "" });
          const promises = [];
          fetch.on("message", msg => {
            promises.push(new Promise(res => {
              msg.on("body", stream => {
                simpleParser(stream, (e, parsed) => {
                  if(e) return res(null);
                  const d = parsed.date ? new Date(parsed.date) : new Date(0);
                  if(d < cutoff) return res(null);
                  res({
                    from: parsed.from?.value?.[0]?.address || "",
                    fromName: parsed.from?.value?.[0]?.name || "",
                    subject: parsed.subject || "",
                    text: parsed.text || "",
                    date: d
                  });
                });
              });
            }));
          });
          fetch.once("end", async () => {
            const all = await Promise.all(promises);
            imap.end();
            resolve(all.filter(Boolean));
          });
        });
      });
    });
    imap.once("error", reject);
    imap.connect();
  });

  console.log(`\nFound ${emails.length} emails in last 2 hours\n`);

  const updates = [];
  const skipped = [];

  for(const email of emails) {
    const { from, subject, text, date } = email;
    if(from.toLowerCase() === GMAIL_USER.toLowerCase()) continue;

    const ts = date.toLocaleDateString("en-CA");
    let brewery = null;
    let type = "";
    let note = "";
    let newStatus = null;

    // --- BOUNCE ---
    if(isBounce(from, subject)) {
      const bouncedAddrs = extractEmails(text);
      for(const addr of bouncedAddrs) {
        brewery = await findBrewery(addr);
        if(brewery) break;
      }
      if(!brewery) { skipped.push({ from, subject, reason: "bounce-no-match", bouncedAddrs }); continue; }

      const sentAddrs = parseSentAddresses(brewery.notes || "");
      const newBounced = bouncedAddrs.map(a=>a.toLowerCase());

      // Check existing bounces in notes
      const existingBounceMatches = (brewery.notes||"").match(/Bounce: ([^\n]+)/g)||[];
      const alreadyBounced = existingBounceMatches.flatMap(l => extractEmails(l));
      const allBounced = [...new Set([...alreadyBounced, ...newBounced])];

      const allGone = sentAddrs.length > 0 && allBounced.length >= sentAddrs.length;
      newStatus = allGone ? "bounced" : brewery.status;
      note = `[${ts}] Bounce: ${newBounced.join(", ")} — address not found.${allGone ? " ALL emails bounced." : ""}`;
      type = allGone ? "ALL_BOUNCE" : "PARTIAL_BOUNCE";
    }
    // --- AUTO-REPLY ---
    else if(isAutoReply(subject, text)) {
      brewery = await findBrewery(from);
      if(!brewery) { skipped.push({ from, subject, reason: "auto-reply-no-match" }); continue; }
      newStatus = "initial_send"; // keep as initial_send — it was just an auto-reply, not a real response
      note = `[${ts}] Auto-reply received from ${from}.`;
      type = "AUTO_REPLY";
    }
    // --- REAL REPLY ---
    else {
      brewery = await findBrewery(from);
      if(!brewery) { skipped.push({ from, subject, reason: "reply-no-match" }); continue; }
      const txt = (subject+" "+text).toLowerCase();
      const pos = ["yes","interested","love to","would love","sounds great","count us in","absolutely","sure","happy to","let us know","contact us","we are in","excited","draft"].filter(s=>txt.includes(s)).length;
      const neg = ["not interested","no thank","unfortunately","unable to","not at this time","decline","not a fit","won\"t be able"].filter(s=>txt.includes(s)).length;
      const sentiment = neg > pos ? "declined" : pos > 0 ? "interested" : "replied";
      newStatus = sentiment;
      const snippet = text.substring(0,300).replace(/\n+/g," ").trim();
      note = `[${ts}] Reply from ${from} — ${sentiment.toUpperCase()}: "${snippet}"`;
      type = "REPLY_" + sentiment.toUpperCase();
    }

    if(!brewery || !note) continue;

    // Deduplicate
    if((brewery.notes||"").includes(note.substring(0,50))) {
      skipped.push({ from, subject, reason: "already-logged" }); continue;
    }

    const updatedNotes = brewery.notes ? brewery.notes + "\n" + note : note;
    const updatePayload = { notes: updatedNotes, last_updated: new Date().toISOString() };
    if(newStatus && newStatus !== brewery.status) updatePayload.status = newStatus;

    const { error } = await sb.from("brewery_outreach").update(updatePayload).eq("id", brewery.id);
    if(error) {
      console.log("ERROR updating " + brewery.brewery_name + ": " + error.message);
    } else {
      console.log("[" + type + "] " + brewery.brewery_name + " -> status: " + (newStatus||brewery.status));
      console.log("  note: " + note.substring(0,100));
      updates.push({ brewery: brewery.brewery_name, type, newStatus, note });
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log("Updated: " + updates.length + " | Skipped: " + skipped.length);
  if(updates.length) {
    console.log("\nUPDATED:");
    updates.forEach(u => console.log("  [" + u.type + "] " + u.brewery + " -> " + (u.newStatus||"no status change")));
  }
  if(skipped.length) {
    console.log("\nSKIPPED (no match):");
    skipped.forEach(s => console.log("  " + s.reason + " | from: " + s.from + " | " + s.subject));
  }
}
run().catch(console.error);
