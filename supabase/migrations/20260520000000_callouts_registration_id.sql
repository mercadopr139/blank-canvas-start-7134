-- Link call-outs to youth registrations.
--
-- Today the callouts table stores first_name/last_name as free text;
-- the public form already forces the submitter to pick from a real
-- registration (they tap a headshot), but the link is then discarded.
-- That's the root cause of "Maicol vs Maycol" matching gaps in the
-- nightly Bald Eagle no-show email and missing photos in the admin UI.
--
-- This adds the link as a nullable FK so historical rows stay valid
-- and continue to match by name as a fallback. New rows from the
-- form will carry registration_id and match exactly.

ALTER TABLE public.callouts
  ADD COLUMN IF NOT EXISTS registration_id uuid
    REFERENCES public.youth_registrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_callouts_registration_id
  ON public.callouts(registration_id);
