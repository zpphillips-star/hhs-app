-- HHS web next-version readiness safeguards.
-- Applied to the linked Supabase project during the web readiness pass.

-- Keep the existing feedback_items table as canonical. A short-lived web
-- readiness pass used "feedback", but production feedback already lives here.
create table if not exists feedback_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  name text,
  email text,
  status text not null default 'submitted' check (status in ('submitted','backlog','in_progress','live')),
  image_urls text[],
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

alter table feedback_items enable row level security;

drop policy if exists "Feedback readable by all" on feedback_items;
create policy "Feedback readable by all"
  on feedback_items for select using (true);

drop policy if exists "Anyone can submit feedback" on feedback_items;
create policy "Anyone can submit feedback"
  on feedback_items for insert with check (true);

drop policy if exists "Service role manages feedback" on feedback_items;
create policy "Service role manages feedback"
  on feedback_items for update using (auth.role() = 'service_role');

drop policy if exists "Service role deletes feedback" on feedback_items;
create policy "Service role deletes feedback"
  on feedback_items for delete using (auth.role() = 'service_role');

create or replace function public.hhs_can_interact_with_beer(target_user_id uuid, target_beer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case
        when lower(coalesce(p.tier, '')) in ('oddballs','oddball','odd','oddbeer','oddbeers','oddsonly','odddays','16')
          then (b.day_number % 2 = 1)
        else true
      end
      from public.beers b
      left join public.profiles p on p.id = target_user_id
      where b.id = target_beer_id
      limit 1
    ),
    false
  );
$$;

drop policy if exists "Users can insert own ratings" on ratings;
create policy "Users can insert own ratings"
  on ratings for insert
  with check (auth.uid() = user_id and public.hhs_can_interact_with_beer(auth.uid(), beer_id));

drop policy if exists "Users can update own ratings" on ratings;
create policy "Users can update own ratings"
  on ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.hhs_can_interact_with_beer(auth.uid(), beer_id));

drop policy if exists "Authenticated users can insert posts" on posts;
drop policy if exists "Users can insert own posts" on posts;
create policy "Users can insert eligible posts"
  on posts for insert
  with check (auth.uid() = user_id and (beer_id is null or public.hhs_can_interact_with_beer(auth.uid(), beer_id)));
