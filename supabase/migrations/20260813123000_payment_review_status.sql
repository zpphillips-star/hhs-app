-- HHS admin payment review status support.
-- Idempotent: safe to run more than once.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_review_status') then
    create type payment_review_status as enum ('paid', 'not_paid', 'not_reviewed');
  end if;
end
$$;

alter table profiles
  add column if not exists payment_review_status payment_review_status not null default 'not_reviewed',
  add column if not exists payment_confirmed_at timestamp with time zone;

-- Backfill explicit review state from the legacy confirmation timestamp.
update profiles
set payment_review_status = 'paid'
where payment_confirmed_at is not null
  and payment_review_status <> 'paid';

notify pgrst, 'reload schema';
