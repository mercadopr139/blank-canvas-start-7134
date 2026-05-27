-- Collapse the agenda status model from four values down to two:
--   pending_review | reviewed
--
-- Why: the agenda is an internal weekly audit, not a project tracker.
-- Items aren't "completed" — they're walked through and confirmed
-- ("Reviewed") or noted as still needing attention ("Pending Review").
-- The richer Signal / On-Hold / Done vocabulary turned out to be
-- aspirational complexity that didn't match how the team actually
-- runs the meeting.
--
-- Data migration:
--   - done        → reviewed   (semantic equivalent in the new model)
--   - signal      → pending_review
--   - on_hold     → pending_review
--   - pending_review stays as is
--
-- A signal/on_hold task collapsing back to pending_review is the
-- lossy direction. That's fine: anything that mattered enough to be
-- mid-flight will re-surface during the next weekly review.

-- Drop the constraint FIRST so the UPDATE below can write `reviewed`,
-- which the old constraint didn't allow.
ALTER TABLE public.agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_status_check;

UPDATE public.agenda_items
SET status = 'reviewed'
WHERE status = 'done';

UPDATE public.agenda_items
SET status = 'pending_review'
WHERE status IN ('signal', 'on_hold');

ALTER TABLE public.agenda_items
  ADD CONSTRAINT agenda_items_status_check
  CHECK (status IN ('pending_review', 'reviewed'));

ALTER TABLE public.agenda_items
  ALTER COLUMN status SET DEFAULT 'pending_review';
