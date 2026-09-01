-- Private two way email records for the Command Centre. Browser roles receive
-- no table access. Edge Functions and the admin server use the service role.

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  contact_email text not null,
  contact_name text,
  subject text not null default '(no subject)',
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_threads_contact_email_normalised check (
    contact_email = lower(trim(contact_email))
    and length(contact_email) between 3 and 320
  )
);

create index if not exists idx_email_threads_customer
  on public.email_threads(customer_id, last_message_at desc);
create index if not exists idx_email_threads_open_recent
  on public.email_threads(status, last_message_at desc);
create index if not exists idx_email_threads_contact
  on public.email_threads(contact_email, last_message_at desc);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  provider_message_id text unique,
  internet_message_id text,
  in_reply_to text,
  references_header text[] not null default '{}',
  from_address text not null,
  to_addresses text[] not null default '{}',
  subject text not null default '(no subject)',
  text_body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'received' check (
    status in ('queued', 'sent', 'delivered', 'delivery_delayed', 'received', 'bounced', 'failed', 'suppressed', 'complained')
  ),
  status_detail text,
  sent_at timestamptz,
  delivered_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_messages_body_size check (length(text_body) <= 100000),
  constraint email_messages_attachments_array check (jsonb_typeof(attachments) = 'array')
);

create unique index if not exists idx_email_messages_internet_id
  on public.email_messages(internet_message_id)
  where internet_message_id is not null;
create index if not exists idx_email_messages_thread
  on public.email_messages(thread_id, created_at);
create index if not exists idx_email_messages_status
  on public.email_messages(status, created_at desc);

create table if not exists public.email_suppressions (
  email_address text primary key,
  customer_id uuid references public.customers(id) on delete set null,
  reason text not null check (reason in ('bounce', 'complaint', 'provider_suppressed', 'manual')),
  provider_event text,
  provider_message_id text,
  diagnostic_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_suppressions_address_normalised check (
    email_address = lower(trim(email_address))
    and length(email_address) between 3 and 320
  )
);

create index if not exists idx_email_suppressions_active
  on public.email_suppressions(active, updated_at desc);

create table if not exists public.email_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_email_webhook_events_received
  on public.email_webhook_events(received_at desc);

alter table public.reminder_log
  add column if not exists resend_email_id text,
  add column if not exists email_thread_id uuid references public.email_threads(id) on delete set null;

create unique index if not exists idx_reminder_log_resend_email_id
  on public.reminder_log(resend_email_id)
  where resend_email_id is not null;
create index if not exists idx_reminder_log_email_thread
  on public.reminder_log(email_thread_id, sent_at desc);

alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_webhook_events enable row level security;

revoke all on public.email_threads from anon, authenticated;
revoke all on public.email_messages from anon, authenticated;
revoke all on public.email_suppressions from anon, authenticated;
revoke all on public.email_webhook_events from anon, authenticated;

