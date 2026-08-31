-- Optional deletion-survey responses are deliberately anonymous. They are not
-- linked back to an account, order or email address after account erasure.
create table if not exists public.account_deletion_feedback (
  id uuid primary key default gen_random_uuid(),
  reason text,
  feedback text,
  created_at timestamptz not null default now(),
  check (char_length(reason) <= 120),
  check (char_length(feedback) <= 2000)
);

alter table public.account_deletion_feedback enable row level security;
