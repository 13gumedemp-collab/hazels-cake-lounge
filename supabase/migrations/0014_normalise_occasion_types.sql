-- Normalise circle_members.occasion_type to the shared list in occasions.js.
--
-- Three screens used to write this column from three different lists. The
-- Occasion Book and the enquiry overlay wrote title case ("Baby Shower",
-- "Just Because"); the account calendar sheet wrote sentence case ("Baby
-- shower", "Just because"). Same customer, same kind of event, two spellings,
-- and the value is interpolated straight into reminder subject lines.
--
-- Front end now shares one list. This brings the existing rows into line.
-- Only exact case variants of known types are touched: anything a customer
-- typed themselves through the "Other" free-text field is left exactly as it
-- was written, because that is their words, not a picklist value.

update public.circle_members
set occasion_type = canon.correct
from (values
  ('birthday',      'Birthday'),
  ('anniversary',   'Anniversary'),
  ('wedding',       'Wedding'),
  ('engagement',    'Engagement'),
  ('baby shower',   'Baby shower'),
  ('baptism',       'Baptism'),
  ('graduation',    'Graduation'),
  ('retirement',    'Retirement'),
  ('just because',  'Just because')
) as canon(lowered, correct)
where lower(trim(public.circle_members.occasion_type)) = canon.lowered
  and public.circle_members.occasion_type <> canon.correct;

-- "Other" was previously saved literally by the account calendar sheet, with no
-- free-text follow-up, so those rows carry no real occasion. They are left in
-- place rather than guessed at: the sheet now asks for the actual occasion, and
-- Hazel can correct any historic ones from the admin board.
