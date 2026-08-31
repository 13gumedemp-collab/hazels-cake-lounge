-- A customer profile photo stays private on the account by default. A review
-- has its own opt-in before the current profile photo can appear publicly.
alter table public.customers add column if not exists profile_image_path text;
alter table public.community_reviews add column if not exists show_profile_image boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-profile-images',
  'customer-profile-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
