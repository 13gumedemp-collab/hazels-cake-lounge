-- Let the Occasion Book hold any date, which is what the site already promises.
--
-- The four full days' notice rule is a *baking* lead time. It belongs on cake
-- enquiries and reorders, and public.request_reorder still enforces it.
--
-- It was also applied to circle_members in 0007, which is the wrong table: a
-- saved date is a free reminder, not an order, and nothing is baked for it.
-- Commit 9efb53d changed the front end to accept any date and to say honestly
-- when a date is too close for the usual reminders ("This is less than a week
-- away, so I cannot get the usual reminders to you in time"). The policy was
-- never changed to match, so the friendly message was shown and then the insert
-- was refused by RLS. Saving today's birthday failed with a permissions error.
--
-- Ownership is still enforced. Only the date restriction goes.

drop policy if exists customer_adds_circle on public.circle_members;
create policy customer_adds_circle on public.circle_members for insert to authenticated
with check (public.owns_customer(customer_id));

drop policy if exists customer_updates_circle on public.circle_members;
create policy customer_updates_circle on public.circle_members for update to authenticated
using (public.owns_customer(customer_id))
with check (public.owns_customer(customer_id));
