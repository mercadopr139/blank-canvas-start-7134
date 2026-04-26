-- ═══════════════════════════════════════════════════════════════════
-- Excursion Check-In: Phase 2 polish
-- ═══════════════════════════════════════════════════════════════════
-- Two new RPCs that round out Phase 2:
--   1. coach_add_late_arrival — admin-only flow (gated by PIN in UI)
--      that bypasses the roster lock so a coach can manually check in
--      a kid who arrived late and place them in a vehicle in one shot.
--   2. excursion_clear_transportation — switches an Excursion from
--      "transportation needed" back to "not needed" and wipes any
--      vehicles + assignments she'd already set up. Used when Chrissy
--      changes her mind before submitting the roster.

BEGIN;

-- ─── 1) Late arrival — bypasses roster_locked_at intentionally ───────
-- Inserts an attendance_record (idempotent if the kid already checked
-- in via the kiosk) and optionally drops them into a vehicle.
CREATE OR REPLACE FUNCTION public.coach_add_late_arrival(
  _excursion_id uuid,
  _registration_id uuid,
  _vehicle_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (NOW() AT TIME ZONE 'America/New_York')::date;
  _vehicle_excursion_id uuid;
  _seat_cap integer;
  _assigned_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  -- 1a. Idempotent attendance insert. If the kid already has an
  --     attendance_record for this excursion, the unique constraint
  --     on attendance_records will trigger ON CONFLICT DO NOTHING.
  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, excursion_id
  )
  VALUES (
    _registration_id, _today, 'Excursion', _excursion_id
  )
  ON CONFLICT DO NOTHING;

  -- 1b. Optional vehicle assignment.
  IF _vehicle_id IS NOT NULL THEN
    SELECT excursion_id, seat_cap INTO _vehicle_excursion_id, _seat_cap
    FROM public.excursion_vehicles WHERE id = _vehicle_id;

    IF _vehicle_excursion_id IS NULL THEN
      RAISE EXCEPTION 'Vehicle not found';
    END IF;
    IF _vehicle_excursion_id <> _excursion_id THEN
      RAISE EXCEPTION 'Vehicle does not belong to this Excursion';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.excursion_vehicle_assignments
      WHERE vehicle_id = _vehicle_id AND registration_id = _registration_id
    ) INTO _already_in_this_vehicle;

    IF NOT _already_in_this_vehicle THEN
      SELECT COUNT(*) INTO _assigned_count
      FROM public.excursion_vehicle_assignments
      WHERE vehicle_id = _vehicle_id;
      IF _assigned_count >= _seat_cap THEN
        RAISE EXCEPTION 'Vehicle is at capacity (% of % seats filled)', _assigned_count, _seat_cap;
      END IF;
    END IF;

    INSERT INTO public.excursion_vehicle_assignments (
      excursion_id, vehicle_id, registration_id
    )
    VALUES (
      _excursion_id, _vehicle_id, _registration_id
    )
    ON CONFLICT (excursion_id, registration_id)
    DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid) TO authenticated;

-- ─── 2) Switch back to "no transportation" + wipe vehicles ───────────
CREATE OR REPLACE FUNCTION public.excursion_clear_transportation(
  _excursion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _locked_at timestamptz;
BEGIN
  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;

  -- Delete vehicles (cascades to assignments)
  DELETE FROM public.excursion_vehicles WHERE excursion_id = _excursion_id;

  UPDATE public.excursions
     SET transportation_required = false
   WHERE id = _excursion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.excursion_clear_transportation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excursion_clear_transportation(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.excursion_clear_transportation(uuid) TO authenticated;

COMMIT;
