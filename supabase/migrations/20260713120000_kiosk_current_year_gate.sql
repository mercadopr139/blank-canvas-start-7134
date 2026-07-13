-- ═══════════════════════════════════════════════════════════════════
-- Kiosk gate: only current-program-year youth can check in
-- ═══════════════════════════════════════════════════════════════════
-- Goal: once the new program year begins (Sept 1), the three check-in
-- kiosks (NLA, Lil Champs, Excursion) should only find youth registered
-- for the CURRENT program year. A youth who hasn't re-registered can't
-- check in — which nudges the family to re-register (the whole point).
--
-- SAFE BY DEFAULT. This ships OFF: kiosk_settings.enforce_current_year_from
-- starts NULL, and while it's NULL every kiosk behaves EXACTLY as it does
-- today. When an admin sets it to a date (e.g. 2026-09-01) the gate only
-- takes effect on/after that date, so it can be staged ahead of time and
-- flips automatically. Set it back to NULL to disable instantly.

-- ── 1. Single-row settings table holding the switch ──────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_settings (
  id                        boolean PRIMARY KEY DEFAULT true,
  enforce_current_year_from date,                              -- NULL = gate OFF
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_settings_singleton CHECK (id)               -- only ever one row
);

INSERT INTO public.kiosk_settings (id, enforce_current_year_from)
VALUES (true, NULL)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.kiosk_settings ENABLE ROW LEVEL SECURITY;

-- Signed-in staff may read + change the switch. anon has no direct table
-- access; the SECURITY DEFINER search RPCs read it internally regardless.
DROP POLICY IF EXISTS kiosk_settings_read  ON public.kiosk_settings;
CREATE POLICY kiosk_settings_read  ON public.kiosk_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS kiosk_settings_write ON public.kiosk_settings;
CREATE POLICY kiosk_settings_write ON public.kiosk_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Current attendance program year (Sept 1 → Aug 31), NLA timezone ──
CREATE OR REPLACE FUNCTION public.current_attendance_program_year()
RETURNS text
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH n AS (SELECT (now() AT TIME ZONE 'America/New_York') AS ts)
  SELECT CASE
    WHEN EXTRACT(MONTH FROM ts) >= 9
      THEN EXTRACT(YEAR FROM ts)::int::text || '-' || (EXTRACT(YEAR FROM ts)::int + 1)::text
    ELSE (EXTRACT(YEAR FROM ts)::int - 1)::text || '-' || EXTRACT(YEAR FROM ts)::int::text
  END
  FROM n;
$$;

-- ── 3. The gate predicate: does this registration pass? ──────────────
-- Returns true (pass) when the gate is off / not yet in force — so with
-- the default NULL setting this is always true and nothing changes.
CREATE OR REPLACE FUNCTION public.passes_kiosk_year_gate(_program_year text, _archived_at timestamptz)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT enforce_current_year_from FROM public.kiosk_settings WHERE id) IS NULL
    OR (now() AT TIME ZONE 'America/New_York')::date
         < (SELECT enforce_current_year_from FROM public.kiosk_settings WHERE id)
    OR (_program_year = public.current_attendance_program_year() AND _archived_at IS NULL);
$$;

-- ── 4. Re-create the three kiosk search RPCs with the gate applied ────
-- Signatures, columns, and existing filters are unchanged — the only
-- addition is the passes_kiosk_year_gate(...) condition.

CREATE OR REPLACE FUNCTION public.search_kiosk_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_boxing_program public.boxing_program, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT yr.id, yr.child_first_name, yr.child_last_name, yr.child_boxing_program, yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (yr.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR yr.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_kiosk_youth(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_lil_champs_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT yr.id, yr.child_first_name, yr.child_last_name, yr.child_date_of_birth, yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND yr.extended_program = 'Lil Champs Corner'
    AND public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (yr.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR yr.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_lil_champs_youth(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_excursion_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_boxing_program public.boxing_program, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT yr.id, yr.child_first_name, yr.child_last_name, yr.child_boxing_program, yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND public.passes_kiosk_year_gate(yr.program_year, yr.archived_at)
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (yr.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR yr.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_excursion_youth(text) TO anon, authenticated;
