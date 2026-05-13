-- Add is_regenerated flag to receipt_sends.
--
-- True when the row was synthesized by the backfill job (regenerated from
-- current data) rather than captured at the time of a real send. The
-- viewer modal renders a small disclaimer on regenerated rows because:
--   - The personal message attached to the original send wasn't stored
--     and is gone forever.
--   - The PDF + email body reflect the *current* donation data and
--     template, not the byte-for-byte content delivered originally.
-- Real sends from this date forward default to false.

ALTER TABLE public.receipt_sends
  ADD COLUMN IF NOT EXISTS is_regenerated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS receipt_sends_is_regenerated_idx
  ON public.receipt_sends(is_regenerated)
  WHERE is_regenerated = true;
