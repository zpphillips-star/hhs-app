-- HHS setup gate manual override support.
-- Idempotent: safe to run more than once.

-- When setup_override_at is present, the web prelaunch gate treats the
-- approved member as allowed through without altering the normal setup
-- checklist/payment fields.
alter table profiles add column if not exists setup_override_at timestamp with time zone;
alter table profiles add column if not exists setup_override_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_setup_override_at_idx on profiles(setup_override_at);

notify pgrst, 'reload schema';
