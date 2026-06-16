-- ═══════════════════════════════════════════════════════════════════
-- Excursion: admin override RPCs for retroactive editing
-- ═══════════════════════════════════════════════════════════════════
-- Phase A of the post-audit fix. Adds a parallel set of admin-only
-- RPCs that the Admin Edit Excursion modal calls instead of the
-- coach/kiosk RPCs. Two behavioral differences from the originals:
--
--   1. attendance backfill takes an EXPLICIT date — the existing
--      coach_add_late_arrival hard-codes "today in Eastern Time",
--      which silently mis-dates any attendance you record AFTER the
--      trip happened. Admins routinely need to record a kid into
--      last Saturday's trip, so we take the date as a parameter.
--
--   2. all admin write RPCs IGNORE roster_locked_at. Coach Mode's
--      lock is Chrissy's safety rail during a live trip; it's not
--      supposed to block an admin fixing the historical record.
--
-- These are GRANTED TO authenticated ONLY (not anon) and gated by a
-- has_role(admin) check inside the function — defense in depth on
-- top of the SECURITY DEFINER context.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Shared guard: only admins may call these. Raises a permission error
-- if the caller doesn't have the admin role.
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;

-- ─── 1) Record attendance for an excursion at an EXPLICIT date ───────
-- This is the function that fixes Bug #1 from the 2026-06-16 audit.
-- The previous path (coach_add_late_arrival) inserted attendance with
-- check_in_date = today, which is correct for late arrivals on the
-- same day but wrong for backfilling a past trip. Admin specifies
-- the date here.
--
-- Idempotent: the existing UNIQUE constraint on attendance_records
-- (registration_id, check_in_date, program_source) makes ON CONFLICT
-- DO NOTHING the right behavior — if the kid already has an Excursion
-- record on that date, the call is a no-op, not an error.
CREATE OR REPLACE FUNCTION public.admin_record_excursion_attendance(
  _excursion_id uuid,
  _registration_id uuid,
  _check_in_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, excursion_id
  )
  VALUES (
    _registration_id, _check_in_date, 'Excursion', _excursion_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_excursion_attendance(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_excursion_attendance(uuid, uuid, date) TO authenticated;

-- ─── 2) Add a vehicle to an excursion (admin, no lock check) ─────────
CREATE OR REPLACE FUNCTION public.admin_add_excursion_vehicle(
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
  _new_id uuid;
BEGIN
  PERFORM public.require_admin();

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

REVOKE ALL ON FUNCTION public.admin_add_excursion_vehicle(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_excursion_vehicle(uuid, text, integer, text) TO authenticated;

-- ─── 3) Remove a vehicle from an excursion (admin, no lock check) ────
-- Cascade deletes its assignments via the existing FK.
CREATE OR REPLACE FUNCTION public.admin_remove_excursion_vehicle(_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.excursion_vehicles WHERE id = _vehicle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_excursion_vehicle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_excursion_vehicle(uuid) TO authenticated;

-- ─── 4) Assign a youth to a vehicle (admin, no lock check) ───────────
-- Idempotent move: upsert via ON CONFLICT (excursion_id, registration_id).
CREATE OR REPLACE FUNCTION public.admin_assign_youth_to_vehicle(
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
  _current_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  PERFORM public.require_admin();

  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap
  FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.excursion_vehicle_assignments
    WHERE vehicle_id = _vehicle_id AND registration_id = _registration_id
  ) INTO _already_in_this_vehicle;

  IF NOT _already_in_this_vehicle THEN
    SELECT COUNT(*) INTO _current_count
    FROM public.excursion_vehicle_assignments
    WHERE vehicle_id = _vehicle_id;
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

REVOKE ALL ON FUNCTION public.admin_assign_youth_to_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_youth_to_vehicle(uuid, uuid) TO authenticated;

-- ─── 5) Unassign a youth from any vehicle on this excursion ──────────
CREATE OR REPLACE FUNCTION public.admin_unassign_youth_from_vehicle(
  _excursion_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.excursion_vehicle_assignments
   WHERE excursion_id = _excursion_id AND registration_id = _registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unassign_youth_from_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unassign_youth_from_vehicle(uuid, uuid) TO authenticated;

-- ─── 6) Add a coach / volunteer riding along (admin, no lock check) ──
CREATE OR REPLACE FUNCTION public.admin_add_excursion_personnel(
  _excursion_id uuid,
  _name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  PERFORM public.require_admin();

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  INSERT INTO public.excursion_personnel (excursion_id, name)
  VALUES (_excursion_id, trim(_name))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_excursion_personnel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_excursion_personnel(uuid, text) TO authenticated;

-- ─── 7) Remove a coach / volunteer (admin, no lock check) ────────────
CREATE OR REPLACE FUNCTION public.admin_remove_excursion_personnel(_personnel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.excursion_personnel WHERE id = _personnel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_excursion_personnel(uuid) TO authenticated;

COMMIT;
