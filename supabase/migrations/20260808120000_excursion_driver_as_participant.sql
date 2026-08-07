-- ═══════════════════════════════════════════════════════════════════
-- Excursion drivers become PEOPLE, not a free-text name on the vehicle
-- ═══════════════════════════════════════════════════════════════════
-- A driver is now one of the loaded coaches/volunteers, marked as driving a
-- specific van (and riding in it — they take a seat). This:
--   • lets drivers be assigned later (on the Load page), changed last-minute
--   • makes seat capacity include the driver naturally (they're a rider)
--   • counts each person ONCE (fixes the driver being double-counted in totals)
--
-- Back-compat: older/closed trips keep their text driver_name; get_excursion_
-- vehicles falls back to it, so their displays are unchanged.

BEGIN;

-- 1) The driver link. FK ON DELETE SET NULL keeps it self-cleaning when a van
--    is removed. A driver also rides in the van (vehicle_id = driving_vehicle_id).
ALTER TABLE public.excursion_personnel
  ADD COLUMN IF NOT EXISTS driving_vehicle_id uuid
  REFERENCES public.excursion_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excursion_personnel_driving_vehicle
  ON public.excursion_personnel(driving_vehicle_id);

-- 2) Driver is optional on the vehicle now (assigned later from the people).
ALTER TABLE public.excursion_vehicles ALTER COLUMN driver_name DROP NOT NULL;

-- 3) Personnel read surfaces driving_vehicle_id.
DROP FUNCTION IF EXISTS public.get_excursion_personnel(uuid);
CREATE FUNCTION public.get_excursion_personnel(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, vehicle_id uuid, return_vehicle_id uuid, driving_vehicle_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, name, vehicle_id, return_vehicle_id, driving_vehicle_id, created_at
  FROM public.excursion_personnel
  WHERE excursion_id = _excursion_id
  ORDER BY created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO authenticated;

-- 4) Vehicle read now derives the driver from the people (falling back to the
--    legacy driver_name for older trips) and exposes driver_personnel_id.
--    assigned_count already counts youth + personnel in the van → the driver,
--    being a personnel in the van, is included.
DROP FUNCTION IF EXISTS public.get_excursion_vehicles(uuid);
CREATE FUNCTION public.get_excursion_vehicles(_excursion_id uuid)
RETURNS TABLE (id uuid, name text, seat_cap integer, driver_name text, driver_personnel_id uuid, assigned_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    v.id, v.name, v.seat_cap,
    COALESCE(d.name, v.driver_name) AS driver_name,
    d.id AS driver_personnel_id,
    (SELECT COUNT(*) FROM public.excursion_vehicle_assignments eva WHERE eva.vehicle_id = v.id)
    + (SELECT COUNT(*) FROM public.excursion_personnel ep WHERE ep.vehicle_id = v.id) AS assigned_count
  FROM public.excursion_vehicles v
  LEFT JOIN LATERAL (
    SELECT id, name FROM public.excursion_personnel
    WHERE driving_vehicle_id = v.id
    ORDER BY created_at ASC LIMIT 1
  ) d ON true
  WHERE v.excursion_id = _excursion_id
  ORDER BY v.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.get_excursion_vehicles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO authenticated;

-- 5) Adding a vehicle no longer requires a driver (coach + admin variants).
CREATE OR REPLACE FUNCTION public.add_excursion_vehicle(
  _excursion_id uuid, _name text, _seat_cap integer, _driver_name text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _closed timestamptz; _new_id uuid;
BEGIN
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Vehicle name is required'; END IF;
  IF _seat_cap IS NULL OR _seat_cap <= 0 THEN RAISE EXCEPTION 'Seat capacity must be greater than 0'; END IF;

  INSERT INTO public.excursion_vehicles (excursion_id, name, seat_cap, driver_name)
  VALUES (_excursion_id, trim(_name), _seat_cap, NULLIF(trim(COALESCE(_driver_name, '')), ''))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END; $$;
REVOKE ALL ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_excursion_vehicle(
  _excursion_id uuid, _name text, _seat_cap integer, _driver_name text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _new_id uuid;
BEGIN
  PERFORM public.require_admin();
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Vehicle name is required'; END IF;
  IF _seat_cap IS NULL OR _seat_cap <= 0 THEN RAISE EXCEPTION 'Seat capacity must be greater than 0'; END IF;

  INSERT INTO public.excursion_vehicles (excursion_id, name, seat_cap, driver_name)
  VALUES (_excursion_id, trim(_name), _seat_cap, NULLIF(trim(COALESCE(_driver_name, '')), ''))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_add_excursion_vehicle(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_excursion_vehicle(uuid, text, integer, text) TO authenticated;

-- 6) Moving a coach's "rides-in" van clears a stale driver role if they leave
--    the van they were driving (keeps driving flag only if same van).
CREATE OR REPLACE FUNCTION public.set_excursion_personnel_vehicle(
  _personnel_id uuid, _vehicle_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _locked timestamptz; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT roster_locked_at INTO _locked FROM public.excursions WHERE id = _excursion_id;
  IF _locked IS NOT NULL THEN RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation'; END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    SELECT (vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap; END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel
    SET vehicle_id = _vehicle_id,
        driving_vehicle_id = CASE WHEN driving_vehicle_id IS DISTINCT FROM _vehicle_id THEN NULL ELSE driving_vehicle_id END
    WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_personnel_vehicle(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_excursion_personnel_vehicle(
  _personnel_id uuid, _vehicle_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  PERFORM public.require_admin();
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Personnel not found'; END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    SELECT (vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap; END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel
    SET vehicle_id = _vehicle_id,
        driving_vehicle_id = CASE WHEN driving_vehicle_id IS DISTINCT FROM _vehicle_id THEN NULL ELSE driving_vehicle_id END
    WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_excursion_personnel_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_excursion_personnel_vehicle(uuid, uuid) TO authenticated;

-- 7) Set / clear a van's driver (a person). Setting seats them in the van and
--    demotes any previous driver. Coach variants respect the lock; admin
--    variants bypass it (edit past/locked trips).
CREATE OR REPLACE FUNCTION public.set_excursion_vehicle_driver(
  _vehicle_id uuid, _personnel_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _locked timestamptz; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  SELECT roster_locked_at INTO _locked FROM public.excursions WHERE id = _excursion_id;
  IF _locked IS NOT NULL THEN RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation'; END IF;

  SELECT (vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _already IS DISTINCT FROM true THEN
    SELECT COUNT(*) INTO _current FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
    IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap; END IF;
  END IF;

  UPDATE public.excursion_personnel SET driving_vehicle_id = NULL WHERE driving_vehicle_id = _vehicle_id AND id <> _personnel_id;
  UPDATE public.excursion_personnel SET driving_vehicle_id = _vehicle_id, vehicle_id = _vehicle_id WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_excursion_vehicle_driver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_vehicle_driver(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_vehicle_driver(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_excursion_vehicle_driver(_vehicle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _locked timestamptz;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT roster_locked_at INTO _locked FROM public.excursions WHERE id = _excursion_id;
  IF _locked IS NOT NULL THEN RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.excursion_personnel SET driving_vehicle_id = NULL WHERE driving_vehicle_id = _vehicle_id;
END; $$;
REVOKE ALL ON FUNCTION public.clear_excursion_vehicle_driver(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_excursion_vehicle_driver(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.clear_excursion_vehicle_driver(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_excursion_vehicle_driver(
  _vehicle_id uuid, _personnel_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _excursion_id uuid; _seat_cap integer; _current bigint; _already boolean;
BEGIN
  PERFORM public.require_admin();
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

  SELECT (vehicle_id = _vehicle_id) INTO _already FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _already IS DISTINCT FROM true THEN
    SELECT COUNT(*) INTO _current FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
    SELECT _current + COUNT(*) INTO _current FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
    IF _current >= _seat_cap THEN RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap; END IF;
  END IF;

  UPDATE public.excursion_personnel SET driving_vehicle_id = NULL WHERE driving_vehicle_id = _vehicle_id AND id <> _personnel_id;
  UPDATE public.excursion_personnel SET driving_vehicle_id = _vehicle_id, vehicle_id = _vehicle_id WHERE id = _personnel_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_excursion_vehicle_driver(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_excursion_vehicle_driver(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_clear_excursion_vehicle_driver(_vehicle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  UPDATE public.excursion_personnel SET driving_vehicle_id = NULL WHERE driving_vehicle_id = _vehicle_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_clear_excursion_vehicle_driver(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_excursion_vehicle_driver(uuid) TO authenticated;

COMMIT;
