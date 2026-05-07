-- ============================================================
-- HHS Tier Selection Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Global app settings (single row)
create table if not exists app_settings (
  id integer primary key default 1 check (id = 1), -- enforces single row
  tier_selection_open boolean not null default false
);

-- Seed the single row
insert into app_settings (id, tier_selection_open)
values (1, false)
on conflict (id) do nothing;

-- RLS: anyone authenticated can read, only service role can write
alter table app_settings enable row level security;
create policy "Anyone can read app_settings" on app_settings for select using (true);
create policy "Service role manages app_settings" on app_settings for all using (true);

-- Add tier tracking columns to profiles
alter table profiles add column if not exists tier_selected_at timestamp with time zone;
alter table profiles add column if not exists venmo_clicked_at timestamp with time zone;
