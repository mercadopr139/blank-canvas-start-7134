-- ═══════════════════════════════════════════════════════════════════
-- Excursion Check-In: Phase 3 (in-trip checkpoints)
-- ═══════════════════════════════════════════════════════════════════
-- After the roster is locked (Phase 2), Coach Chrissy stamps two
-- checkpoints during the trip:
--   1. Arrival at the destination — confirms the headcount matches
--      what was locked. Stamps `arrived_at`. Optional note if the
--      count was off.
--   2. Return / Close — same headcount confirmation back at the gym.
--      Stamps `returned_at` and effectively "closes" the trip.
--
-- These timestamps live on the excursions row forever (no separate
-- log table) so they show up in attendance analytics. Admins (and
-- Chrissy via Coach Mode pencil edits) can manually adjust the
-- timestamps for the case where someone forgot to tap a button.

BEGIN;

-- 1) Trip-lifecycle columns on the excursion row
ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_note text,
  ADD COLUMN IF NOT EXISTS return_note text;

-- 2) Re-extend get_todays_excursion to surface the new fields.
--    Postgres can't change a function's return shape via CREATE OR
--    REPLACE, so we drop and recreate.
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
  return_note text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, date, name, notes, youth_count, transportation_required,
         roster_locked_at, arrived_at, returned_at, arrival_note, return_note
  FROM public.excursions
  WHERE date = (NOW() AT TIME ZONE 'America/New_York')::date
  ORDER BY created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_todays_excursion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO anon;
GRANT EXECUTE ON FUNCTION public.get_todays_excursion() TO authenticated;

-- 3) Confirm arrival — stamps arrived_at = NOW(). Optional note saved
--    if Chrissy reported the headcount was off.
CREATE OR REPLACE FUNCTION public.confirm_excursion_arrival(
  _excursion_id uuid,
  _note text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE public.excursions
     SET arrived_at = _now,
         arrival_note = NULLIF(trim(coalesce(_note, '')), '')
   WHERE id = _excursion_id;
  RETURN _now;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_excursion_arrival(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_excursion_arrival(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_excursion_arrival(uuid, text) TO authenticated;

-- 4) Confirm return — stamps returned_at = NOW(). Trip is "closed".
CREATE OR REPLACE FUNCTION public.confirm_excursion_return(
  _excursion_id uuid,
  _note text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
BEGIN
  UPDATE public.excursions
     SET returned_at = _now,
         return_note = NULLIF(trim(coalesce(_note, '')), '')
   WHERE id = _excursion_id;
  RETURN _now;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_excursion_return(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_excursion_return(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_excursion_return(uuid, text) TO authenticated;

-- 5) Manual timestamp setters — used by Coach Mode pencil edit so
--    Chrissy can correct a forgot-to-tap timestamp. Pass NULL to clear.
CREATE OR REPLACE FUNCTION public.set_excursion_arrived_at(
  _excursion_id uuid,
  _arrived_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.excursions SET arrived_at = _arrived_at WHERE id = _excursion_id;
$$;

REVOKE ALL ON FUNCTION public.set_excursion_arrived_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_arrived_at(uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_arrived_at(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_excursion_returned_at(
  _excursion_id uuid,
  _returned_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.excursions SET returned_at = _returned_at WHERE id = _excursion_id;
$$;

REVOKE ALL ON FUNCTION public.set_excursion_returned_at(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_excursion_returned_at(uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.set_excursion_returned_at(uuid, timestamptz) TO authenticated;

COMMIT;
