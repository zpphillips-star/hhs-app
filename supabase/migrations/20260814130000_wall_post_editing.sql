-- Allow HHS Wall members to edit only their own post text.
-- `updated_at` supports an "edited" indicator without changing post ownership,
-- beer tagging, photos, reactions, comments, or delete behavior.

alter table posts
  add column if not exists updated_at timestamp with time zone;

drop policy if exists "Users can update own posts" on posts;
create policy "Users can update own posts"
  on posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);