-- ============================================================================
-- Hazel's Cake Lounge — Part 1: Database schema
-- ----------------------------------------------------------------------------
-- One Supabase database shared by:
--   * the public website (Vite)        -> writes only via edge functions
--   * the admin dashboard (Next.js PWA) -> server-side via service_role key
--
-- Row Level Security is ENABLED on every table. No anon/authenticated policies
-- are granted here, so the tables are locked down by default. All server work
-- (edge functions, the admin app's server layer) uses the service_role key,
-- which bypasses RLS. Realtime read access for the dashboard is handled as a
-- deliberate decision in Part 8, not loosened here.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_cron;        -- scheduled jobs (Part 1 cron)
create extension if not exists pg_net;         -- http calls from cron -> edge fn

-- ============================================================================
-- 1. customers
-- ============================================================================
create table if not exists public.customers (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  email                  text not null unique,
  whatsapp_number        text,
  own_birthday           date,
  whatsapp_consent       boolean not null default false,
  whatsapp_consent_date  timestamptz,
  email_consent          boolean not null default true,
  notes                  text,
  created_at             timestamptz not null default now()
);

-- ============================================================================
-- 2. occasions
-- ============================================================================
create table if not exists public.occasions (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  person_name      text not null,
  occasion_type    text not null,
  occasion_date    date not null,
  recurring_yearly boolean not null default true,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_occasions_customer_id on public.occasions (customer_id);
create index if not exists idx_occasions_occasion_date on public.occasions (occasion_date);

-- ============================================================================
-- 3. orders
-- ============================================================================
create table if not exists public.orders (
  id                     uuid primary key default gen_random_uuid(),
  customer_id            uuid references public.customers (id) on delete set null,
  occasion_id            uuid references public.occasions (id) on delete set null,
  cake_flavour           text,
  cake_description       text,
  cake_photo_url         text,
  order_date             date,
  occasion_date          date,
  delivery_or_collection text,
  status                 text not null default 'enquiry',
  deposit_paid           boolean not null default false,
  memory_card_sent       boolean not null default false,
  created_at             timestamptz not null default now()
);

create index if not exists idx_orders_customer_id on public.orders (customer_id);
create index if not exists idx_orders_occasion_id on public.orders (occasion_id);
create index if not exists idx_orders_status on public.orders (status);

-- ============================================================================
-- 4. reminder_log
-- ============================================================================
create table if not exists public.reminder_log (
  id            uuid primary key default gen_random_uuid(),
  occasion_id   uuid references public.occasions (id) on delete set null,
  customer_id   uuid references public.customers (id) on delete set null,
  reminder_type text,
  channel       text,
  sent_at       timestamptz not null default now(),
  status        text not null default 'sent',
  error_message text
);

create index if not exists idx_reminder_log_occasion_id on public.reminder_log (occasion_id);
create index if not exists idx_reminder_log_customer_id on public.reminder_log (customer_id);
create index if not exists idx_reminder_log_sent_at on public.reminder_log (sent_at);
-- Used by daily-occasion-checker to dedupe a reminder per occasion+type+year.
create index if not exists idx_reminder_log_dedupe
  on public.reminder_log (occasion_id, reminder_type, status);

-- ============================================================================
-- 5. message_templates
-- ============================================================================
create table if not exists public.message_templates (
  id            uuid primary key default gen_random_uuid(),
  template_name text unique,
  channel       text,
  subject       text,
  body          text,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 6. notifications
-- ============================================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text,
  message    text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_read on public.notifications (read);
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);

-- ============================================================================
-- Row Level Security — enable on all tables (default deny).
-- service_role (edge functions, admin server layer) bypasses RLS entirely.
-- ============================================================================
alter table public.customers         enable row level security;
alter table public.occasions         enable row level security;
alter table public.orders            enable row level security;
alter table public.reminder_log      enable row level security;
alter table public.message_templates enable row level security;
alter table public.notifications     enable row level security;
