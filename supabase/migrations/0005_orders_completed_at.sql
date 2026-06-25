-- Completion timestamp drives the +2 day post_celebration sweep and the
-- 30-day circle follow-up window.
alter table public.orders add column if not exists completed_at timestamptz;
create index if not exists idx_orders_completed_at on public.orders (completed_at);
