-- ═══════════════════════════════════════════════════════════════════
-- Excursion Check-In: Phase 2 (Coach Mode + vehicles + personnel)
-- ═══════════════════════════════════════════════════════════════════
-- Once youth have checked themselves in via the Phase 1 kiosk, the
-- coach uses Coach Mode (separate route) to:
--   1. answer "Does this Excursion require transportation?"
--   2. add vehicles (presets: Van A 14, Van B 14, Mini-Van 6, Mini-Bus
--      21, or custom Other) and a driver name for each
--   3. assign each checked-in youth to a vehicle
--   4. add coaches/volunteers riding along (non-drivers)
--   5. lock the roster ("Submit Excursion Roster")
--
-- The kiosk iPad is anonymous, so all writes go through SECURITY
-- DEFINER RPCs (mirrors Phase 1's read pattern). Tables stay
-- admin-only via RLS — no anon table access.
--
-- Phase 3 (arrival/return checkpoints) builds on top of this.

BEGIN;

-- 1) Excursion-level Coach Mode state
ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS transportation_required boolean,
  ADD COLUMN IF NOT EXISTS roster_locked_at timestamptz;

-- 2) Vehicles attached to a specific Excursion
CREATE TABLE IF NOT EXISTS public.excursion_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  name text NOT NULL,                                 -- 'Van A' | 'Van B' | 'Mini-Van' | 'Mini-Bus' | custom
  seat_cap integer NOT NULL CHECK (seat_cap > 0),     -- riders excl. driver
  driver_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_excursion_vehicles_excursion_id
  ON public.excursion_vehicles(excursion_id);

ALTER TABLE public.excursion_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view excursion_vehicles" ON public.excursion_vehicles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert excursion_vehicles" ON public.excursion_vehicles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update excursion_vehicles" ON public.excursion_vehicles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete excursion_vehicles" ON public.excursion_vehicles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Youth → vehicle assignments. excursion_id denormalized so we can
--    enforce "a youth is in at most one vehicle per Excursion".
CREATE TABLE IF NOT EXISTS public.excursion_vehicle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.excursion_vehicles(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (excursion_id, registration_id)
);

CREATE INDEX IF NOT EXISTS idx_excursion_assignments_vehicle_id
  ON public.excursion_vehicle_assignments(vehicle_id);

ALTER TABLE public.excursion_vehicle_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view excursion_assignments" ON public.excursion_vehicle_assignments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert excursion_assignments" ON public.excursion_vehicle_assignments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update excursion_assignments" ON public.excursion_vehicle_assignments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete excursion_assignments" ON public.excursion_vehicle_assignments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Coaches / volunteers riding along (not drivers). Free-text names.
CREATE TABLE IF NOT EXISTS public.excursion_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_excursion_personnel_excursion_id
  ON public.excursion_personnel(excursion_id);

ALTER TABLE public.excursion_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view excursion_personnel" ON public.excursion_personnel
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert excursion_personnel" ON public.excursion_personnel
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update excursion_personnel" ON public.excursion_personnel
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete excursion_personnel" ON public.excursion_personnel
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ═══════════════════════════════════════════════════════════════════
-- READ RPCs (anon-callable; SECURITY DEFINER bypasses RLS)
-- ═══════════════════════════════════════════════════════════════════

-- Youth currently checked in for an Excursion, with their vehicle if any
CREATE OR REPLACE FUNCTION public.get_excursion_roster_youth(_excursion_id uuid)
RETURNS TABLE (
  registration_id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text,
  vehicle_id uuid
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
    eva.vehicle_id
  FROM public.attendance_records ar
  JOIN public.youth_registrations yr ON yr.id = ar.registration_id
  LEFT JOIN public.excursion_vehicle_assignments eva
    ON eva.excursion_id = ar.excursion_id
   AND eva.registration_id = ar.registration_id
  WHERE ar.excursion_id = _excursion_id
    AND ar.program_source = 'Excursion'
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_excursion_roster_youth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_roster_youth(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_roster_youth(uuid) TO authenticated;

-- Vehicles for an Excursion with assignment count
CREATE OR REPLACE FUNCTION public.get_excursion_vehicles(_excursion_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  seat_cap integer,
  driver_name text,
  assigned_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.name,
    v.seat_cap,
    v.driver_name,
    COUNT(eva.id) AS assigned_count
  FROM public.excursion_vehicles v
  LEFT JOIN public.excursion_vehicle_assignments eva ON eva.vehicle_id = v.id
  WHERE v.excursion_id = _excursion_id
  GROUP BY v.id
  ORDER BY v.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_excursion_vehicles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_vehicles(uuid) TO authenticated;

-- Coaches / volunteers riding along
CREATE OR REPLACE FUNCTION public.get_excursion_personnel(_excursion_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, created_at
  FROM public.excursion_personnel
  WHERE excursion_id = _excursion_id
  ORDER BY created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_personnel(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- WRITE RPCs (anon-callable). All refuse when the roster is locked,
-- except lock/unlock themselves.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_excursion_transportation_required(
  _excursion_id uuid,
  _required boolean
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
  UPDATE public.excursions
     SET transportation_required = _required
   WHERE id = _excursion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_excursion_transportation_required(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_transportation_required(uuid, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_transportation_required(uuid, boolean) TO authenticated;

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
  _locked_at timestamptz;
  _new_id uuid;
BEGIN
  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
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

CREATE OR REPLACE FUNCTION public.remove_excursion_vehicle(_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _locked_at timestamptz;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM public.excursion_vehicles WHERE id = _vehicle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_excursion_vehicle(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_excursion_vehicle(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.remove_excursion_vehicle(uuid) TO authenticated;

-- Idempotent: if youth is already in another vehicle for this Excursion,
-- we move them. Single SQL upsert via ON CONFLICT.
CREATE OR REPLACE FUNCTION public.assign_youth_to_vehicle(
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
  _locked_at timestamptz;
  _seat_cap integer;
  _current_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap
  FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

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

REVOKE ALL ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.assign_youth_to_vehicle(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unassign_youth_from_vehicle(
  _excursion_id uuid,
  _registration_id uuid
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
  DELETE FROM public.excursion_vehicle_assignments
   WHERE excursion_id = _excursion_id AND registration_id = _registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unassign_youth_from_vehicle(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unassign_youth_from_vehicle(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.unassign_youth_from_vehicle(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_excursion_personnel(
  _excursion_id uuid,
  _name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _locked_at timestamptz;
  _new_id uuid;
BEGIN
  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  INSERT INTO public.excursion_personnel (excursion_id, name)
  VALUES (_excursion_id, trim(_name))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_excursion_personnel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_excursion_personnel(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_excursion_personnel(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_excursion_personnel(_personnel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _locked_at timestamptz;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT roster_locked_at INTO _locked_at FROM public.excursions WHERE id = _excursion_id;
  IF _locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Roster is locked' USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM public.excursion_personnel WHERE id = _personnel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_excursion_personnel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_excursion_personnel(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.remove_excursion_personnel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lock_excursion_roster(_excursion_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE public.excursions
     SET roster_locked_at = _now
   WHERE id = _excursion_id
     AND roster_locked_at IS NULL;
  RETURN _now;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_excursion_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_excursion_roster(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lock_excursion_roster(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.unlock_excursion_roster(_excursion_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.excursions SET roster_locked_at = NULL WHERE id = _excursion_id;
$$;

REVOKE ALL ON FUNCTION public.unlock_excursion_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_excursion_roster(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.unlock_excursion_roster(uuid) TO authenticated;

-- Extend get_todays_excursion to surface Coach Mode state. Kiosk
-- (Phase 1) keeps working — it only reads id/date/name/notes/youth_count.
-- Postgres can't change a function's return shape via CREATE OR REPLACE,
-- so we drop and recreate. Re-grant after recreation.
DROP FUNCTION IF EXISTS public.get_todays_excursion();

CREATE FUNCTION public.get_todays_excursion()
RETURNS TABLE (
  id uuid,
  date date,
  name text,
  notes text,
  youth_count integer,
  transportation_required boolean,
  roster_locked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, date, name, notes, youth_count, transportation_required, roster_locked_at
  FROM public.excursions
  WHERE date = (NOW() AT TIME ZONE 'America/New_York')::date
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_todays_excursion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO authenticated;

COMMIT;
