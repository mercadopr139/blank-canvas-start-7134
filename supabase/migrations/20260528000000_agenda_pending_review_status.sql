-- Add `pending_review` as a fourth status on agenda_items and make it
-- the default for newly-created rows.
--
-- Why: the Weekly Agenda is run as a recurring audit, not a project
-- tracker with historical snapshots. Each week starts by flipping all
-- previously-Done items back to a "haven't been reviewed yet this
-- week" state. Reusing `signal` for that role overloaded the word —
-- `signal` meant both "active item to discuss" and "default state". A
-- dedicated `pending_review` value separates the two: it reads as
-- neutral on the row and turns into a visible reminder for the week's
-- review pass.
--
-- Existing rows keep their current status (signal / done / on_hold)
-- — the migration only widens the allowed set and changes the column
-- default.

ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_status_check;

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_status_check
  CHECK (status IN ('pending_review', 'signal', 'done', 'on_hold'));

ALTER TABLE public.agenda_items
  ALTER COLUMN status SET DEFAULT 'pending_review';
