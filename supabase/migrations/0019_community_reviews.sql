-- Community reviews are deliberately moderated. Guest reviewers can submit
-- without an account, but only consented, approved reviews ever leave this table.
create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  reviewer_name text,
  display_name text not null default 'A happy customer',
  cake_or_bake text,
  comment text not null check (char_length(comment) between 5 and 2000),
  photo_paths text[] not null default '{}',
  public_consent boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'private', 'rejected')),
  source text not null default 'community_page' check (source in ('community_page', 'pamphlet_qr')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists idx_community_reviews_moderation
  on public.community_reviews (status, created_at desc);
create index if not exists idx_community_reviews_customer
  on public.community_reviews (customer_id, created_at desc);

alter table public.community_reviews enable row level security;

-- A short public submission limit reduces spam without keeping a raw IP address.
create table if not exists public.community_review_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 1 check (submission_count between 1 and 3),
  updated_at timestamptz not null default now()
);

alter table public.community_review_rate_limits enable row level security;

-- Photos stay private. The public listing endpoint issues a short-lived signed URL
-- only after Hazel approves a review that has permission to be featured.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-review-photos',
  'community-review-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
