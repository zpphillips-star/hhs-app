-- ============================================================
-- HHS Native Membership Columns Migration
-- Adds email + native-flow tracking columns to profiles.
-- Run in Supabase SQL Editor (idempotent — safe to run again).
-- ============================================================

-- Store the member's email directly on the profile.
-- Populated by the native app's /api/native-membership endpoint
-- and by approve-member when creating/approving an account.
alter table profiles add column if not exists email text;

-- Free-text name as received from the native app bridge (fallback
-- when first_name / last_name are not yet split).
alter table profiles add column if not exists display_name_native text;

-- Dollar amount the member selected in the native membership flow.
-- 150 for The Hallowed, 100 for The Oddballs.
alter table profiles add column if not exists native_membership_amount integer;

-- Source tag so admin can see which profile rows came from the native app.
-- Value: 'hhs-native'
alter table profiles add column if not exists native_source text;

-- Optional index so admin queries by email are fast.
create index if not exists profiles_email_idx on profiles (email);

-- ============================================================
-- Update approve-member to also write email going forward:
-- No SQL needed — handled in the API route code.
-- ============================================================
