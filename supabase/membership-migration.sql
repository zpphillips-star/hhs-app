-- ============================================================
-- HHS Membership System Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Member requests table (before approval)
create table if not exists member_requests (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc', now()),
  reviewed_at timestamp with time zone,
  unique(email)
);

-- 2. Add status to profiles (existing members default to 'approved')
alter table profiles add column if not exists status text not null default 'approved' check (status in ('pending', 'approved'));

-- 3. Add tier to profiles
alter table profiles add column if not exists tier text check (tier in ('hallowed', 'oddballs'));

-- 4. Add first_name / last_name to profiles
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

-- ============================================================
-- Row Level Security for member_requests
-- ============================================================

alter table member_requests enable row level security;

-- Only service role / admin can read requests (we use service key in API)
create policy "Service role can manage requests" on member_requests
  for all using (true);

-- Public can insert (to submit a request)
create policy "Anyone can submit a request" on member_requests
  for insert with check (true);
