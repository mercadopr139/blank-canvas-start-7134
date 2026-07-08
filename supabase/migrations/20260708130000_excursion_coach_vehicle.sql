-- ═══════════════════════════════════════════════════════════════════
-- Excursion: coaches / volunteers ride in a vehicle (or drive separately)
-- ═══════════════════════════════════════════════════════════════════
-- Coaches and volunteers physically take a seat, so they can now be placed
-- in one of the excursion's vehicles (or left as "driving separately").
-- A coach riding in a van counts toward that van's seat capacity, alongside
-- the youth, so a vehicle can't be over-filled.
--
--   excursion_personnel.vehicle_id  -> the van they ride in, or NULL when
--                                       they drive separately (their own car).
--
-- Vehicle occupancy (used for the "x/seats" display and capacity checks) is
-- now: youth assigned to the van + coaches riding the van.

BEGIN;

ALTER TABLE public.excursion_personnel
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.excursion_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excursion_personnel_vehicle
  ON public.excursion_personnel(vehicle_id);

-- Personnel read now surfaces the vehicle they're riding in.
DROP FUNCTION IF EXISTS public.get_excursion_personnel(uuid);
CREATE FUNCTION public.get_excursion_personnel(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, vehicle_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, vehicle_id, created_at
  FROM public.excursion_personnel
  WHERE excursion_id = _excursion_id
  ORDER BY created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO authenticated;

-- Vehicle occupancy now includes coaches riding the van (same return shape,
-- so CREATE OR REPLACE is fine).
CREATE OR REPLACE FUNCTION public.get_excursion_vehicles(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, seat_cap integer, driver_name text, assigned_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    v.id, v.name, v.seat_cap, v.driver_name,
    (SELECT COUNT(*) FROM public.excursion_vehicle_assignments eva WHERE eva.vehicle_id = v.id)
    + (SELECT COUNT(*) FROM public.excursion_personnel ep WHERE ep.vehicle_id = v.id) AS assigned_count
  FROM public.excursion_vehicles v
  WHERE v.excursion_id = _excursion_id
  ORDER BY v.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_vehicles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO authenticated;

-- Assign / move a coach to a van (or NULL = drives separately). Blocked when
-- locked; capacity counts youth + coaches already in the van.
CREATE OR REPLACE FUNCTION public.set_excursion_personnel_vehicle(
  _personnel_id uuid,
  _vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _locked timestamptz;
  _seat_cap integer;
  _current bigint;
  _already boolean;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;

  SELECT roster_locked_at INTO _locked FROM public.excursions WHERE id = _excursion_id;
  IF _locked IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles
      WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

    SELECT (vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN
        RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap;
      END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel SET vehicle_id = _vehicle_id WHERE id = _personnel_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) TO authenticated;

-- Youth-assign capacity now also counts coaches riding the van.
CREATE OR REPLACE FUNCTION public.assign_youth_to_vehicle(
  _vehicle_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _locked_at timestamptz;
  _seat_cap integer;
  _current_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap
  FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.excursion_vehicle_assignments
    WHERE vehicle_id = _vehicle_id AND registration_id = _registration_id
  ) INTO _already_in_this_vehicle;

  IF NOT _already_in_this_vehicle THEN
    SELECT COUNT(*) INTO _current_count
    FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current_count + COUNT(*) INTO _current_count
    FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
    IF _current_count >= _seat_cap THEN
      RAISE EXCEPTION 'Vehicle is at capacity (% of % seats filled)', _current_count, _seat_cap;
    END IF;
  END IF;

  INSERT INTO public.excursion_vehicle_assignments (excursion_id, vehicle_id, registration_id)
  VALUES (_excursion_id, _vehicle_id, _registration_id)
  ON CONFLICT (excursion_id, registration_id)
  DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) TO authenticated;

-- Ride-home youth-assign capacity also counts coaches riding the van.
CREATE OR REPLACE FUNCTION public.assign_youth_return_vehicle(
  _vehicle_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

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
    FROM public.excursion_return_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current + COUNT(*) INTO _current
    FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
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

COMMIT;
