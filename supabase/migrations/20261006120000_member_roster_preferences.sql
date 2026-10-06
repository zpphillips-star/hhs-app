-- HHS member roster first-name visibility preferences.
-- The roster API remains authenticated and only returns approved members'
-- usernames plus optional first names; it never returns email or last name.

create table if not exists member_roster_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_real_name_in_roster boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function set_member_roster_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists member_roster_preferences_set_updated_at on member_roster_preferences;
create trigger member_roster_preferences_set_updated_at
  before update on member_roster_preferences
  for each row execute procedure set_member_roster_preferences_updated_at();

alter table member_roster_preferences enable row level security;

drop policy if exists "Users can read own roster preference" on member_roster_preferences;
create policy "Users can read own roster preference"
  on member_roster_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own roster preference" on member_roster_preferences;
create policy "Users can insert own roster preference"
  on member_roster_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own roster preference" on member_roster_preferences;
create policy "Users can update own roster preference"
  on member_roster_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists member_roster_preferences_show_name_idx
  on member_roster_preferences (show_real_name_in_roster);
