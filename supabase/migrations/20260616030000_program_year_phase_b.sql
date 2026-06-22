-- ═══════════════════════════════════════════════════════════════════
-- Program year cohort model — Phase B
-- ═══════════════════════════════════════════════════════════════════
-- NLA's program year runs Sept 1 → Aug 31. Re-registration for the
-- next program year opens Aug 1 of the prior calendar year (one-month
-- overlap window). Until now there was no way to differentiate which
-- cohort a registration belonged to — every row just accumulated in
-- one bucket, which is why Janivea ended up with 4 rows across
-- multiple program years.
--
-- This migration:
--   1. Adds `program_year` text column (long form, e.g. "2025-2026")
--   2. Adds `archived_at` timestamptz for the Aug 31 archive ceremony
--   3. Backfills every existing row to "2025-2026" — the current
--      program year as of the 2026-06-16 deploy
--   4. Adds an index on program_year for the admin year-filter queries
--
-- New registrations submitted via the public form get tagged based on
-- the current date via getProgramYearForRegistration() in
-- src/lib/programYear.ts.

ALTER TABLE public.youth_registrations
  ADD COLUMN IF NOT EXISTS program_year text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Backfill existing rows. Every registration as of today (June 2026)
-- belongs to the 2025-2026 program year, since this is the current
-- in-progress cohort. Future-dated registrations submitted Aug 1+
-- will get "2026-2027" via the frontend helper.
UPDATE public.youth_registrations
   SET program_year = '2025-2026'
 WHERE program_year IS NULL;

CREATE INDEX IF NOT EXISTS idx_youth_registrations_program_year
  ON public.youth_registrations(program_year);

CREATE INDEX IF NOT EXISTS idx_youth_registrations_archived_at
  ON public.youth_registrations(archived_at)
  WHERE archived_at IS NOT NULL;
