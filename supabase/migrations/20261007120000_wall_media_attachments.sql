-- Foundation only: no bucket changes, backfill, posts.media, or existing-post writes.
-- Deployment prerequisite: an operator must set the canonical public post-photos
-- URL in wall_media_private.settings. There is deliberately no production default.
begin;
create schema wall_media_private;
revoke all on schema wall_media_private from public, anon, authenticated;
grant usage on schema wall_media_private to authenticated;
create table wall_media_private.settings (
  singleton boolean primary key default true check (singleton),
  public_storage_base_url text not null check (
    public_storage_base_url ~ '^https?://[^/?#]+/storage/v1/object/public/post-photos/$'
  )
);
revoke all on wall_media_private.settings from public, anon, authenticated;
grant select on wall_media_private.settings to authenticated;

create table public.wall_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('image','gif','video')),
  mime_type text not null,
  storage_bucket text not null default 'post-photos' check (storage_bucket = 'post-photos'),
  storage_path text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  thumbnail_url text,
  width integer check (width > 0),
  height integer check (height > 0),
  duration_ms integer check (duration_ms >= 0),
  sort_order integer not null default 0 check (sort_order between 0 and 5),
  created_at timestamptz not null default now(),
  check (num_nonnulls(post_id, comment_id) = 1),
  unique (post_id, sort_order),
  unique (comment_id, sort_order),
  unique (post_id, storage_bucket, storage_path),
  unique (comment_id, storage_bucket, storage_path)
);
create index wall_media_user_idx on public.wall_media(user_id);

-- INVOKER: parent and object lookups honor the caller's existing RLS.
-- Safe unescaped storage keys cover legacy timestamp names and UUID v153 names.
-- Other keys must not be silently URL-normalized/decoded into a different object.
create function wall_media_private.normalize_media(item jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  base text;
  path text;
  obj storage.objects%rowtype;
  mime text;
  kind text;
  bytes bigint;
  thumb_path text;
  thumb storage.objects%rowtype;
  key text;
begin
  if jsonb_typeof(item) is distinct from 'object' then
    raise exception using errcode='22023', message='Each media item must be an object';
  end if;
  for key in select jsonb_object_keys(item) loop
    if key not in ('media_url','media_type','mime_type','storage_bucket','storage_path',
      'size_bytes','thumbnail_url','width','height','duration_ms','sort_order') then
      raise exception using errcode='22023', message='Unknown media field';
    end if;
  end loop;
  foreach key in array array['media_url','media_type','mime_type','storage_bucket','storage_path','thumbnail_url'] loop
    if item ? key and jsonb_typeof(item->key) not in ('string','null') then
      raise exception using errcode='22023', message='Invalid media string';
    end if;
  end loop;
  foreach key in array array['size_bytes','width','height','duration_ms','sort_order'] loop
    if item ? key and item->key <> 'null'::jsonb then
      if jsonb_typeof(item->key) <> 'number' or (item->>key) !~ '^[0-9]+$'
        or (item->>key)::numeric > (case when key='size_bytes' then 52428800 else 2147483647 end)
        or (key in ('width','height','size_bytes') and (item->>key)::numeric = 0) then
        raise exception using errcode='22023', message='Invalid media integer';
      end if;
    end if;
  end loop;
  select public_storage_base_url into base from wall_media_private.settings where singleton;
  if base is null then
    raise exception using errcode='55000', message='Canonical storage URL not configured';
  end if;
  if coalesce(item->>'storage_bucket','post-photos') <> 'post-photos'
    or item->>'media_url' is null or left(item->>'media_url',length(base)) <> base then
    raise exception using errcode='22023', message='Expected canonical post-photos URL';
  end if;
  path := coalesce(item->>'storage_path',substr(item->>'media_url',length(base)+1));
  if length(path) > 512 or path !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$'
    or path ~ '(^|/)\.\.?(/|$)' or item->>'media_url' <> base || path then
    raise exception using errcode='22023', message='Invalid canonical storage path';
  end if;
  if auth.uid() is null or split_part(path,'/',1) is distinct from auth.uid()::text then
    raise exception using errcode='42501', message='Storage path must start with caller UUID';
  end if;
  select * into obj from storage.objects where bucket_id='post-photos' and name=path;
  if obj.id is null or coalesce(obj.owner_id,obj.owner::text) is distinct from auth.uid()::text then
    raise exception using errcode='42501', message='Existing owned storage object required';
  end if;
  mime := obj.metadata->>'mimetype';
  bytes := (obj.metadata->>'size')::bigint;
  if mime is null or mime not in ('image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm','video/3gpp')
    or bytes is null or bytes <= 0 or bytes > 52428800 then
    raise exception using errcode='22023', message='Unsupported object MIME or size';
  end if;
  kind := case when mime='image/gif' then 'gif' when mime like 'video/%' then 'video' else 'image' end;
  if (item->>'mime_type' is not null and item->>'mime_type' <> mime)
    or (item->>'size_bytes' is not null and (item->>'size_bytes')::bigint <> bytes)
    or (item->>'media_type' is not null and item->>'media_type' <> kind
        and not (kind='gif' and item->>'media_type'='image')) then
    raise exception using errcode='22023', message='Media metadata does not match storage';
  end if;
  if item->>'thumbnail_url' is not null then
    thumb_path := substr(item->>'thumbnail_url',length(base)+1);
    if left(item->>'thumbnail_url',length(base)) <> base
      or length(thumb_path)>512 or thumb_path !~ '^[A-Za-z0-9_-]+(/[A-Za-z0-9_.-]+)+$'
      or thumb_path ~ '(^|/)\.\.?(/|$)' then
      raise exception using errcode='22023', message='Invalid thumbnail URL';
    end if;
    if auth.uid() is null or split_part(thumb_path,'/',1) is distinct from auth.uid()::text then
      raise exception using errcode='42501', message='Thumbnail path must start with caller UUID';
    end if;
    select * into thumb from storage.objects where bucket_id='post-photos' and name=thumb_path;
    if thumb.id is null or coalesce(thumb.owner_id,thumb.owner::text) is distinct from auth.uid()::text
      or coalesce(thumb.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp','image/gif')
      or coalesce((thumb.metadata->>'size')::bigint,0) not between 1 and 52428800 then
      raise exception using errcode='22023', message='Existing owned image thumbnail required';
    end if;
  end if;
  return jsonb_build_object('media_url',base||path,'media_type',kind,'mime_type',mime,
    'storage_bucket','post-photos','storage_path',path,'size_bytes',bytes,
    'thumbnail_url',item->>'thumbnail_url','width',(item->>'width')::integer,
    'height',(item->>'height')::integer,'duration_ms',(item->>'duration_ms')::integer,
    'sort_order',coalesce((item->>'sort_order')::integer,0));
end $$;
revoke all on function wall_media_private.normalize_media(jsonb) from public, anon;
grant execute on function wall_media_private.normalize_media(jsonb) to authenticated;

create function public.validate_wall_media_attachment()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare parent_owner uuid; normalized jsonb;
begin
  if tg_op='UPDATE' then
    -- Rows are immutable, including provenance and order. Delete/insert is explicit.
    raise exception using errcode='42501', message='Wall media identity is immutable';
  end if;
  if auth.uid() is null or new.user_id is distinct from auth.uid()
    or num_nonnulls(new.post_id,new.comment_id) <> 1 then
    raise exception using errcode='42501', message='Exactly one owned parent required';
  end if;
  if new.post_id is not null then
    select user_id into parent_owner from public.posts where id=new.post_id;
  else
    select user_id into parent_owner from public.post_comments where id=new.comment_id;
  end if;
  if parent_owner is distinct from auth.uid() then
    raise exception using errcode='42501', message='Parent must be visible and owned';
  end if;
  normalized := wall_media_private.normalize_media(jsonb_build_object(
    'media_url',new.media_url,'media_type',new.media_type,'mime_type',new.mime_type,
    'storage_bucket',new.storage_bucket,'storage_path',new.storage_path,'size_bytes',new.size_bytes,
    'thumbnail_url',new.thumbnail_url,'width',new.width,'height',new.height,
    'duration_ms',new.duration_ms,'sort_order',new.sort_order));
  new.storage_path := normalized->>'storage_path';
  new.mime_type := normalized->>'mime_type';
  new.media_type := normalized->>'media_type';
  new.size_bytes := (normalized->>'size_bytes')::bigint;
  return new;
end $$;
revoke all on function public.validate_wall_media_attachment() from public, anon, authenticated;
create trigger validate_wall_media_attachment_trigger before insert or update on public.wall_media
for each row execute function public.validate_wall_media_attachment();
alter table public.wall_media enable row level security;
create policy "Visible parent media" on public.wall_media for select to anon, authenticated using (
  (post_id is not null and exists(select 1 from public.posts p where p.id=post_id))
  or (comment_id is not null and exists(select 1 from public.post_comments c where c.id=comment_id))
);
create policy "Owner inserts media" on public.wall_media for insert to authenticated
with check (user_id=auth.uid());
create policy "Owner deletes media" on public.wall_media for delete to authenticated
using (user_id=auth.uid());
revoke all on public.wall_media from public, anon, authenticated, service_role;
grant select on public.wall_media to anon, authenticated;
grant insert, delete on public.wall_media to authenticated;

-- Durable per-user keys. No updates/deletes and no parent FK cascade: deleting a
-- post leaves a tombstone, so a retry cannot resurrect it. The private schema is
-- not exposed by PostgREST. An INVOKER RPC never bypasses posts eligibility RLS.
create table wall_media_private.requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  payload jsonb not null,
  post_id uuid not null,
  primary key(user_id,key)
);
alter table wall_media_private.requests enable row level security;
create policy "Read own requests" on wall_media_private.requests for select to authenticated
using (user_id=auth.uid());
create policy "Record own post request" on wall_media_private.requests for insert to authenticated
with check (user_id=auth.uid() and exists(
  select 1 from public.posts p where p.id=post_id and p.user_id=auth.uid()));
revoke all on wall_media_private.requests from public, anon, authenticated;
grant select,insert on wall_media_private.requests to authenticated;

create function public.create_wall_post_with_media(
  p_content text, p_beer_id uuid, p_media jsonb, p_request_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  content text := btrim(coalesce(p_content,''));
  normalized jsonb := '[]'::jsonb;
  item jsonb;
  payload jsonb;
  path_key text;
  request_key text;
  keys text[] := array[]::text[];
  k text;
  old wall_media_private.requests%rowtype;
  found_id uuid;
  result public.posts%rowtype;
  first_media jsonb;
begin
  if uid is null then raise exception using errcode='42501',message='Authentication required'; end if;
  if jsonb_typeof(p_media) is distinct from 'array' then
    raise exception using errcode='22023',message='media must be an array';
  end if;
  if length(content)>2000 or jsonb_array_length(p_media)>6
    or (content='' and jsonb_array_length(p_media)=0) then
    raise exception using errcode='22023',message='Invalid content or attachment count';
  end if;
  for item in select value from jsonb_array_elements(p_media) loop
    normalized := normalized || jsonb_build_array(wall_media_private.normalize_media(item));
  end loop;
  select coalesce(jsonb_agg(value order by (value->>'sort_order')::integer),'[]'::jsonb)
    into normalized from jsonb_array_elements(normalized);
  if exists(select 1 from jsonb_array_elements(normalized) where (value->>'sort_order')::integer not between 0 and 5)
    or (select count(distinct value->>'sort_order') from jsonb_array_elements(normalized)) <> jsonb_array_length(normalized)
    or (select count(distinct value->>'storage_path') from jsonb_array_elements(normalized)) <> jsonb_array_length(normalized) then
    raise exception using errcode='22023',message='Duplicate media or invalid slot';
  end if;
  payload := jsonb_build_object('content',content,'beer_id',p_beer_id,'media',normalized);
  if jsonb_array_length(normalized)>0 then
    select 'paths:'||encode(sha256(convert_to(jsonb_agg(
      jsonb_build_array(value->>'storage_bucket',value->>'storage_path')
      order by (value->>'sort_order')::integer)::text,'UTF8')),'hex')
      into path_key from jsonb_array_elements(normalized);
    keys := array_append(keys,path_key);
  end if;
  if p_request_id is not null then
    request_key := 'request:'||p_request_id::text;
    keys := array_append(keys,request_key);
  end if;
  -- Every invocation takes path then request locks. Both key types are unique
  -- constraints as well; locks serialize creation before any posts are inserted.
  foreach k in array keys loop
    perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||k,0));
  end loop;
  foreach k in array keys loop
    select * into old from wall_media_private.requests where user_id=uid and key=k;
    if found then
      if old.payload <> payload or (found_id is not null and found_id<>old.post_id) then
        raise exception using errcode='23505',message='Idempotency key reused with different payload';
      end if;
      found_id := old.post_id;
    end if;
  end loop;
  if found_id is not null then
    select * into result from public.posts where id=found_id and user_id=uid;
    if not found then raise exception using errcode='23505',message='Original post no longer exists'; end if;
  else
    first_media := normalized->0;
    insert into public.posts(user_id,beer_id,content,photo_url,media_url,media_type)
    values(uid,p_beer_id,content,first_media->>'media_url',first_media->>'media_url',
      case when first_media is null then null when first_media->>'media_type'='video' then 'video' else 'image' end)
    returning * into result;
    insert into public.wall_media(post_id,user_id,media_url,media_type,mime_type,storage_bucket,
      storage_path,size_bytes,thumbnail_url,width,height,duration_ms,sort_order)
    select result.id,uid,x.media_url,x.media_type,x.mime_type,x.storage_bucket,x.storage_path,
      x.size_bytes,x.thumbnail_url,x.width,x.height,x.duration_ms,x.sort_order
    from jsonb_to_recordset(normalized) as x(media_url text,media_type text,mime_type text,
      storage_bucket text,storage_path text,size_bytes bigint,thumbnail_url text,
      width integer,height integer,duration_ms integer,sort_order integer);
  end if;
  foreach k in array keys loop
    insert into wall_media_private.requests(user_id,key,payload,post_id)
      values(uid,k,payload,result.id) on conflict do nothing;
  end loop;
  return to_jsonb(result);
end $$;
revoke all on function public.create_wall_post_with_media(text,uuid,jsonb,uuid) from public,anon,service_role;
grant execute on function public.create_wall_post_with_media(text,uuid,jsonb,uuid) to authenticated;

-- Scalar readiness contract: 1 when configured, otherwise SQL NULL (JSON null).
-- STABLE/INVOKER supports read-only PostgREST GET with the caller's JWT. Successful
-- discovery also requires this transaction's schema reload; never probe by writing.
-- This is configuration readiness, not posting eligibility or device validation.
create function public.wall_media_capabilities()
returns integer language sql stable security invoker set search_path = '' as $$
  select case when auth.uid() is not null
    and exists(select 1 from wall_media_private.settings where singleton)
    and pg_catalog.to_regclass('public.wall_media') is not null
    and pg_catalog.has_function_privilege(
      current_user,
      pg_catalog.to_regprocedure('public.create_wall_post_with_media(text,uuid,jsonb,uuid)'),
      'EXECUTE')
    then 1 else null end;
$$;
revoke all on function public.wall_media_capabilities() from public, anon, service_role;
grant execute on function public.wall_media_capabilities() to authenticated;
notify pgrst, 'reload schema';
commit;
