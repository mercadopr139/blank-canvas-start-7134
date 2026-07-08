-- ═══════════════════════════════════════════════════════════════════
-- Allow adding a vehicle any time until the trip is CLOSED
-- ═══════════════════════════════════════════════════════════════════
-- Coaches rearrange the ride home AFTER the roster is locked, and sometimes
-- need a van that wasn't on the trip there (e.g. a parent's car heads north).
-- add_excursion_vehicle used to reject once the roster was locked; it now
-- only rejects once the trip is closed (returned_at set). Everything else is
-- unchanged, so pre-lock setup behaves exactly as before.

BEGIN;

CREATE OR REPLACE FUNCTION public.add_excursion_vehicle(
  _excursion_id uuid,
  _name text,
  _seat_cap integer,
  _driver_name text
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
    RAISE EXCEPTION 'Vehicle name is required';
  END IF;
  IF _driver_name IS NULL OR length(trim(_driver_name)) = 0 THEN
    RAISE EXCEPTION 'Driver name is required';
  END IF;
  IF _seat_cap IS NULL OR _seat_cap <= 0 THEN
    RAISE EXCEPTION 'Seat capacity must be greater than 0';
  END IF;

  INSERT INTO public.excursion_vehicles (excursion_id, name, seat_cap, driver_name)
  VALUES (_excursion_id, trim(_name), _seat_cap, trim(_driver_name))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_excursion_vehicle(uuid, text, integer, text) TO authenticated;

COMMIT;
