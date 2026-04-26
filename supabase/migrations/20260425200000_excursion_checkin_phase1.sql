-- ═══════════════════════════════════════════════════════════════════
-- Excursion Check-In: Phase 1 (kiosk)
-- ═══════════════════════════════════════════════════════════════════
-- Adds the database support a youth needs to check themselves in to
-- today's Excursion via the kiosk. Builds on the existing excursions
-- table (date / name / notes) and the existing attendance_records table
-- by linking each Excursion check-in to the specific Excursion record
-- via a new attendance_records.excursion_id column.
--
-- Phases 2 (Coach Mode + vehicles + personnel) and 3 (arrival / return
-- confirmations) ship in their own migrations.

BEGIN;

-- 1) Link an attendance_record to a specific excursion. Nullable because
--    NLA / Lil Champs Corner check-ins won't reference one.
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS excursion_id uuid REFERENCES public.excursions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_attendance_records_excursion_id
  ON public.attendance_records(excursion_id) WHERE excursion_id IS NOT NULL;

-- 2) Kiosk search: every approved youth can check in to an Excursion
--    (no extended_program filter, since Excursions are open to all NLA
--    youth, not just Lil Champs Corner kids). Mirrors search_kiosk_youth.
CREATE OR REPLACE FUNCTION public.search_excursion_youth(_search text)
RETURNS TABLE (
  id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program,
    yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE
    yr.approved_for_attendance = true
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (
      yr.child_first_name ILIKE ('%' || trim(_search) || '%')
      OR yr.child_last_name ILIKE ('%' || trim(_search) || '%')
    )
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_excursion_youth(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_excursion_youth(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_excursion_youth(text) TO authenticated;

-- 3) Live counter of how many youth have checked in to a specific Excursion.
CREATE OR REPLACE FUNCTION public.get_excursion_checkin_count(_excursion_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.attendance_records
  WHERE excursion_id = _excursion_id
    AND program_source = 'Excursion';
$$;

REVOKE ALL ON FUNCTION public.get_excursion_checkin_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_checkin_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_checkin_count(uuid) TO authenticated;

-- 4) Returns the Excursion scheduled for today, if any. The kiosk uses
--    this to show the trip name at the top of the screen, and to refuse
--    check-ins on days where no Excursion is on the calendar.
CREATE OR REPLACE FUNCTION public.get_todays_excursion()
RETURNS TABLE (
  id uuid,
  date date,
  name text,
  notes text,
  youth_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, date, name, notes, youth_count
  FROM public.excursions
  WHERE date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_todays_excursion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO authenticated;

COMMIT;
