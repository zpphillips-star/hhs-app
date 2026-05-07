-- ============================================================
-- HHS Notification Tracking Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. notification_log: one row per broadcast sent
create table if not exists notification_log (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  url text default '/',
  total_sent integer not null default 0,
  sent_at timestamp with time zone default timezone('utc', now())
);

-- 2. notification_opens: one row per user per notification click
create table if not exists notification_opens (
  id uuid default gen_random_uuid() primary key,
  notification_id uuid references notification_log(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade,
  opened_at timestamp with time zone default timezone('utc', now()),
  unique(notification_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table notification_log enable row level security;
alter table notification_opens enable row level security;

-- Admins (service role) can do everything
create policy "Service role manages notification_log" on notification_log
  for all using (true);

create policy "Service role manages notification_opens" on notification_opens
  for all using (true);

-- Authenticated users can insert their own opens
create policy "Users can log their own opens" on notification_opens
  for insert with check (auth.uid() = user_id);
