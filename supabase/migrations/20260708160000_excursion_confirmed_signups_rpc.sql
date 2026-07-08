-- ═══════════════════════════════════════════════════════════════════
-- Expose the CONFIRMED sign-up list to Coach Mode (anon kiosk)
-- ═══════════════════════════════════════════════════════════════════
-- The sign-ups board (admin) marks youth Confirmed before trip day. On
-- trip day, Coach Mode runs anonymously on the iPad, so it can't read the
-- admin-only excursion_signups table directly. This SECURITY DEFINER RPC
-- surfaces just the confirmed youth (name + photo) so Coach Mode can show
-- an "Expected Today" roster: who's checked in vs still expected, and flag
-- anyone who checks in who wasn't on the confirmed list.
--
-- Read-only. It never blocks a check-in — the kiosk stays open to walk-ups.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_excursion_confirmed_signups(_excursion_id uuid)
RETURNS TABLE (
  registration_id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text
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
    yr.child_headshot_url
  FROM public.excursion_signups es
  JOIN public.youth_registrations yr ON yr.id = es.registration_id
  WHERE es.excursion_id = _excursion_id
    AND es.status = 'confirmed'
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_excursion_confirmed_signups(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_excursion_confirmed_signups(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_excursion_confirmed_signups(uuid) TO authenticated;

COMMIT;
