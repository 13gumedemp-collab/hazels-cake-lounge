-- Account creation should be visible to Hazel immediately, and the first
-- authenticated session can safely send one matching email alert.

create table if not exists public.account_alert_deliveries (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.account_alert_deliveries enable row level security;

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

  if tg_op = 'INSERT' then
    insert into public.notifications(type, message, priority, action_url)
    values (
      'account_created',
      format('New account created: %s (%s).', resolved_name, coalesce(real_email, 'no email supplied')),
      'standard',
      '/customers'
    );
  end if;

  return new;
end;
$$;

insert into public.message_templates(template_name, channel, subject, body)
values (
  'new_account_alert',
  'email',
  'New account: {{customer_name}}',
  '<div style="margin:0;padding:32px 16px;background:#f6f1e8;font-family:Arial,sans-serif;color:#302d27"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fffdfa;border:1px solid #e5dac9;border-radius:20px"><tr><td style="padding:34px 32px"><p style="margin:0 0 18px;color:#a28349;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Hazel''s Cake Lounge · Command Centre</p><h1 style="margin:0;color:#302d27;font-family:Georgia,''Times New Roman'',serif;font-size:30px;font-weight:500">A new customer has joined.</h1><p style="margin:18px 0 24px;font-size:16px;line-height:1.65;color:#625a50">Hi Hazel, {{customer_name}} has created an account and is ready to use the Occasion Book.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fbf7ef;border:1px solid #eadfce;border-radius:12px"><tr><td style="padding:14px 16px;border-bottom:1px solid #eadfce;color:#8b806f;font-size:12px;width:34%">Name</td><td style="padding:14px 16px;color:#302d27;font-size:14px">{{customer_name}}</td></tr><tr><td style="padding:14px 16px;border-bottom:1px solid #eadfce;color:#8b806f;font-size:12px">Email</td><td style="padding:14px 16px;color:#302d27;font-size:14px">{{customer_email}}</td></tr><tr><td style="padding:14px 16px;color:#8b806f;font-size:12px">Created</td><td style="padding:14px 16px;color:#302d27;font-size:14px">{{account_created_at}}</td></tr></table><p style="margin:26px 0 0"><a href="{{admin_dashboard_url}}/customers" style="display:inline-block;padding:13px 19px;background:#a98a4d;border-radius:9px;color:#fffdf8;font-size:13px;font-weight:700;letter-spacing:.6px;text-decoration:none">Open Command Centre</a></p><p style="margin:26px 0 0;color:#978d80;font-size:12px;line-height:1.5">This alert was sent because a new customer account was created on your website.</p></td></tr></table></div>'
)
on conflict(template_name) do update
set channel = excluded.channel, subject = excluded.subject, body = excluded.body;
