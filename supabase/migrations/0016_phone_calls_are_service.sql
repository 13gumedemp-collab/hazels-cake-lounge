-- A phone call is part of the service, not a marketing choice.
--
-- Every contact method was opt-in, which meant a customer could untick all
-- three and leave Hazel with no way to reach them about a cake they had
-- actually ordered. Email and WhatsApp stay a choice; a phone call does not.
--
-- Worth being precise about why this is allowed under POPIA. These are
-- *operational* calls about a cake the customer has ordered or a date they
-- asked to be reminded of: confirming a detail, agreeing a collection time.
-- That is performance of the service they asked for, not direct marketing, and
-- direct marketing by phone would still need consent. The account page and the
-- privacy policy both say this in those words.

alter table public.customers alter column phone_call_consent set default true;
update public.customers set phone_call_consent = true where phone_call_consent is not true;

-- Customers may no longer set this one back to false from the account page.
-- Email and WhatsApp remain theirs to change.
revoke update (phone_call_consent) on public.customers from authenticated;
grant update (
  full_name, whatsapp_number, whatsapp_consent, email_consent,
  address_line_1, address_line_2, suburb, city, province, postal_code
) on public.customers to authenticated;
