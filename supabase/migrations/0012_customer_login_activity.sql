-- Keep a concise, customer-facing login trail for the admin activity feed.
-- The primary key limits it to one notification per customer per SAST calendar day.
create table if not exists public.customer_login_activity (
  customer_id uuid not null references public.customers(id) on delete cascade,
  login_date date not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, login_date)
);

alter table public.customer_login_activity enable row level security;
