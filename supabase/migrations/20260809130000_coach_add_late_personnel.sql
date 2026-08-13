-- ═══════════════════════════════════════════════════════════════════
-- Coach Mode: add a volunteer/coach as a LATE arrival (after roster lock)
-- ═══════════════════════════════════════════════════════════════════
-- The normal add_excursion_personnel rejects once the roster is locked. Just
-- like coach_add_late_arrival for youth, this lets Coach Mode (PIN-gated, anon)
-- add a coach/volunteer who showed up after the roster was submitted. Only
-- blocked once the trip is fully closed (returned_at). New personnel start with
-- no vehicle ("driving separately"); they can be seated from the admin editor.
CREATE OR REPLACE FUNCTION public.coach_add_late_personnel(
  _excursion_id uuid,
  _name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed timestamptz;
  _new_id uuid;
BEGIN
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  INSERT INTO public.excursion_personnel (excursion_id, name)
  VALUES (_excursion_id, trim(_name))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.coach_add_late_personnel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_add_late_personnel(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.coach_add_late_personnel(uuid, text) TO authenticated;
