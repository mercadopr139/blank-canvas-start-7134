-- The Smile Lab kiosk's ROSTER view skipped the current-year gate (Josh,
-- 2026-11-02: Chrissy saw a youth's 2025-26 registration come up at the
-- kiosk and check-ins landing on last year's row — Gabriel Ayende, whose
-- 2025-26 row "Ayende molina" took nine Smile Lab check-ins after Sept 3).
--
-- The gate (kiosk_settings.enforce_current_year_from, on since 2026-09-03)
-- is applied in every SEARCH function, but two roster functions that list
-- the whole programme were written before it and never picked it up:
-- get_smile_lab_roster() and the older get_lil_champs_roster(). Both now
-- pass through passes_kiosk_year_gate(), exactly like the searches, so
-- while the gate is on they list current-year youth only — and read as
-- before when it is off. Signatures and columns unchanged. Safe to re-run.

CREATE OR REPLACE FUNCTION public.get_smile_lab_roster()
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT yr.id, yr.child_first_name, yr.child_last_name, yr.child_date_of_birth, yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND yr.extended_program = 'Smile Lab'
    AND public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_lil_champs_roster()
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT yr.id, yr.child_first_name, yr.child_last_name, yr.child_date_of_birth, yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND yr.extended_program = 'Lil Champs Corner'
    AND public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

NOTIFY pgrst, 'reload schema';

SELECT 'smile lab roster gated' AS done;
