-- ============================================================
-- HHS Push Notifications Migration (items 6 & 7)
-- Adds: expo_push_tokens, notification_preferences
-- Run idempotently in the Supabase SQL Editor
-- ============================================================

-- 1. expo_push_tokens — one row per device per user
--    token: the ExponentPushToken[xxxxx] string from Expo
create table if not exists expo_push_tokens (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users on delete cascade not null,
  email         text,
  token         text not null,
  platform      text,                   -- 'ios' | 'android'
  device_id     text,                   -- optional client-supplied device identifier
  created_at    timestamp with time zone default timezone('utc', now()),
  updated_at    timestamp with time zone default timezone('utc', now()),
  unique(user_id, token)
);

-- 2. notification_preferences — one row per user
--    All boolean prefs default to true (opt-in after granting permission)
create table if not exists notification_preferences (
  id                             uuid default gen_random_uuid() primary key,
  user_id                        uuid references auth.users on delete cascade not null unique,
  email                          text,
  daily_beer                     boolean not null default true,
  social_all                     boolean not null default true,
  social_new_comment             boolean not null default true,
  social_new_reaction            boolean not null default true,
  social_reaction_to_your_items  boolean not null default true,
  social_comment_on_your_items   boolean not null default true,
  updated_at                     timestamp with time zone default timezone('utc', now())
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table expo_push_tokens        enable row level security;
alter table notification_preferences enable row level security;

-- expo_push_tokens: users can manage their own rows; service role can read all
create policy "Users can manage own push tokens" on expo_push_tokens
  for all using (auth.uid() = user_id);

-- notification_preferences: users can read/write their own row; service role can read all
create policy "Users can manage own notification preferences" on notification_preferences
  for all using (auth.uid() = user_id);

-- ============================================================
-- Helper: auto-update updated_at on upsert
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_expo_push_tokens_updated_at on expo_push_tokens;
create trigger set_expo_push_tokens_updated_at
  before update on expo_push_tokens
  for each row execute procedure set_updated_at();

drop trigger if exists set_notification_preferences_updated_at on notification_preferences;
create trigger set_notification_preferences_updated_at
  before update on notification_preferences
  for each row execute procedure set_updated_at();
