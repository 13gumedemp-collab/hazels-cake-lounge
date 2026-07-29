-- Accounts created before the customer-account trigger existed can have a
-- matching customer record without its auth_user_id. Link only exact,
-- case-insensitive email matches so the existing signed-in customer regains
-- access to their own dashboard.
update public.customers as customer
set auth_user_id = auth_user.id
from auth.users as auth_user
where customer.auth_user_id is null
  and lower(customer.email) = lower(auth_user.email);
