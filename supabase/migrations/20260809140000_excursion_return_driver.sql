-- ═══════════════════════════════════════════════════════════════════
-- Ride home can have a DIFFERENT driver per vehicle than the ride there
-- ═══════════════════════════════════════════════════════════════════
-- Drivers often change for the trip home (they take the kids who live near
-- them). The outbound driver is excursion_personnel.driving_vehicle_id; this
-- adds a parallel return_driving_vehicle_id for the ride-home leg. A return
-- driver also rides home in that van (return_vehicle_id = the van).
--
-- The ride-home chart is seeded from the outbound one, so return drivers start
-- matching the drive there — the coach only changes who actually moves.

BEGIN;

ALTER TABLE public.excursion_personnel
  ADD COLUMN IF NOT EXISTS return_driving_vehicle_id uuid
  REFERENCES public.excursion_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excursion_personnel_return_driving_vehicle
  ON public.excursion_personnel(return_driving_vehicle_id);

-- Personnel read now surfaces the return driver link too.
DROP FUNCTION IF EXISTS public.get_excursion_personnel(uuid);
CREATE FUNCTION public.get_excursion_personnel(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, vehicle_id uuid, return_vehicle_id uuid, driving_vehicle_id uuid, return_driving_vehicle_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, vehicle_id, return_vehicle_id, driving_vehicle_id, return_driving_vehicle_id, created_at
  FROM public.excursion_personnel
  WHERE excursion_id = _excursion_id
  ORDER BY created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO authenticated;

-- Seed the ride home from the drive there — now also carries the driver over.
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

  -- Carry the outbound driver into the ride-home leg as the starting point.
  UPDATE public.excursion_personnel
     SET return_driving_vehicle_id = driving_vehicle_id
   WHERE excursion_id = _excursion_id
     AND return_driving_vehicle_id IS NULL
     AND driving_vehicle_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.seed_excursion_return_from_outbound(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.seed_excursion_return_from_outbound(uuid) TO authenticated;

-- Set / clear a van's RIDE-HOME driver (a person). Allowed until the trip is
-- closed (ride-home edits use the closed check, not the roster lock).
CREATE OR REPLACE FUNCTION public.set_excursion_vehicle_return_driver(
  _vehicle_id uuid, _personnel_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _closed timestamptz; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation'; END IF;

  -- Capacity for the ride home = youth riding home + coaches riding home.
  SELECT (return_vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _already IS DISTINCT FROM true THEN
    SELECT COUNT(*) INTO _current FROM public.excursion_return_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE return_vehicle_id = _vehicle_id;
    IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity for the ride home (% of % seats)', _current, _seat_cap; END IF;
  END IF;

  UPDATE public.excursion_personnel SET return_driving_vehicle_id = NULL WHERE return_driving_vehicle_id = _vehicle_id AND id <> _personnel_id;
  UPDATE public.excursion_personnel SET return_driving_vehicle_id = _vehicle_id, return_vehicle_id = _vehicle_id WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_excursion_vehicle_return_driver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_vehicle_return_driver(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_vehicle_return_driver(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_excursion_vehicle_return_driver(_vehicle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _closed timestamptz;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.excursion_personnel SET return_driving_vehicle_id = NULL WHERE return_driving_vehicle_id = _vehicle_id;
END; $$;
REVOKE ALL ON FUNCTION public.clear_excursion_vehicle_return_driver(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_excursion_vehicle_return_driver(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.clear_excursion_vehicle_return_driver(uuid) TO authenticated;

-- Admin variants (bypass the closed check, gated by require_admin).
CREATE OR REPLACE FUNCTION public.admin_set_excursion_vehicle_return_driver(
  _vehicle_id uuid, _personnel_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  PERFORM public.require_admin();
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

  SELECT (return_vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _already IS DISTINCT FROM true THEN
    SELECT COUNT(*) INTO _current FROM public.excursion_return_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE return_vehicle_id = _vehicle_id;
    IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity for the ride home (% of % seats)', _current, _seat_cap; END IF;
  END IF;

  UPDATE public.excursion_personnel SET return_driving_vehicle_id = NULL WHERE return_driving_vehicle_id = _vehicle_id AND id <> _personnel_id;
  UPDATE public.excursion_personnel SET return_driving_vehicle_id = _vehicle_id, return_vehicle_id = _vehicle_id WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_excursion_vehicle_return_driver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_excursion_vehicle_return_driver(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_clear_excursion_vehicle_return_driver(_vehicle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  UPDATE public.excursion_personnel SET return_driving_vehicle_id = NULL WHERE return_driving_vehicle_id = _vehicle_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_clear_excursion_vehicle_return_driver(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_excursion_vehicle_return_driver(uuid) TO authenticated;

-- Moving a coach's ride-home van now also clears a stale return-driver role if
-- they leave the van they were driving home (keeps it only for the same van).
CREATE OR REPLACE FUNCTION public.set_excursion_personnel_return_vehicle(
  _personnel_id uuid, _vehicle_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _closed timestamptz; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation'; END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    SELECT (return_vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current FROM public.excursion_return_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE return_vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity for the ride home (% of % seats)', _current, _seat_cap; END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel
     SET return_vehicle_id = _vehicle_id,
         return_driving_vehicle_id = CASE WHEN return_driving_vehicle_id IS DISTINCT FROM _vehicle_id THEN NULL ELSE return_driving_vehicle_id END
   WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_return_vehicle(uuid, uuid) TO authenticated;

COMMIT;
