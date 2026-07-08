-- ═══════════════════════════════════════════════════════════════════
-- Late arrival: "arrived separately" + an arrival note
-- ═══════════════════════════════════════════════════════════════════
-- A late arrival isn't always in an NLA vehicle — sometimes a parent drops
-- them off. Forcing a vehicle records something untrue. This adds an
-- optional note on the check-in so a coach can record how they arrived
-- ("came from work — mom dropped off") without assigning a fake vehicle.
--
--   attendance_records.note  -> free-text per check-in (used for excursions)
--
-- The late-arrival RPC gains an optional _note, and the roster read now
-- surfaces it so it can be shown next to youth who arrived separately.

BEGIN;

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS note text;

-- ─── Late-arrival RPC — now accepts an optional arrival note ───────────
-- Signature changes (adds _note), so drop the old 3-arg version first.
DROP FUNCTION IF EXISTS public.coach_add_late_arrival(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.coach_add_late_arrival(
  _excursion_id uuid,
  _registration_id uuid,
  _vehicle_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (NOW() AT TIME ZONE 'America/New_York')::date;
  _clean_note text := NULLIF(btrim(coalesce(_note, '')), '');
  _vehicle_excursion_id uuid;
  _seat_cap integer;
  _assigned_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  -- 1a. Idempotent attendance insert (kiosk check-in may already exist).
  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, excursion_id, note
  )
  VALUES (
    _registration_id, _today, 'Excursion', _excursion_id, _clean_note
  )
  ON CONFLICT DO NOTHING;

  -- 1b. If a note was given, record/refresh it even when the kid was
  --     already checked in via the kiosk.
  IF _clean_note IS NOT NULL THEN
    UPDATE public.attendance_records
       SET note = _clean_note
     WHERE registration_id = _registration_id
       AND excursion_id = _excursion_id
       AND program_source = 'Excursion';
  END IF;

  -- 1c. Optional vehicle assignment (unchanged).
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

REVOKE ALL ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.coach_add_late_arrival(uuid, uuid, uuid, text) TO authenticated;

-- ─── Roster read now surfaces the arrival note ────────────────────────
DROP FUNCTION IF EXISTS public.get_excursion_roster_youth(uuid);

CREATE FUNCTION public.get_excursion_roster_youth(_excursion_id uuid)
RETURNS TABLE (
  registration_id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text,
  vehicle_id uuid,
  return_vehicle_id uuid,
  arrival_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    yr.id AS registration_id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program,
    yr.child_headshot_url,
    eva.vehicle_id,
    era.vehicle_id AS return_vehicle_id,
    ar.note AS arrival_note
  FROM public.attendance_records ar
  JOIN public.youth_registrations yr ON yr.id = ar.registration_id
  LEFT JOIN public.excursion_vehicle_assignments eva
    ON eva.excursion_id = ar.excursion_id
   AND eva.registration_id = ar.registration_id
  LEFT JOIN public.excursion_return_assignments era
    ON era.excursion_id = ar.excursion_id
   AND era.registration_id = ar.registration_id
  WHERE ar.excursion_id = _excursion_id
    AND ar.program_source = 'Excursion'
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_excursion_roster_youth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_roster_youth(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_roster_youth(uuid) TO authenticated;

COMMIT;
