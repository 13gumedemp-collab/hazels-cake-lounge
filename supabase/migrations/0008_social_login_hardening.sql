-- ============================================================================
-- 0008: make customer account creation safe for social logins
--
-- Facebook (and Google, when a user hides their address) can return an account
-- with no email and no name. customers.email and customers.full_name are both
-- NOT NULL, so the previous trigger raised "Database error saving new user"
-- and the sign in simply failed. Fall back to a placeholder address instead,
-- and never mark a placeholder as reachable by email.
-- ============================================================================

create or replace function public.link_customer_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  real_email     text := lower(nullif(trim(new.email), ''));
  resolved_email text := coalesce(real_email, 'no-email+' || new.id::text || '@hazelscakelounge.co.za');
  resolved_name  text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(coalesce(real_email, ''), '@', 1), ''),
    'New customer'
  );
begin
  insert into public.customers(full_name, email, auth_user_id, email_consent)
  values (resolved_name, resolved_email, new.id, real_email is not null)
  on conflict(email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

-- A placeholder address must never be posted to. Reminder emails already check
-- email_consent, so this keeps the daily checker from trying to reach them.
update public.customers
   set email_consent = false
 where email like 'no-email+%@hazelscakelounge.co.za'
   and email_consent;
