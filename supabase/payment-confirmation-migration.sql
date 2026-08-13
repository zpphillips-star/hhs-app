-- ============================================================
-- HHS Payment Confirmation Migration
-- Adds admin-confirmed payment tracking to profiles.
-- Run in Supabase SQL Editor (idempotent — safe to run again).
-- ============================================================

-- Set only after Zach/admin verifies the Venmo/payment was actually received.
-- venmo_clicked_at remains the member-side "handoff started" signal.
alter table profiles add column if not exists payment_confirmed_at timestamp with time zone;

-- Ask PostgREST/Supabase API to refresh its schema cache so admin selects and
-- updates can reference payment_confirmed_at immediately after the migration.
notify pgrst, 'reload schema';
