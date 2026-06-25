-- ============================================================================
-- Hazel's Cake Lounge — whatsapp_reminders_due
-- ----------------------------------------------------------------------------
-- Manual WhatsApp reminder tasks. Hazel sends these by hand from the WhatsApp
-- Business app; the daily checker fills this queue, the admin dashboard works
-- it. No Twilio / no automated WhatsApp sending.
-- ============================================================================
create table if not exists public.whatsapp_reminders_due (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers (id) on delete cascade,
  occasion_id     uuid references public.occasions (id) on delete cascade,
  reminder_type   text,
  whatsapp_number text,
  message_copy    text,
  due_date        date,
  status          text not null default 'pending',
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_wa_due_status on public.whatsapp_reminders_due (status);
create index if not exists idx_wa_due_customer on public.whatsapp_reminders_due (customer_id);
create index if not exists idx_wa_due_due_date on public.whatsapp_reminders_due (due_date);
-- Dedupe a manual task per occasion + reminder type + year.
create index if not exists idx_wa_due_dedupe
  on public.whatsapp_reminders_due (occasion_id, reminder_type);

alter table public.whatsapp_reminders_due enable row level security;
