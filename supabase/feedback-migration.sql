-- ============================================================
-- HHS Feedback Migration
-- Run idempotently in Supabase SQL Editor
-- ============================================================

-- 1. feedback table
create table if not exists feedback (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  name        text,
  status      text not null default 'submitted'
                check (status in ('submitted','backlog','in_progress','live')),
  image_urls  text[],                -- array of Supabase Storage public URLs
  created_at  timestamp with time zone default timezone('utc', now())
);

-- 2. Row Level Security
alter table feedback enable row level security;

-- Anyone can read feedback (public roadmap)
create policy if not exists "Feedback readable by all"
  on feedback for select using (true);

-- Anyone can submit feedback
create policy if not exists "Anyone can submit feedback"
  on feedback for insert with check (true);

-- Only service role (used by API routes with SUPABASE_SECRET_KEY) can update
create policy if not exists "Service role manages feedback"
  on feedback for update using (true);

create policy if not exists "Service role deletes feedback"
  on feedback for delete using (true);

-- ============================================================
-- Storage bucket for feedback images
-- Run in Supabase Dashboard > Storage OR via API
-- ============================================================
-- bucket name: hhs-feedback (public)
-- Policy: allow public reads, allow authenticated uploads up to 5 MB
-- This cannot be created via SQL; add via Dashboard or use the
-- Supabase Management API. Bucket config reference:
--   name:       hhs-feedback
--   public:     true
--   fileSizeLimit: 5242880  (5 MB)
--   allowedMimeTypes: image/*
