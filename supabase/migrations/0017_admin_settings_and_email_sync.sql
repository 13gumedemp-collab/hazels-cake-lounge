-- Admin managed business settings, reminder switches and secure password storage.
-- Also make a confirmed Auth email change update the existing customer instead
-- of attempting to insert a second row for the same auth user.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

insert into public.app_settings(key, value)
values
  ('business', jsonb_build_object(
    'business_name', 'Hazel''s Cake Lounge',
    'business_email', 'hello@hazelscakelounge.co.za',
    'business_phone', '073 373 4234',
    'site_url', 'https://hazelscakelounge.co.za',
    'service_area', 'South Africa',
    'reply_days', 2
  )),
  ('reminders', jsonb_build_object(
    'email_enabled', true,
    'whatsapp_enabled', true,
    'phone_enabled', true
  ))
on conflict (key) do nothing;

insert into public.message_templates(template_name, channel, subject, body)
values (
  'delivery_test',
  'email',
  'Hazel''s Cake Lounge email delivery test',
  '<div style="font-family:Georgia,''Times New Roman'',serif;font-size:16px;line-height:1.7;color:#2a2722;max-width:560px"><p>Hi Hazel,</p><p>Your Command Centre successfully sent this delivery test at {{sent_at}}.</p><p>This confirms that the current email provider, sender domain and business inbox are working together.</p><p>Hazel''s Cake Lounge</p></div>'
)
on conflict (template_name) do update
set channel = excluded.channel, subject = excluded.subject, body = excluded.body;

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
  if tg_op = 'UPDATE' then
    update public.customers
       set email = resolved_email
     where auth_user_id = new.id;
    return new;
  end if;

  insert into public.customers(
    full_name, first_name, last_name, email, auth_user_id,
    email_consent, whatsapp_consent, phone_call_consent
  )
  values (
    resolved_name,
    coalesce(meta_first, nullif(split_part(resolved_name, ' ', 1), '')),
    coalesce(meta_last, nullif(trim(substring(resolved_name from position(' ' in resolved_name) + 1)), '')),
    resolved_email,
    new.id,
    real_email is not null and coalesce((new.raw_user_meta_data->>'email_consent')::boolean, true),
    coalesce((new.raw_user_meta_data->>'whatsapp_consent')::boolean, false),
    true
  )
  on conflict(email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;
