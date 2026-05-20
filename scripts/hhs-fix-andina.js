const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://dnicdsjvqxthkktlcshe.supabase.co',
  'process.env.SUPABASE_SECRET_KEY'
);

async function run() {
  // Expand status constraint to include bounced + other needed values
  const drop = `ALTER TABLE brewery_outreach DROP CONSTRAINT IF EXISTS brewery_outreach_status_check`;
  const add  = `ALTER TABLE brewery_outreach ADD CONSTRAINT brewery_outreach_status_check CHECK (status IN ('pending','initial_send','interested','declined','replied','bounced','agreed','skipped'))`;

  const r1 = await sb.rpc('exec_sql', { sql: drop });
  console.log('Drop constraint:', r1.error?.message || 'ok');

  const r2 = await sb.rpc('exec_sql', { sql: add });
  console.log('Add constraint:', r2.error?.message || 'ok');

  // Update Andina
  const notes = 'Initial outreach sent 2026-05-13 — Sent to 2 emails (info@andinabrewing.ca, orders@andinabrewing.ca). Both addresses rejected (address not found). Needs new contact info.';
  const { error } = await sb
    .from('brewery_outreach')
    .update({ notes, status: 'bounced', last_updated: new Date().toISOString() })
    .eq('id', 95);

  if (error) console.error('Update error:', error.message);
  else console.log('Andina updated — status: bounced');
}

run().catch(console.error);
