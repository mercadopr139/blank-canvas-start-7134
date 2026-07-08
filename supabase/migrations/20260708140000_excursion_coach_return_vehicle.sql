-- ═══════════════════════════════════════════════════════════════════
-- Excursion: coaches/volunteers can be moved for the ride home too
-- ═══════════════════════════════════════════════════════════════════
-- Youth can already ride home in a different van than they came in. Coaches
-- and volunteers now get the same: a separate ride-home vehicle.
--
--   excursion_personnel.vehicle_id         -> ride there (or NULL = separate)
--   excursion_personnel.return_vehicle_id  -> ride home  (or NULL = separate)
--
-- Ride-home van occupancy = youth (return) + coaches (return).

BEGIN;

ALTER TABLE public.excursion_personnel
  ADD COLUMN IF NOT EXISTS return_vehicle_id uuid REFERENCES public.excursion_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excursion_personnel_return_vehicle
  ON public.excursion_personnel(return_vehicle_id);

-- Personnel read now surfaces both the ride-there and ride-home vehicle.
DROP FUNCTION IF EXISTS public.get_excursion_personnel(uuid);
CREATE FUNCTION public.get_excursion_personnel(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, vehicle_id uuid, return_vehicle_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, vehicle_id, return_vehicle_id, created_at
  FROM public.excursion_personnel
  WHERE excursion_id = _excursion_id
  ORDER BY created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO authenticated;

-- When the coach chooses "Rearrange", seed the ride-home chart from the ride
-- there — for youth (existing) AND coaches (new: copy vehicle_id into
-- return_vehicle_id), so everyone starts where they came and only movers move.
CREATE OR REPLACE FUNCTION public.seed_excursion_return_from_outbound(_excursion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  UPDATE public.excursion_personnel
     SET return_vehicle_id = vehicle_id
   WHERE excursion_id = _excursion_id
     AND return_vehicle_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_excursion_return_from_outbound(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO authenticated;

-- Assign / move a coach for the RIDE HOME (NULL = drives separately home).
-- Allowed until the trip is closed; capacity counts youth + coaches already
-- riding home in that van.
CREATE OR REPLACE FUNCTION public.set_excursion_personnel_return_vehicle(
  _personnel_id uuid,
  _vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _closed timestamptz;
  _seat_cap integer;
  _current bigint;
  _already boolean;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;

  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles
      WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

    SELECT (return_vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current FROM public.excursion_return_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE return_vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN
        RAISE EXCEPTION 'Vehicle is at capacity for the ride home (% of % seats)', _current, _seat_cap;
      END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel SET return_vehicle_id = _vehicle_id WHERE id = _personnel_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) TO authenticated;

-- Ride-home youth-assign capacity now counts coaches by their RIDE-HOME van.
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
    FROM public.excursion_personnel WHERE return_vehicle_id = _vehicle_id;
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
