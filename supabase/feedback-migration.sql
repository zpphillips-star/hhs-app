-- ─────────────────────────────────────────────────────────────────────────────
-- HHS Feedback Feature Migration  (idempotent — safe to run multiple times)
-- Run once in the Supabase SQL editor for hallowedhopsociety.com
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Feedback items table
create table if not exists feedback_items (
  id          uuid        default gen_random_uuid() primary key,
  title       text        not null,
  description text,
  name        text,
  email       text,
  status      text        not null default 'submitted',
  image_urls  text[]      not null default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Add image_urls column if table already existed without it (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'feedback_items' and column_name = 'image_urls'
  ) then
    alter table feedback_items add column image_urls text[] not null default '{}';
  end if;
end $$;

-- 3. Add email column if missing (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'feedback_items' and column_name = 'email'
  ) then
    alter table feedback_items add column email text;
  end if;
end $$;

-- 4. Auto-update updated_at trigger
create or replace function update_feedback_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_items_updated_at on feedback_items;
create trigger feedback_items_updated_at
  before update on feedback_items
  for each row execute procedure update_feedback_updated_at();

-- 5. Row Level Security
alter table feedback_items enable row level security;

-- Public: anyone can read all items (for the roadmap/feedback board)
drop policy if exists "HHS feedback public read" on feedback_items;
create policy "HHS feedback public read"
  on feedback_items for select using (true);

-- Public: anyone can submit feedback
drop policy if exists "HHS feedback public insert" on feedback_items;
create policy "HHS feedback public insert"
  on feedback_items for insert with check (true);

-- Admin only: authenticated users can update status
drop policy if exists "HHS feedback admin update" on feedback_items;
create policy "HHS feedback admin update"
  on feedback_items for update using (auth.role() = 'authenticated');

-- Admin only: authenticated users can delete
drop policy if exists "HHS feedback admin delete" on feedback_items;
create policy "HHS feedback admin delete"
  on feedback_items for delete using (auth.role() = 'authenticated');

-- 6. Storage bucket for feedback images (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-images',
  'feedback-images',
  true,
  5242880,  -- 5 MB per image
  array['image/jpeg','image/png','image/gif','image/webp','image/heic']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/gif','image/webp','image/heic'];

-- 7. Storage policies for feedback images
drop policy if exists "HHS feedback image public upload" on storage.objects;
create policy "HHS feedback image public upload"
  on storage.objects for insert
  with check (bucket_id = 'feedback-images');

drop policy if exists "HHS feedback image public read" on storage.objects;
create policy "HHS feedback image public read"
  on storage.objects for select
  using (bucket_id = 'feedback-images');

drop policy if exists "HHS feedback image admin delete" on storage.objects;
create policy "HHS feedback image admin delete"
  on storage.objects for delete
  using (bucket_id = 'feedback-images' and auth.role() = 'authenticated');
