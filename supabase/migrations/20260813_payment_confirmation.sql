-- HHS payment confirmation / reset support.
-- Idempotent: safe to run more than once.

alter table profiles
  add column if not exists payment_confirmed_at timestamp with time zone;

-- venmo_clicked_at and native_membership_amount are existing member-side
-- payment attempt fields. Admin "not paid" resets clear those fields; no new
-- reset column is required.

notify pgrst, 'reload schema';
