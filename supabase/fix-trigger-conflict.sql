-- Fix handle_new_user trigger to handle BOTH id AND username conflicts
-- (username is UNIQUE — if an old profile exists with same username, we suffix it)
create or replace function handle_new_user()
returns trigger as $$
declare
  base_uname text;
  final_uname text;
  suffix int := 0;
begin
  base_uname := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1)
  );
  final_uname := base_uname;

  -- Find a unique username (append number if taken)
  while exists (select 1 from profiles where username = final_uname) loop
    suffix := suffix + 1;
    final_uname := base_uname || suffix::text;
  end loop;

  insert into profiles (id, username, display_name)
  values (new.id, final_uname, final_uname)
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Also clean up any orphaned profiles (no matching auth user)
delete from profiles
where id not in (select id from auth.users);
