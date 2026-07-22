-- Customer accounts, South African profile fields, payment visibility and call reminders.

alter table public.customers add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;
alter table public.customers add column if not exists phone_call_consent boolean not null default false;
alter table public.customers add column if not exists address_line_1 text;
alter table public.customers add column if not exists address_line_2 text;
alter table public.customers add column if not exists suburb text;
alter table public.customers add column if not exists city text;
alter table public.customers add column if not exists province text;
alter table public.customers add column if not exists postal_code text;
alter table public.customers add column if not exists country_code text not null default 'ZA';

alter table public.customers drop constraint if exists customers_country_za;
alter table public.customers add constraint customers_country_za check (country_code = 'ZA');
alter table public.customers drop constraint if exists customers_province_sa;
alter table public.customers add constraint customers_province_sa check (
  province is null or province in (
    'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
    'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape'
  )
);

alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists total_amount_zar numeric(12,2);
alter table public.orders add column if not exists amount_paid_zar numeric(12,2) not null default 0;
alter table public.orders add column if not exists invoice_path text;
alter table public.orders add column if not exists receipt_path text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders drop constraint if exists orders_payment_status_valid;
alter table public.orders add constraint orders_payment_status_valid
  check (payment_status in ('unpaid', 'deposit_paid', 'paid_in_full'));

create table if not exists public.phone_call_reminders_due (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  circle_member_id uuid references public.circle_members(id) on delete cascade,
  reminder_type text not null,
  phone_number text,
  due_date date not null,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(circle_member_id, reminder_type, due_date)
);
alter table public.phone_call_reminders_due enable row level security;
create index if not exists idx_phone_calls_status_due on public.phone_call_reminders_due(status, due_date);

create or replace function public.link_customer_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.customers(full_name, email, auth_user_id, email_consent)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    lower(new.email), new.id, true
  )
  on conflict(email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_link_customer on auth.users;
create trigger on_auth_user_link_customer
after insert or update of email on auth.users
for each row execute function public.link_customer_account();

create or replace function public.owns_customer(customer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers
    where id = customer_uuid and auth_user_id = auth.uid()
  );
$$;

drop policy if exists customer_reads_self on public.customers;
create policy customer_reads_self on public.customers for select to authenticated
using (auth_user_id = auth.uid());
drop policy if exists customer_updates_self on public.customers;
create policy customer_updates_self on public.customers for update to authenticated
using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid() and country_code = 'ZA');

drop policy if exists customer_reads_circle on public.circle_members;
create policy customer_reads_circle on public.circle_members for select to authenticated
using (public.owns_customer(customer_id));
drop policy if exists customer_adds_circle on public.circle_members;
create policy customer_adds_circle on public.circle_members for insert to authenticated
with check (public.owns_customer(customer_id) and occasion_date >= current_date + 4);
drop policy if exists customer_updates_circle on public.circle_members;
create policy customer_updates_circle on public.circle_members for update to authenticated
using (public.owns_customer(customer_id))
with check (public.owns_customer(customer_id) and occasion_date >= current_date + 4);
drop policy if exists customer_deletes_circle on public.circle_members;
create policy customer_deletes_circle on public.circle_members for delete to authenticated
using (public.owns_customer(customer_id));

drop policy if exists customer_reads_orders on public.orders;
create policy customer_reads_orders on public.orders for select to authenticated
using (public.owns_customer(customer_id));
drop policy if exists customer_reads_reminders on public.reminder_log;
create policy customer_reads_reminders on public.reminder_log for select to authenticated
using (public.owns_customer(customer_id));

grant select on public.customers, public.circle_members, public.orders, public.reminder_log to authenticated;
grant insert, update, delete on public.circle_members to authenticated;
grant update (
  full_name, whatsapp_number, whatsapp_consent, email_consent, phone_call_consent,
  address_line_1, address_line_2, suburb, city, province, postal_code
) on public.customers to authenticated;

create or replace function public.request_reorder(source_order_id uuid, requested_date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.orders;
  new_id uuid;
begin
  if requested_date < current_date + 4 then
    raise exception 'Please allow at least four days notice.';
  end if;
  select * into source from public.orders
  where id = source_order_id and public.owns_customer(customer_id);
  if not found then raise exception 'Order not found.'; end if;
  insert into public.orders(
    customer_id, circle_member_id, cake_flavour, cake_description,
    occasion_date, delivery_or_collection, colours_and_themes,
    inspiration_photo_url, number_of_people, status, deposit_paid, payment_status
  ) values (
    source.customer_id, source.circle_member_id, source.cake_flavour, source.cake_description,
    requested_date, source.delivery_or_collection, source.colours_and_themes,
    source.inspiration_photo_url, source.number_of_people, 'enquiry', false, 'unpaid'
  ) returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.request_reorder(uuid, date) to authenticated;

-- Link any account created before this migration to its existing customer row.
update public.customers c set auth_user_id = u.id
from auth.users u where lower(c.email) = lower(u.email) and c.auth_user_id is null;
