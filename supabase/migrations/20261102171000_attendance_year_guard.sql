-- A check-in can never again land on a past year's registration (Josh,
-- 2026-11-02: the Smile Lab roster filed nine on 2025-26 rows and the
-- attendance numbers went wrong). Every list and search now carries the
-- current-year gate, but a guard at the table is the only thing that holds
-- for every path there is and every path still to be written: the kiosks,
-- a manual add, a roster, a future RPC. While the gate is on, an insert
-- for a youth whose registration is not the current year's is refused
-- with a plain message; while the gate is off nothing changes. Only new
-- rows are checked — moving a row to the right registration (the repair)
-- is an update and passes. Safe to run more than once.

CREATE OR REPLACE FUNCTION public.attendance_records_year_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _year text;
  _archived timestamptz;
BEGIN
  SELECT yr.program_year, yr.archived_at INTO _year, _archived
    FROM public.youth_registrations yr WHERE yr.id = NEW.registration_id;
  IF NOT FOUND THEN
    RETURN NEW; -- other tables' rows (Hawk Squad, BAM) are not NLA registrations; nothing to check
  END IF;
  IF NOT public.passes_kiosk_year_gate(_year, _archived) THEN
    RAISE EXCEPTION 'This youth''s registration is for a past program year (%). Re-register them for the current year, then check them in.', coalesce(_year, 'unknown')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_records_year_guard ON public.attendance_records;
CREATE TRIGGER trg_attendance_records_year_guard
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.attendance_records_year_guard();

SELECT 'attendance year guard ready' AS done;
