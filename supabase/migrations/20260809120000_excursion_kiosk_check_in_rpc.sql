-- ═══════════════════════════════════════════════════════════════════
-- Excursion kiosk self-check-in — gate the write behind the roster lock
-- ═══════════════════════════════════════════════════════════════════
-- The excursion check-in kiosk previously did a direct anon INSERT into
-- attendance_records, so the roster lock was only enforced in the UI. If the
-- roster got locked while a kiosk sat open, a stale screen could still write a
-- check-in. This RPC moves the write server-side and refuses once the roster
-- is submitted (locked). Late arrivals after lock go through Coach Mode's
-- PIN-gated coach_add_late_arrival instead.
--
-- Returns a status string the kiosk maps to UI:
--   'ok' | 'duplicate' | 'locked' | 'no_excursion'
CREATE OR REPLACE FUNCTION public.excursion_kiosk_check_in(
  _excursion_id uuid,
  _registration_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _locked timestamptz;
  _today date;
BEGIN
  SELECT roster_locked_at INTO _locked FROM public.excursions WHERE id = _excursion_id;
  IF NOT FOUND THEN
    RETURN 'no_excursion';
  END IF;
  IF _locked IS NOT NULL THEN
    RETURN 'locked';
  END IF;

  -- Same "today in Eastern" the kiosk computed client-side, now authoritative.
  _today := (now() AT TIME ZONE 'America/New_York')::date;

  BEGIN
    INSERT INTO public.attendance_records (registration_id, check_in_date, program_source, excursion_id)
    VALUES (_registration_id, _today, 'Excursion', _excursion_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'duplicate';
  END;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.excursion_kiosk_check_in(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excursion_kiosk_check_in(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.excursion_kiosk_check_in(uuid, uuid) TO authenticated;
