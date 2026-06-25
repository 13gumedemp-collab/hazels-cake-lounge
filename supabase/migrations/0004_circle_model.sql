-- ============================================================================
-- Hazel's Cake Lounge — Circle model (master spec, Part 1)
-- ----------------------------------------------------------------------------
-- Introduces circle_members (every person a customer celebrates) and the
-- additional columns the master spec requires. Additive and non-breaking: the
-- deprecated `occasions` table and `occasion_id` columns are kept until the
-- edge functions migrate to circle_member_id (Build Order Step 3), then dropped.
-- ============================================================================

-- customers: new lifecycle columns -----------------------------------------
alter table public.customers add column if not exists email_unsubscribed boolean not null default false;
alter table public.customers add column if not exists first_order_completed_at timestamptz;
alter table public.customers add column if not exists circle_followup_sent boolean not null default false;

-- circle_members ------------------------------------------------------------
create table if not exists public.circle_members (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references public.customers (id) on delete cascade,
  person_name              text not null,
  relationship_to_customer text,
  occasion_type            text not null,
  occasion_date            date not null,
  recurring_yearly         boolean not null default true,
  is_one_time              boolean not null default false,
  notes                    text,
  created_at               timestamptz not null default now()
);
create index if not exists idx_circle_customer on public.circle_members (customer_id);
create index if not exists idx_circle_occasion_date on public.circle_members (occasion_date);
alter table public.circle_members enable row level security;

-- orders: circle link + richer detail --------------------------------------
alter table public.orders add column if not exists circle_member_id uuid references public.circle_members (id) on delete set null;
alter table public.orders add column if not exists inspiration_photo_url text;
alter table public.orders add column if not exists number_of_people text;
alter table public.orders add column if not exists colours_and_themes text;
alter table public.orders add column if not exists invoice_sent boolean not null default false;
create index if not exists idx_orders_circle_member on public.orders (circle_member_id);

-- reminder_log: circle link + year stamp -----------------------------------
alter table public.reminder_log add column if not exists circle_member_id uuid references public.circle_members (id) on delete set null;
alter table public.reminder_log add column if not exists year_sent integer;
create index if not exists idx_reminder_log_circle on public.reminder_log (circle_member_id);
create index if not exists idx_reminder_log_year on public.reminder_log (circle_member_id, reminder_type, year_sent);

-- whatsapp_reminders_due: circle link --------------------------------------
alter table public.whatsapp_reminders_due add column if not exists circle_member_id uuid references public.circle_members (id) on delete set null;
create index if not exists idx_wa_due_circle on public.whatsapp_reminders_due (circle_member_id);

-- notifications: priority + action link ------------------------------------
alter table public.notifications add column if not exists priority text not null default 'standard';
alter table public.notifications add column if not exists action_url text;

-- Realtime publication ------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notifications','orders','whatsapp_reminders_due','reminder_log'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
