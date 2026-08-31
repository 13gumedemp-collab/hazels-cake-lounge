-- Launch hardening: persistent request limits and least-privilege image uploads.
-- Fingerprints are one-way hashes supplied by trusted server code, never raw IP
-- addresses. The tables have no browser-facing grants or policies.

create table if not exists public.request_rate_limits (
  scope text not null,
  fingerprint text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts >= 1),
  updated_at timestamptz not null default now(),
  primary key (scope, fingerprint)
);

alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from anon, authenticated;

create or replace function public.consume_request_rate_limit(
  p_scope text,
  p_fingerprint text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_limit public.request_rate_limits%rowtype;
  now_at timestamptz := now();
  window_end timestamptz;
begin
  if p_scope not in ('admin_login', 'enquiry', 'occasion_book', 'callback')
    or p_fingerprint !~ '^[a-f0-9]{64}$'
    or p_limit < 1 or p_limit > 20
    or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit request';
  end if;

  -- Keep the small anti-abuse table bounded without retaining an IP address.
  delete from public.request_rate_limits where updated_at < now_at - interval '7 days';

  insert into public.request_rate_limits (scope, fingerprint, window_started_at, attempts, updated_at)
  values (p_scope, p_fingerprint, now_at, 1, now_at)
  on conflict (scope, fingerprint) do nothing
  returning * into current_limit;

  if found then
    return query select true, 0;
    return;
  end if;

  select * into current_limit
  from public.request_rate_limits
  where scope = p_scope and fingerprint = p_fingerprint
  for update;

  if current_limit.window_started_at <= now_at - make_interval(secs => p_window_seconds) then
    update public.request_rate_limits
    set window_started_at = now_at, attempts = 1, updated_at = now_at
    where scope = p_scope and fingerprint = p_fingerprint;
    return query select true, 0;
    return;
  end if;

  if current_limit.attempts >= p_limit then
    window_end := current_limit.window_started_at + make_interval(secs => p_window_seconds);
    return query select false, greatest(1, ceil(extract(epoch from window_end - now_at))::integer);
    return;
  end if;

  update public.request_rate_limits
  set attempts = attempts + 1, updated_at = now_at
  where scope = p_scope and fingerprint = p_fingerprint;
  return query select true, 0;
end;
$$;

revoke all on function public.consume_request_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer) to service_role;

-- All direct browser uploads are confined to the one private inspiration bucket.
-- Service-role functions keep their existing unrestricted access to invoices,
-- review images, profile photos and generated customer documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspiration-photos',
  'inspiration-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- The previous storage rules were set manually before the app had separate
-- private buckets. Reset the direct-object policy surface deliberately, then
-- restore only the two upload paths the browser still needs. Everything else
-- is served through authenticated Edge Functions with short-lived URLs.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy if exists %I on storage.objects', policy_row.policyname);
  end loop;
end;
$$;

create policy "anonymous enquiry and occasion image upload"
on storage.objects for insert to anon
with check (
  bucket_id = 'inspiration-photos'
  and name ~ '^(enq|book)-[a-z0-9]{8,}-[A-Za-z0-9._-]{1,100}$'
);

create policy "customers upload their own inspiration images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'inspiration-photos'
  and exists (
    select 1
    from public.customers
    where customers.id::text = (storage.foldername(name))[1]
      and customers.auth_user_id = auth.uid()
  )
);
