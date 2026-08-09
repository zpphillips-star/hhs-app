-- ============================================================
-- HHS Notification Preferences + Push Tokens Migration
-- Run idempotently in Supabase SQL Editor
-- ============================================================

-- 1. notification_preferences — per-user category preferences
create table if not exists notification_preferences (
  user_id                 uuid references auth.users on delete cascade primary key,
  daily_beer_enabled      boolean not null default true,
  social_enabled          boolean not null default true,
  social_new_comment      boolean not null default true,
  social_new_reaction     boolean not null default true,
  social_reaction_to_yours boolean not null default true,
  social_comment_on_yours boolean not null default true,
  updated_at              timestamp with time zone default timezone('utc', now())
);

-- 2. push_tokens — stores Expo/native push tokens per user device
--    (separate from web push_subscriptions which stores VAPID-based subs)
create table if not exists push_tokens (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  token      text not null,
  platform   text,                      -- 'ios' | 'android'
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now()),
  unique(user_id, token)
);

-- 3. Row Level Security
alter table notification_preferences enable row level security;
alter table push_tokens enable row level security;

create policy if not exists "Users read own prefs"
  on notification_preferences for select using (auth.uid() = user_id);

create policy if not exists "Users upsert own prefs"
  on notification_preferences for insert with check (auth.uid() = user_id);

create policy if not exists "Users update own prefs"
  on notification_preferences for update using (auth.uid() = user_id);

create policy if not exists "Service role manages prefs"
  on notification_preferences for all using (true);

create policy if not exists "Users read own push tokens"
  on push_tokens for select using (auth.uid() = user_id);

create policy if not exists "Users insert own push tokens"
  on push_tokens for insert with check (auth.uid() = user_id);

create policy if not exists "Service role manages push tokens"
  on push_tokens for all using (true);

-- ============================================================
-- Trigger: auto-set updated_at on preference changes
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_notification_preferences_updated_at on notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

drop trigger if exists set_push_tokens_updated_at on push_tokens;
create trigger set_push_tokens_updated_at
  before update on push_tokens
  for each row execute function set_updated_at();
