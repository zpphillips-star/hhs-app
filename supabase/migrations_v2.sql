-- ============================================================
-- HHS Schema v2 — Wall, Reactions, Comments, AI Notes
-- Run this in Supabase SQL Editor (additive — safe to run on existing DB)
-- ============================================================

-- Add ai_notes column to beers
alter table beers add column if not exists ai_notes text;

-- 4. Posts (wall posts per beer)
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  beer_id uuid references beers on delete cascade not null,
  content text not null,
  photo_url text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 5. Post Reactions (toggle per user per reaction per post)
create table if not exists post_reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  reaction text not null check (reaction in ('cheers', 'dead', 'fire', 'trophy', 'rough')),
  created_at timestamp with time zone default timezone('utc', now()),
  unique(post_id, user_id, reaction)
);

-- 6. Post Comments
create table if not exists post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table posts enable row level security;
alter table post_reactions enable row level security;
alter table post_comments enable row level security;

-- Posts: anyone can read, users can manage their own
create policy "Posts readable by all" on posts for select using (true);
create policy "Users can insert own posts" on posts for insert with check (auth.uid() = user_id);
create policy "Users can delete own posts" on posts for delete using (auth.uid() = user_id);

-- Post reactions: anyone can read, users can manage their own
create policy "Reactions readable by all" on post_reactions for select using (true);
create policy "Users can insert own reactions" on post_reactions for insert with check (auth.uid() = user_id);
create policy "Users can delete own reactions" on post_reactions for delete using (auth.uid() = user_id);

-- Post comments: anyone can read, users can manage their own
create policy "Comments readable by all" on post_comments for select using (true);
create policy "Users can insert own comments" on post_comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on post_comments for delete using (auth.uid() = user_id);

-- ============================================================
-- Supabase Storage bucket for post photos
-- ============================================================
-- Run this too (or create via dashboard: Storage > New bucket > "post-photos" > Public)
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

create policy "Public read post photos" on storage.objects
  for select using (bucket_id = 'post-photos');

create policy "Auth users can upload post photos" on storage.objects
  for insert with check (bucket_id = 'post-photos' and auth.role() = 'authenticated');

create policy "Users can delete own post photos" on storage.objects
  for delete using (bucket_id = 'post-photos' and auth.uid()::text = (storage.foldername(name))[1]);
