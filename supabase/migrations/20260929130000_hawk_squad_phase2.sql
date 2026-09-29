-- Hawk Squad, phase 2: check-in and attendance.
--
-- Own tables again (see 20260929120000): nothing NLA reads touches these.
-- The kiosk at /check-in/hawk-squad is a screen with no login, so like the
-- NLA and Smile Lab kiosks it works through narrow SECURITY DEFINER functions
-- that hand back only what a kid at the screen needs -- approved, current-year
-- students to pick from, and today's roster -- and an insert-only policy for
-- the check-in itself. It can never read a registration.
--
-- GOING HOME. Hawk Squad students either ride the bus back to Cape May Tech
-- or are dismissed straight from NLA, and it varies by day. Every check-in
-- carries going_home, 'bus' by default; the coach flips it to 'dismissed' on
-- the attendance board. The board only offers 'dismissed' when the parent has
-- signed the optional dismissal waiver (hawk_squad_registrations.
-- dismissal_waiver_signed_at), and the constraint below is the last line: a
-- row cannot say 'dismissed' for a student without that waiver on file.

BEGIN;

-- ── Which days Hawk Squad runs ──────────────────────────────────────────
-- Tuesday and Thursday unless a row here says otherwise. A row is an
-- override in either direction: a Thursday that is off, a Wednesday that is on.
CREATE TABLE IF NOT EXISTS public.hawk_squad_practice_days (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL UNIQUE,
  is_practice_day boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hawk_squad_practice_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage hawk practice days" ON public.hawk_squad_practice_days;
CREATE POLICY "Admins manage hawk practice days" ON public.hawk_squad_practice_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_hawk_squad_practice_days_updated_at ON public.hawk_squad_practice_days;
CREATE TRIGGER update_hawk_squad_practice_days_updated_at
  BEFORE UPDATE ON public.hawk_squad_practice_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Check-ins ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hawk_squad_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.hawk_squad_registrations(id) ON DELETE CASCADE,
  check_in_at     timestamptz NOT NULL DEFAULT now(),
  check_in_date   date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  going_home      text NOT NULL DEFAULT 'bus' CHECK (going_home IN ('bus', 'dismissed')),
  is_manual       boolean NOT NULL DEFAULT false,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, check_in_date)
);
CREATE INDEX IF NOT EXISTS hawk_squad_attendance_date_idx ON public.hawk_squad_attendance (check_in_date);
CREATE INDEX IF NOT EXISTS hawk_squad_attendance_reg_idx  ON public.hawk_squad_attendance (registration_id, check_in_date DESC);

ALTER TABLE public.hawk_squad_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kiosk can check in to hawk squad" ON public.hawk_squad_attendance;
CREATE POLICY "Kiosk can check in to hawk squad" ON public.hawk_squad_attendance
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins view hawk attendance" ON public.hawk_squad_attendance;
CREATE POLICY "Admins view hawk attendance" ON public.hawk_squad_attendance
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins update hawk attendance" ON public.hawk_squad_attendance;
CREATE POLICY "Admins update hawk attendance" ON public.hawk_squad_attendance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins delete hawk attendance" ON public.hawk_squad_attendance;
CREATE POLICY "Admins delete hawk attendance" ON public.hawk_squad_attendance
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 'dismissed' needs the waiver. The board greys the option out; this makes
-- it impossible from anywhere.
CREATE OR REPLACE FUNCTION public.hawk_squad_guard_going_home()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.going_home = 'dismissed' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.hawk_squad_registrations r
      WHERE r.id = NEW.registration_id AND r.dismissal_waiver_signed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'This student has no dismissal waiver on file — bus only.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_hawk_squad_guard_going_home ON public.hawk_squad_attendance;
CREATE TRIGGER trg_hawk_squad_guard_going_home
  BEFORE INSERT OR UPDATE OF going_home ON public.hawk_squad_attendance
  FOR EACH ROW EXECUTE FUNCTION public.hawk_squad_guard_going_home();

-- ── What the kiosk may see ──────────────────────────────────────────────
-- Search: approved, current program year, not archived. Same year gate as the
-- NLA kiosk, so a last-year student who has not re-registered is not offered.
CREATE OR REPLACE FUNCTION public.search_hawk_squad_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text, can_be_dismissed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_date_of_birth, r.child_headshot_url,
         (r.dismissal_waiver_signed_at IS NOT NULL) AS can_be_dismissed
  FROM public.hawk_squad_registrations r
  WHERE r.approved_for_attendance = true
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (r.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR r.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY r.child_last_name ASC, r.child_first_name ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_hawk_squad_youth(text) TO anon, authenticated;

-- Browse by photo: every approved current-year student, for the roster grid.
CREATE OR REPLACE FUNCTION public.hawk_squad_kiosk_roster()
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_headshot_url
  FROM public.hawk_squad_registrations r
  WHERE r.approved_for_attendance = true
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
  ORDER BY r.child_last_name ASC, r.child_first_name ASC;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_kiosk_roster() TO anon, authenticated;

-- Today, for the kiosk: who is in, and the count. Today only, ever.
CREATE OR REPLACE FUNCTION public.hawk_squad_today_roster()
RETURNS TABLE (registration_id uuid, child_first_name text, child_last_name text, child_headshot_url text, check_in_at timestamptz, going_home text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.registration_id, r.child_first_name, r.child_last_name, r.child_headshot_url, a.check_in_at, a.going_home
  FROM public.hawk_squad_attendance a
  JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
  WHERE a.check_in_date = (now() AT TIME ZONE 'America/New_York')::date
  ORDER BY a.check_in_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_today_roster() TO anon, authenticated;

-- Undo a check-in made by mistake at the screen. Today's row only.
CREATE OR REPLACE FUNCTION public.hawk_squad_kiosk_undo(_registration_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.hawk_squad_attendance
  WHERE registration_id = _registration_id
    AND check_in_date = (now() AT TIME ZONE 'America/New_York')::date
    AND is_manual = false;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_kiosk_undo(uuid) TO anon, authenticated;

COMMIT;
