-- Add generic Wall media metadata while preserving existing photo_url behavior.
-- Existing image posts keep rendering from photo_url; new native video posts can
-- set media_url + media_type='video' for explicit cross-client playback.

alter table posts
  add column if not exists media_url text,
  add column if not exists media_type text;

update posts
set
  media_url = coalesce(media_url, photo_url),
  media_type = coalesce(media_type, case when photo_url is not null then 'image' else null end)
where photo_url is not null
  and (media_url is null or media_type is null);

alter table posts
  drop constraint if exists posts_media_type_check;

alter table posts
  add constraint posts_media_type_check
  check (media_type is null or media_type in ('image', 'video'));
