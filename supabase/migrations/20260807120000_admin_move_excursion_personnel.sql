-- Admin: move a coach/volunteer to a vehicle (or NULL = "drove separately") on
-- ANY excursion, bypassing the roster lock — same latitude admins already have
-- for youth (admin_assign_youth_to_vehicle). Enforces the vehicle's seat
-- capacity, counting both youth riders and other coaches already in the van.
--
-- Distinct from the coach-mode set_excursion_personnel_vehicle(), which blocks
-- edits once the roster is locked. This admin variant is for backfilling /
-- correcting past, locked, or closed trips from the Edit Excursion modal.
CREATE OR REPLACE FUNCTION public.admin_set_excursion_personnel_vehicle(
  _personnel_id uuid,
  _vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _seat_cap integer;
  _current bigint;
  _already boolean;
BEGIN
  PERFORM public.require_admin();

  SELECT excursion_id INTO _excursion_id
  FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN
    RAISE EXCEPTION 'Personnel not found';
  END IF;

  IF _vehicle_id IS NOT NULL THEN
    SELECT seat_cap INTO _seat_cap FROM public.excursion_vehicles
      WHERE id = _vehicle_id AND excursion_id = _excursion_id;
    IF _seat_cap IS NULL THEN
      RAISE EXCEPTION 'Vehicle not found';
    END IF;

    -- Only capacity-check when actually changing vehicles.
    SELECT (vehicle_id = _vehicle_id) INTO _already
      FROM public.excursion_personnel WHERE id = _personnel_id;
    IF _already IS DISTINCT FROM true THEN
      SELECT COUNT(*) INTO _current
        FROM public.excursion_vehicle_assignments WHERE vehicle_id = _vehicle_id;
      SELECT _current + COUNT(*) INTO _current
        FROM public.excursion_personnel WHERE vehicle_id = _vehicle_id;
      IF _current >= _seat_cap THEN
        RAISE EXCEPTION 'Vehicle is at capacity (% of % seats)', _current, _seat_cap;
      END IF;
    END IF;
  END IF;

  UPDATE public.excursion_personnel SET vehicle_id = _vehicle_id WHERE id = _personnel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_excursion_personnel_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_excursion_personnel_vehicle(uuid, uuid) TO authenticated;
