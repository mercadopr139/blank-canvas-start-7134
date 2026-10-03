-- Juniors Aftercare rides the program framework (the Hawk Squad / BAM screens).
--
-- Its data stays where it has always been — youth_registrations tagged
-- extended_program = 'Smile Lab' and attendance_records stamped
-- program_source = 'Smile Lab'. The framework needs two things the old pages
-- did not have: a practice-days table for the Tuesday schedule overrides, and
-- a today-roster + undo pair for the shared kiosk. (Josh, 2026-10-03.)

-- ── Which Tuesdays Juniors Aftercare runs ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.juniors_aftercare_practice_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL UNIQUE,
  is_practice_day boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.juniors_aftercare_practice_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage juniors practice days" ON public.juniors_aftercare_practice_days;
CREATE POLICY "Admins manage juniors practice days" ON public.juniors_aftercare_practice_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_juniors_aftercare_practice_days_updated_at ON public.juniors_aftercare_practice_days;
CREATE TRIGGER update_juniors_aftercare_practice_days_updated_at
  BEFORE UPDATE ON public.juniors_aftercare_practice_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Kiosk: who is in today ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.juniors_aftercare_today_roster()
RETURNS TABLE (registration_id uuid, child_first_name text, child_last_name text, child_headshot_url text, check_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.registration_id, r.child_first_name, r.child_last_name, r.child_headshot_url, a.check_in_at
  FROM public.attendance_records a
  JOIN public.youth_registrations r ON r.id = a.registration_id
  WHERE a.program_source = 'Smile Lab'
    AND a.check_in_date = (now() AT TIME ZONE 'America/New_York')::date
  ORDER BY a.check_in_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.juniors_aftercare_today_roster() TO anon, authenticated;

-- ── Kiosk: undo a check-in made by mistake at the screen. Today's row only. ──
CREATE OR REPLACE FUNCTION public.juniors_aftercare_kiosk_undo(_registration_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.attendance_records
  WHERE registration_id = _registration_id
    AND program_source = 'Smile Lab'
    AND check_in_date = (now() AT TIME ZONE 'America/New_York')::date
    AND is_manual = false;
$$;
GRANT EXECUTE ON FUNCTION public.juniors_aftercare_kiosk_undo(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
