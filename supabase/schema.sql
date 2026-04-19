-- ============================================================
-- Hallowed Hop Society — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Profiles (one per user, auto-created on signup)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 2. Beers (the 31 beers of October)
create table if not exists beers (
  id uuid default gen_random_uuid() primary key,
  day_number integer unique not null check (day_number between 1 and 31),
  name text not null,
  brewery text not null,
  style text,
  abv decimal(4,2),
  description text,
  image_url text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 3. Ratings (one rating per user per beer, updatable)
create table if not exists ratings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  beer_id uuid references beers on delete cascade not null,
  stars integer not null check (stars between 1 and 5),
  notes text,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(user_id, beer_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table beers enable row level security;
alter table ratings enable row level security;

-- Profiles: anyone can read, users can manage their own
create policy "Profiles readable by all" on profiles for select using (true);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Beers: anyone can read, anyone authenticated can write (admin page)
create policy "Beers readable by all" on beers for select using (true);
create policy "Authenticated users can insert beers" on beers for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update beers" on beers for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete beers" on beers for delete using (auth.role() = 'authenticated');

-- Ratings: anyone can read, users can manage their own
create policy "Ratings readable by all" on ratings for select using (true);
create policy "Users can insert own ratings" on ratings for insert with check (auth.uid() = user_id);
create policy "Users can update own ratings" on ratings for update using (auth.uid() = user_id);
create policy "Users can delete own ratings" on ratings for delete using (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
