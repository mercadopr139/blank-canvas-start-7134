-- Generic receipt-status columns on `supporters`.
--
-- The original schema stored receipt state in year-hardcoded columns:
-- `receipt_2026_status`, `receipt_2026_sent_at`, `receipt_2026_last_sent_to`.
-- That required a schema migration plus a code change every calendar year.
-- These four generic columns hold the same information without baking the
-- year into the column name:
--   latest_receipt_year     — int, the year of the most recent receipt sent
--   latest_receipt_status   — 'Sent' | 'Failed' (null = never sent)
--   latest_receipt_sent_at  — timestamp of the most recent send attempt
--   latest_receipt_sent_to  — email address used for the most recent send
--
-- Read logic in the app treats a supporter as "Sent this year" when
-- latest_receipt_year matches the current calendar year AND
-- latest_receipt_status = 'Sent'. Past-year sends correctly read as
-- "Not Sent" for the current year without any code change.
--
-- The legacy `receipt_2026_*` columns are intentionally left in place
-- during the transition. The edge function writes to both old and new
-- columns so we can roll back quickly if needed. A follow-up migration
-- can drop the legacy columns once the next year rolls over.

ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS latest_receipt_year INT,
  ADD COLUMN IF NOT EXISTS latest_receipt_status TEXT,
  ADD COLUMN IF NOT EXISTS latest_receipt_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_receipt_sent_to TEXT;

-- Constrain the status to the same value set the legacy column used.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supporters_latest_receipt_status_check'
  ) THEN
    ALTER TABLE public.supporters
      ADD CONSTRAINT supporters_latest_receipt_status_check
      CHECK (latest_receipt_status IN ('Sent', 'Failed') OR latest_receipt_status IS NULL);
  END IF;
END $$;

-- Backfill existing data: only rows where a receipt has actually been
-- recorded (Sent or Failed). Default "Not Sent" rows stay null on the
-- new columns, which the app reads as "never sent" — same semantics.
UPDATE public.supporters
SET latest_receipt_year    = 2026,
    latest_receipt_status  = receipt_2026_status,
    latest_receipt_sent_at = receipt_2026_sent_at,
    latest_receipt_sent_to = receipt_2026_last_sent_to
WHERE receipt_2026_status IN ('Sent', 'Failed')
  AND latest_receipt_year IS NULL;
