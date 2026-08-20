-- Allow HHS Wall members to edit only their own comment text.
-- `updated_at` supports an "edited" indicator without changing comment
-- ownership, post ownership, reactions, moderation, or delete behavior.

alter table post_comments
  add column if not exists updated_at timestamp with time zone;

update post_comments
set updated_at = created_at
where updated_at is null;

drop policy if exists "Users can update own post comments" on post_comments;
create policy "Users can update own post comments"
  on post_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
