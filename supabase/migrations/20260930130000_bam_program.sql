-- BAM — Body and Mind.
--
-- A behavior incentive program between NLA and Cape May County Special
-- Services: students who go the school week without a disciplinary
-- infraction visit NLA on Friday, for the ten-month school year. A separate
-- program from NLA, like Hawk Squad, in its own tables, built the same way:
-- form fields, registrations, attendance, practice days, weekly moments, the
-- kiosk functions, the going-home guard (unused here: the school moves the
-- students, but the pages share one schema), one-approval-per-student, and
-- the same-year duplicate check. Nothing here touches an NLA table.
--
-- Also: the Youth Served count now spans all three programs, and the Weekly
-- Standout Moments reminder job now serves every program.

BEGIN;

-- ═══════════ Form fields ═══════════
CREATE TABLE IF NOT EXISTS public.bam_form_fields (LIKE public.hawk_squad_form_fields INCLUDING ALL);
ALTER TABLE public.bam_form_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read bam form fields" ON public.bam_form_fields;
CREATE POLICY "Anyone can read bam form fields" ON public.bam_form_fields FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage bam form fields" ON public.bam_form_fields;
CREATE POLICY "Admins manage bam form fields" ON public.bam_form_fields
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_bam_form_fields_updated_at ON public.bam_form_fields;
CREATE TRIGGER update_bam_form_fields_updated_at
  BEFORE UPDATE ON public.bam_form_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed from Hawk Squad's fields: no CTE question, no transportation or
-- dismissal waiver (the school moves the students), grades 5th–12th, and
-- the program's own name in the waiver text. Josh edits the rest in the
-- BAM Form Editor.
INSERT INTO public.bam_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, default_value, section, condition)
SELECT
  replace(field_key, 'hawk_', 'bam_'),
  field_type,
  replace(replace(label, 'Hawk Squad', 'BAM'), 'Cape May Tech', 'Cape May County Special Services'),
  CASE WHEN help_text IS NULL THEN NULL ELSE replace(replace(help_text, 'Hawk Squad', 'BAM'), 'Cape May Tech', 'Cape May County Special Services') END,
  placeholder,
  required,
  CASE WHEN field_key = 'grade_level' THEN '["5th","6th","7th","8th","9th","10th","11th","12th"]'::jsonb ELSE options END,
  sort_order,
  is_active,
  is_core,
  db_column,
  CASE WHEN default_value IS NULL THEN NULL ELSE
    replace(replace(replace(default_value, 'Hawk Squad', 'BAM'), 'Cape May County Technical High School', 'Cape May County Special Services School District'), 'Cape May Tech', 'Cape May County Special Services')
  END,
  section,
  condition
FROM public.hawk_squad_form_fields
WHERE field_key NOT IN ('cte_program', 'hawk_transportation', 'hawk_dismissal')
ON CONFLICT (field_key) DO NOTHING;

-- ═══════════ Registrations ═══════════
CREATE TABLE IF NOT EXISTS public.bam_registrations (LIKE public.hawk_squad_registrations INCLUDING ALL);
ALTER TABLE public.bam_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can submit bam registration" ON public.bam_registrations;
CREATE POLICY "Anyone can submit bam registration" ON public.bam_registrations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins view bam registrations" ON public.bam_registrations;
CREATE POLICY "Admins view bam registrations" ON public.bam_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins update bam registrations" ON public.bam_registrations;
CREATE POLICY "Admins update bam registrations" ON public.bam_registrations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins delete bam registrations" ON public.bam_registrations;
CREATE POLICY "Admins delete bam registrations" ON public.bam_registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_bam_registrations_updated_at ON public.bam_registrations;
CREATE TRIGGER update_bam_registrations_updated_at
  BEFORE UPDATE ON public.bam_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Same-year duplicate check for the form (anon, narrow).
CREATE OR REPLACE FUNCTION public.bam_same_year_matches(_last_name text, _program_year text)
RETURNS TABLE (child_first_name text, child_last_name text, child_date_of_birth date, parent_email text, parent_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.child_first_name, r.child_last_name, r.child_date_of_birth, r.parent_email, r.parent_phone
  FROM public.bam_registrations r
  WHERE r.program_year = _program_year
    AND r.archived_at IS NULL
    AND lower(trim(r.child_last_name)) = lower(trim(_last_name));
$$;
GRANT EXECUTE ON FUNCTION public.bam_same_year_matches(text, text) TO anon, authenticated;

-- One approved registration per student per year.
CREATE OR REPLACE FUNCTION public.bam_one_approved_per_student()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approved_for_attendance IS DISTINCT FROM true THEN RETURN NEW; END IF;
  UPDATE public.bam_registrations o
     SET approved_for_attendance = false, updated_at = now()
   WHERE o.id <> NEW.id
     AND o.approved_for_attendance = true
     AND lower(regexp_replace(o.child_first_name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(NEW.child_first_name, '[^a-zA-Z0-9]', '', 'g'))
     AND lower(regexp_replace(o.child_last_name,  '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(NEW.child_last_name,  '[^a-zA-Z0-9]', '', 'g'))
     AND (
          (o.child_date_of_birth IS NOT NULL AND NEW.child_date_of_birth IS NOT NULL AND o.child_date_of_birth = NEW.child_date_of_birth)
       OR (regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g') <> ''
            AND regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g') = regexp_replace(COALESCE(NEW.parent_phone, ''), '\D', '', 'g'))
       OR (lower(trim(COALESCE(o.parent_email, ''))) <> ''
            AND lower(trim(COALESCE(o.parent_email, ''))) = lower(trim(COALESCE(NEW.parent_email, ''))))
     );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bam_one_approved_per_student ON public.bam_registrations;
CREATE TRIGGER trg_bam_one_approved_per_student
  AFTER INSERT OR UPDATE OF approved_for_attendance ON public.bam_registrations
  FOR EACH ROW WHEN (NEW.approved_for_attendance = true)
  EXECUTE FUNCTION public.bam_one_approved_per_student();

-- ═══════════ Practice days (Fridays unless switched) ═══════════
CREATE TABLE IF NOT EXISTS public.bam_practice_days (LIKE public.hawk_squad_practice_days INCLUDING ALL);
ALTER TABLE public.bam_practice_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage bam practice days" ON public.bam_practice_days;
CREATE POLICY "Admins manage bam practice days" ON public.bam_practice_days
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_bam_practice_days_updated_at ON public.bam_practice_days;
CREATE TRIGGER update_bam_practice_days_updated_at
  BEFORE UPDATE ON public.bam_practice_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ Attendance ═══════════
CREATE TABLE IF NOT EXISTS public.bam_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.bam_registrations(id) ON DELETE CASCADE,
  check_in_at     timestamptz NOT NULL DEFAULT now(),
  check_in_date   date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  going_home      text NOT NULL DEFAULT 'bus' CHECK (going_home IN ('bus', 'dismissed')),
  is_manual       boolean NOT NULL DEFAULT false,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, check_in_date)
);
CREATE INDEX IF NOT EXISTS bam_attendance_date_idx ON public.bam_attendance (check_in_date);
CREATE INDEX IF NOT EXISTS bam_attendance_reg_idx  ON public.bam_attendance (registration_id, check_in_date DESC);
ALTER TABLE public.bam_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kiosk can check in to bam" ON public.bam_attendance;
CREATE POLICY "Kiosk can check in to bam" ON public.bam_attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins view bam attendance" ON public.bam_attendance;
CREATE POLICY "Admins view bam attendance" ON public.bam_attendance FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins update bam attendance" ON public.bam_attendance;
CREATE POLICY "Admins update bam attendance" ON public.bam_attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins delete bam attendance" ON public.bam_attendance;
CREATE POLICY "Admins delete bam attendance" ON public.bam_attendance FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.bam_guard_going_home()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.going_home = 'dismissed' AND NOT EXISTS (
    SELECT 1 FROM public.bam_registrations r WHERE r.id = NEW.registration_id AND r.dismissal_waiver_signed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This student has no dismissal waiver on file — bus only.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_bam_guard_going_home ON public.bam_attendance;
CREATE TRIGGER trg_bam_guard_going_home
  BEFORE INSERT OR UPDATE OF going_home ON public.bam_attendance
  FOR EACH ROW EXECUTE FUNCTION public.bam_guard_going_home();

-- ═══════════ Kiosk functions (anon, narrow) ═══════════
CREATE OR REPLACE FUNCTION public.search_bam_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text, can_be_dismissed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_date_of_birth, r.child_headshot_url,
         (r.dismissal_waiver_signed_at IS NOT NULL) AS can_be_dismissed
  FROM public.bam_registrations r
  WHERE r.approved_for_attendance = true
    AND r.archived_at IS NULL
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
    AND _search IS NOT NULL AND length(trim(_search)) >= 2
    AND (r.child_first_name ILIKE ('%' || trim(_search) || '%') OR r.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY r.child_last_name ASC, r.child_first_name ASC
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.search_bam_youth(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bam_kiosk_roster()
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_headshot_url
  FROM public.bam_registrations r
  WHERE r.approved_for_attendance = true AND r.archived_at IS NULL
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
  ORDER BY r.child_last_name ASC, r.child_first_name ASC;
$$;
GRANT EXECUTE ON FUNCTION public.bam_kiosk_roster() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bam_today_roster()
RETURNS TABLE (registration_id uuid, child_first_name text, child_last_name text, child_headshot_url text, check_in_at timestamptz, going_home text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.registration_id, r.child_first_name, r.child_last_name, r.child_headshot_url, a.check_in_at, a.going_home
  FROM public.bam_attendance a JOIN public.bam_registrations r ON r.id = a.registration_id
  WHERE a.check_in_date = (now() AT TIME ZONE 'America/New_York')::date
  ORDER BY a.check_in_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.bam_today_roster() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.bam_kiosk_undo(_registration_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.bam_attendance
  WHERE registration_id = _registration_id
    AND check_in_date = (now() AT TIME ZONE 'America/New_York')::date
    AND is_manual = false;
$$;
GRANT EXECUTE ON FUNCTION public.bam_kiosk_undo(uuid) TO anon, authenticated;

-- ═══════════ Weekly Standout Moments ═══════════
CREATE TABLE IF NOT EXISTS public.bam_weekly_moments (LIKE public.hawk_squad_weekly_moments INCLUDING ALL);
ALTER TABLE public.bam_weekly_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage bam weekly moments" ON public.bam_weekly_moments;
CREATE POLICY "Admins manage bam weekly moments" ON public.bam_weekly_moments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_bam_weekly_moments_updated_at ON public.bam_weekly_moments;
CREATE TRIGGER update_bam_weekly_moments_updated_at
  BEFORE UPDATE ON public.bam_weekly_moments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════ Youth served, all programs ═══════════
-- NLA, Hawk Squad and BAM, each collapsed to people, then matched across
-- programs by name and (where both know it) birthday. Inclusion–exclusion
-- gives the unduplicated total. Admin only.
CREATE OR REPLACE FUNCTION public.youth_served_all_programs(_from date, _to date)
RETURNS TABLE (nla_youth integer, hawk_youth integer, bam_youth integer, in_both integer, combined integer, in_both_names text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  RETURN QUERY
  WITH nla AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.attendance_records a JOIN public.youth_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  hawk AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.hawk_squad_attendance a JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  bam AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.bam_attendance a JOIN public.bam_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  hawk_in_nla AS (
    SELECT DISTINCT h.person, h.display FROM hawk h
    WHERE EXISTS (SELECT 1 FROM nla n WHERE n.fn = h.fn AND n.ln = h.ln AND (n.dob IS NULL OR h.dob IS NULL OR n.dob = h.dob))
  ),
  bam_in_nla AS (
    SELECT DISTINCT b.person, b.display FROM bam b
    WHERE EXISTS (SELECT 1 FROM nla n WHERE n.fn = b.fn AND n.ln = b.ln AND (n.dob IS NULL OR b.dob IS NULL OR n.dob = b.dob))
  ),
  bam_in_hawk AS (
    SELECT DISTINCT b.person, b.display FROM bam b
    WHERE EXISTS (SELECT 1 FROM hawk h WHERE h.fn = b.fn AND h.ln = b.ln AND (h.dob IS NULL OR b.dob IS NULL OR h.dob = b.dob))
  ),
  bam_in_all AS (
    SELECT DISTINCT b.person FROM bam_in_hawk b WHERE b.person IN (SELECT person FROM bam_in_nla)
  ),
  counts AS (
    SELECT (SELECT count(DISTINCT person) FROM nla)::integer AS n,
           (SELECT count(DISTINCT person) FROM hawk)::integer AS h,
           (SELECT count(DISTINCT person) FROM bam)::integer AS b,
           (SELECT count(DISTINCT person) FROM hawk_in_nla)::integer AS hn,
           (SELECT count(DISTINCT person) FROM bam_in_nla)::integer AS bn,
           (SELECT count(DISTINCT person) FROM bam_in_hawk)::integer AS bh,
           (SELECT count(DISTINCT person) FROM bam_in_all)::integer AS all3,
           (SELECT COALESCE(array_agg(DISTINCT display ORDER BY display), ARRAY[]::text[])
              FROM (SELECT display FROM hawk_in_nla UNION SELECT display FROM bam_in_nla UNION SELECT display FROM bam_in_hawk) x) AS names
  )
  SELECT c.n, c.h, c.b,
         (c.hn + c.bn + c.bh - 2 * c.all3),
         (c.n + c.h + c.b - c.hn - c.bn - c.bh + c.all3),
         c.names
  FROM counts c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.youth_served_all_programs(date, date) TO authenticated;

-- ═══════════ The reminder job serves every program ═══════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hawk-squad-moments-8am-eastern') THEN
    PERFORM cron.unschedule('hawk-squad-moments-8am-eastern');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'program-moments-8am-eastern') THEN
    PERFORM cron.unschedule('program-moments-8am-eastern');
  END IF;
END $$;
SELECT cron.schedule(
  'program-moments-8am-eastern',
  '0 12,13 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/program-moments-reminder',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

COMMIT;
