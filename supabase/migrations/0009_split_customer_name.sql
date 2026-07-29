-- ============================================================================
-- 0009: keep first name and surname separately
--
-- full_name stays as the single source used by every email template and the
-- admin board, so nothing downstream changes. first_name and last_name are
-- captured at sign up and kept in step by a trigger, which means a surname
-- with a space in it survives instead of being guessed at by splitting.
-- ============================================================================

alter table public.customers add column if not exists first_name text;
alter table public.customers add column if not exists last_name  text;

-- Backfill from what we already hold: first word is the given name, the rest
-- is the surname.
update public.customers
   set first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
       last_name  = coalesce(last_name,  nullif(trim(substring(full_name from position(' ' in full_name) + 1)), ''))
 where full_name is not null
   and (first_name is null or last_name is null)
   and position(' ' in full_name) > 0;

update public.customers
   set first_name = coalesce(first_name, nullif(trim(full_name), ''))
 where first_name is null;

create or replace function public.sync_customer_full_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only rebuild full_name when the parts are the thing being set, so an
  -- admin editing full_name directly is never overwritten.
  if (new.first_name is distinct from old.first_name)
     or (new.last_name is distinct from old.last_name)
     or tg_op = 'INSERT' then
    if coalesce(nullif(trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), ''), '') <> '' then
      new.full_name := trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_sync_full_name on public.customers;
create trigger customers_sync_full_name
before insert or update of first_name, last_name on public.customers
for each row execute function public.sync_customer_full_name();

-- Sign up now sends first_name and last_name as user metadata.
create or replace function public.link_customer_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  real_email     text := lower(nullif(trim(new.email), ''));
  resolved_email text := coalesce(real_email, 'no-email+' || new.id::text || '@hazelscakelounge.co.za');
  meta_first     text := nullif(trim(new.raw_user_meta_data->>'first_name'), '');
  meta_last      text := nullif(trim(new.raw_user_meta_data->>'last_name'), '');
  resolved_name  text := coalesce(
    nullif(trim(coalesce(meta_first, '') || ' ' || coalesce(meta_last, '')), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(real_email, ''), '@', 1), ''),
    'New customer'
  );
begin
  insert into public.customers(full_name, first_name, last_name, email, auth_user_id,
                               email_consent, whatsapp_consent, phone_call_consent)
  values (
    resolved_name,
    coalesce(meta_first, nullif(split_part(resolved_name, ' ', 1), '')),
    coalesce(meta_last, nullif(trim(substring(resolved_name from position(' ' in resolved_name) + 1)), '')),
    resolved_email, new.id,
    -- Consent chosen at sign up. Without a real email address there is nothing to send to.
    real_email is not null and coalesce((new.raw_user_meta_data->>'email_consent')::boolean, true),
    coalesce((new.raw_user_meta_data->>'whatsapp_consent')::boolean, false),
    coalesce((new.raw_user_meta_data->>'phone_call_consent')::boolean, false)
  )
  on conflict(email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;
