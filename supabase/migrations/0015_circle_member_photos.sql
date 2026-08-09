-- Three things: give inspiration pictures a real home, let customers edit their
-- own order details, and lock both while a cake is actually being made.
--
-- PHOTOS
-- circle_members had no column for pictures. The Occasion Book appended their
-- storage paths to the end of the free-text `notes` column under an
-- "Inspiration pictures:" heading, done that way originally so the edge
-- function kept working without a redeploy. That made `notes` hold two
-- different things: what the customer wrote, and machine data. An edit box
-- bound to `notes` shows raw storage paths and deletes them on save.
--
-- LOCKING
-- Locked from Confirmed (a deposit is paid and Hazel is committed) through
-- Baking and Ready. **Completed unlocks it again**, because once the cake is
-- collected the record is history and reordering or tidying it is harmless.
-- A hidden button is not a rule, so the refusal lives here.

-- ---------------------------------------------------------------- photos ----
alter table public.circle_members add column if not exists photo_paths text[] not null default '{}';

-- Backfill from the notes blob. Takes every non-empty line after the heading.
-- `notes` is deliberately left untouched so nothing is lost if this needs
-- looking at again; the front end strips the block before display.
update public.circle_members m
set photo_paths = coalesce(extracted.paths, '{}')
from (
  select id, array_remove(array_agg(nullif(trim(line), '')), null) as paths
  from (
    select
      c.id,
      regexp_split_to_table(
        substring(c.notes from position('Inspiration pictures:' in c.notes) + length('Inspiration pictures:')),
        E'\n'
      ) as line
    from public.circle_members c
    where c.notes like '%Inspiration pictures:%'
  ) lines
  where trim(line) <> ''
  group by id
) extracted
where m.id = extracted.id
  and cardinality(m.photo_paths) = 0;

grant update (photo_paths) on public.circle_members to authenticated;

-- --------------------------------------------------------------- locking ----
-- Confirmed, Baking and Ready only. Enquiry and Quoted are still free to
-- change, and Completed is free again.
create or replace function public.order_locked(order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where id = order_id and status in ('deposit_paid', 'baking', 'ready')
  );
$$;
grant execute on function public.order_locked(uuid) to authenticated;

create or replace function public.circle_member_locked(member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders
    where circle_member_id = member_id and status in ('deposit_paid', 'baking', 'ready')
  );
$$;
grant execute on function public.circle_member_locked(uuid) to authenticated;

-- Ownership was already enforced. This adds the lock, and keeps the "any date"
-- rule from 0013 rather than reinstating the four-day restriction.
drop policy if exists customer_updates_circle on public.circle_members;
create policy customer_updates_circle on public.circle_members for update to authenticated
using (public.owns_customer(customer_id) and not public.circle_member_locked(id))
with check (public.owns_customer(customer_id) and not public.circle_member_locked(id));

drop policy if exists customer_deletes_circle on public.circle_members;
create policy customer_deletes_circle on public.circle_members for delete to authenticated
using (public.owns_customer(customer_id) and not public.circle_member_locked(id));

-- ------------------------------------------------- customers edit orders ----
-- Only these columns, so status, payment and money stay Hazel's alone. Column
-- grants are the real boundary; the policy only decides which rows.
grant update (
  cake_flavour, cake_description, colours_and_themes, number_of_people,
  delivery_or_collection, delivery_address, occasion_date
) on public.orders to authenticated;

drop policy if exists customer_updates_orders on public.orders;
create policy customer_updates_orders on public.orders for update to authenticated
using (public.owns_customer(customer_id))
with check (public.owns_customer(customer_id));

-- While locked, delivery_address is the one thing that may still change: an
-- address genuinely does change late and it costs Hazel nothing.
--
-- Row level security cannot express "these columns but not those", so a trigger
-- does it. It must not fire for Hazel: the admin and the edge functions use the
-- service role, which has no auth.uid(), and they have to be able to move a
-- cake through its stages.
create or replace function public.guard_locked_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;      -- service role, let it through
  if not public.order_locked(old.id) then return new; end if;
  if (new.cake_flavour           is distinct from old.cake_flavour)
  or (new.cake_description       is distinct from old.cake_description)
  or (new.colours_and_themes     is distinct from old.colours_and_themes)
  or (new.number_of_people       is distinct from old.number_of_people)
  or (new.delivery_or_collection is distinct from old.delivery_or_collection)
  or (new.occasion_date          is distinct from old.occasion_date) then
    raise exception 'This cake is already being made, so those details cannot be changed here.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_locked on public.orders;
create trigger orders_guard_locked
before update on public.orders
for each row execute function public.guard_locked_order();
