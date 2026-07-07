-- ═══════════════════════════════════════════════════════════════════
-- Excursion: the ride home (return-leg seating)
-- ═══════════════════════════════════════════════════════════════════
-- Kids live all over the county, so it's often smarter to load the vans
-- differently for the trip home (one goes south, one north, etc.). This
-- adds an optional, independent "ride home" seating chart per excursion:
--   * excursions.return_plan = 'same' (ride home in the arrival vehicles)
--     or 'custom' (rearranged). NULL until the coach decides.
--   * excursion_return_assignments mirrors excursion_vehicle_assignments
--     but for the trip home. The outbound table is left completely untouched.
--
-- These are editable AFTER the roster is locked (the ride home is planned
-- during the trip) but are frozen once the trip is closed (returned_at set).

BEGIN;

-- 1) Ride-home seating chart (independent of the arrival one).
CREATE TABLE IF NOT EXISTS public.excursion_return_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.excursion_vehicles(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (excursion_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_excursion_return_assignments_vehicle
  ON public.excursion_return_assignments(vehicle_id);

ALTER TABLE public.excursion_return_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view excursion_return_assignments" ON public.excursion_return_assignments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert excursion_return_assignments" ON public.excursion_return_assignments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update excursion_return_assignments" ON public.excursion_return_assignments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete excursion_return_assignments" ON public.excursion_return_assignments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) The coach's choice for the trip home.
ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS return_plan text;

-- 3) Roster read now also surfaces each youth's ride-home vehicle.
DROP FUNCTION IF EXISTS public.get_excursion_roster_youth(uuid);

CREATE FUNCTION public.get_excursion_roster_youth(_excursion_id uuid)
RETURNS TABLE (
  registration_id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text,
  vehicle_id uuid,
  return_vehicle_id uuid
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
    era.vehicle_id AS return_vehicle_id
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

-- 4) get_todays_excursion now surfaces return_plan too (drop + recreate to
--    change the return shape).
DROP FUNCTION IF EXISTS public.get_todays_excursion();

CREATE FUNCTION public.get_todays_excursion()
RETURNS TABLE (
  id uuid,
  date date,
  name text,
  notes text,
  youth_count integer,
  transportation_required boolean,
  roster_locked_at timestamptz,
  arrived_at timestamptz,
  returned_at timestamptz,
  arrival_note text,
  return_note text,
  return_plan text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, date, name, notes, youth_count, transportation_required,
         roster_locked_at, arrived_at, returned_at, arrival_note, return_note,
         return_plan
  FROM public.excursions
  WHERE date = (NOW() AT TIME ZONE 'America/New_York')::date
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_todays_excursion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO authenticated;

-- 5) Set the ride-home plan ('same' | 'custom'). Allowed until the trip is
--    closed. Choosing 'custom' does NOT itself move anyone — the UI seeds the
--    ride-home chart from the arrival chart (below) so the coach starts from
--    the current seating and only moves who needs moving.
CREATE OR REPLACE FUNCTION public.set_excursion_return_plan(
  _excursion_id uuid,
  _plan text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed timestamptz;
BEGIN
  IF _plan NOT IN ('same', 'custom') THEN
    RAISE EXCEPTION 'Invalid return plan';
  END IF;
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.excursions SET return_plan = _plan WHERE id = _excursion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_excursion_return_plan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_return_plan(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_return_plan(uuid, text) TO authenticated;

-- 6) Pre-fill the ride-home chart from the arrival chart, so "Rearrange"
--    starts where they are and they only move who needs to move.
CREATE OR REPLACE FUNCTION public.seed_excursion_return_from_outbound(
  _excursion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed timestamptz;
BEGIN
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.excursion_return_assignments (excursion_id, vehicle_id, registration_id)
  SELECT excursion_id, vehicle_id, registration_id
  FROM public.excursion_vehicle_assignments
  WHERE excursion_id = _excursion_id
  ON CONFLICT (excursion_id, registration_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_excursion_return_from_outbound(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO authenticated;

-- 7) Assign a youth to a ride-home vehicle (moves them if already placed).
--    Allowed until the trip is closed; respects seat capacity.
CREATE OR REPLACE FUNCTION public.assign_youth_return_vehicle(
  _vehicle_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _seat_cap integer;
  _closed timestamptz;
  _current bigint;
  _already boolean;
BEGIN
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap
  FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.excursion_return_assignments
    WHERE vehicle_id = _vehicle_id AND registration_id = _registration_id
  ) INTO _already;

  IF NOT _already THEN
    SELECT COUNT(*) INTO _current
    FROM public.excursion_return_assignments
    WHERE vehicle_id = _vehicle_id;
    IF _current >= _seat_cap THEN
      RAISE EXCEPTION 'Vehicle is at capacity for the ride home (% of % seats)', _current, _seat_cap;
    END IF;
  END IF;

  INSERT INTO public.excursion_return_assignments (excursion_id, vehicle_id, registration_id)
  VALUES (_excursion_id, _vehicle_id, _registration_id)
  ON CONFLICT (excursion_id, registration_id)
  DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_youth_return_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_youth_return_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_youth_return_vehicle(uuid, uuid) TO authenticated;

-- 8) Remove a youth from the ride-home chart.
CREATE OR REPLACE FUNCTION public.unassign_youth_return(
  _excursion_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed timestamptz;
BEGIN
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM public.excursion_return_assignments
   WHERE excursion_id = _excursion_id AND registration_id = _registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unassign_youth_return(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unassign_youth_return(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.unassign_youth_return(uuid, uuid) TO authenticated;

COMMIT;
