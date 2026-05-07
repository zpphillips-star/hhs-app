-- Add PWA install tracking to profiles
alter table profiles add column if not exists has_pwa boolean not null default false;
