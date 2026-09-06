-- ═══════════════════════════════════════════════════════════════════
-- Daily Duties — the youth-run facility clean-up board
-- ═══════════════════════════════════════════════════════════════════
-- The program is free; the youth keep the facility clean in return. After
-- practice they gather at the Gym Board, open "Daily Duties", and assign
-- tonight's jobs among whoever checked in that night.
--
-- Two tables:
--   duty_jobs         the MASTER list (the spreadsheet), edited in admin.
--   duty_assignments  who did what, on what night. Auto-clears by date
--                     (each day only ever shows its own rows) but every row
--                     is kept forever, so a funder report can say
--                     "Denum: Bathrooms x8, Floors x5 this week."
--
-- Anyone at the board can assign anyone (the crew is trusted), and a job
-- takes as many youth as needed — 1, 2, or 3+. The name search only finds
-- youth who CHECKED IN tonight, so duties track real attendance.

-- ── 1. The master job list ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.duty_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone       text NOT NULL,                 -- Boxing Gym / Performance Center / ...
  label      text NOT NULL,                 -- the task, as it reads on the board
  category   text NOT NULL DEFAULT 'Other', -- report bucket: Floors / Equipment / Bathrooms / Reset
  sort_order smallint NOT NULL DEFAULT 0,   -- order down the board
  is_active  boolean NOT NULL DEFAULT true, -- retire a job without deleting its history
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Who is on each job, each night ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.duty_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES public.duty_jobs(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  duty_date       date NOT NULL,            -- NLA local date; "today" clears the board
  assigned_by     text,                     -- optional, unused for now
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, registration_id, duty_date)   -- same kid can't be double-added to one job
);

CREATE INDEX IF NOT EXISTS duty_assignments_date_idx ON public.duty_assignments (duty_date);
CREATE INDEX IF NOT EXISTS duty_assignments_reg_idx  ON public.duty_assignments (registration_id);

-- ── 3. Row-level security ────────────────────────────────────────────
ALTER TABLE public.duty_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;

-- The board (a TV with no login) reads the active job list directly — it
-- holds no personal data, just task names.
DROP POLICY IF EXISTS "Board reads active jobs" ON public.duty_jobs;
CREATE POLICY "Board reads active jobs"
  ON public.duty_jobs FOR SELECT
  TO anon, authenticated
  USING (is_active);

DROP POLICY IF EXISTS "Admins manage duty jobs" ON public.duty_jobs;
CREATE POLICY "Admins manage duty jobs"
  ON public.duty_jobs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Assignments are never read directly by the board (it uses the RPC below,
-- which joins names safely). Admins can read/manage everything for reports.
DROP POLICY IF EXISTS "Admins manage duty assignments" ON public.duty_assignments;
CREATE POLICY "Admins manage duty assignments"
  ON public.duty_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── 4. Search only tonight's checked-in youth ────────────────────────
-- Mirrors search_kiosk_youth, but limited to youth who have an NLA
-- attendance row for today. So you can only assign kids who are present.
CREATE OR REPLACE FUNCTION public.search_checked_in_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_boxing_program public.boxing_program, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT yr.id, yr.child_first_name, yr.child_last_name, yr.child_boxing_program, yr.child_headshot_url
  FROM public.youth_registrations yr
  JOIN public.attendance_records ar ON ar.registration_id = yr.id
  WHERE ar.check_in_date = (now() AT TIME ZONE 'America/New_York')::date
    AND ar.program_source = 'NLA'
    AND yr.approved_for_attendance = true
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (yr.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR yr.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 30;
$$;
GRANT EXECUTE ON FUNCTION public.search_checked_in_youth(text) TO anon, authenticated;

-- ── 5. Tonight's board: every assignment for today, with names + photos ─
CREATE OR REPLACE FUNCTION public.get_todays_duty_assignments()
RETURNS TABLE (job_id uuid, registration_id uuid, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT da.job_id, da.registration_id, yr.child_first_name, yr.child_last_name, yr.child_headshot_url
  FROM public.duty_assignments da
  JOIN public.youth_registrations yr ON yr.id = da.registration_id
  WHERE da.duty_date = (now() AT TIME ZONE 'America/New_York')::date
  ORDER BY yr.child_first_name ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_todays_duty_assignments() TO anon, authenticated;

-- ── 6. Assign / unassign for tonight ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_duty(_job_id uuid, _registration_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.duty_assignments (job_id, registration_id, duty_date)
  VALUES (_job_id, _registration_id, (now() AT TIME ZONE 'America/New_York')::date)
  ON CONFLICT (job_id, registration_id, duty_date) DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION public.assign_duty(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unassign_duty(_job_id uuid, _registration_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.duty_assignments
  WHERE job_id = _job_id
    AND registration_id = _registration_id
    AND duty_date = (now() AT TIME ZONE 'America/New_York')::date;
$$;
GRANT EXECUTE ON FUNCTION public.unassign_duty(uuid, uuid) TO anon, authenticated;

-- ── 7. Seed the master list from the current daily-duties sheet ───────
INSERT INTO public.duty_jobs (zone, label, category, sort_order) VALUES
  ('Boxing Gym',          'Sweep Boxing Facility',                                       'Floors',    10),
  ('Boxing Gym',          'Mop Boxing Facility',                                         'Floors',    20),
  ('Boxing Gym',          'Spray / Wipe Bags',                                           'Equipment', 30),
  ('Boxing Gym',          'Clean Mirrors (Windex)',                                      'Reset',     40),
  ('Boxing Gym',          'Vacuum Ring & Turf',                                          'Equipment', 50),
  ('Boxing Gym',          'Wipe Benches & Organize Plates, Dumbbells, Accessories',      'Equipment', 60),
  ('Performance Center',  'Wall Mats — Wipe',                                            'Equipment', 70),
  ('Performance Center',  'Sweep Bag Side',                                              'Floors',    80),
  ('Performance Center',  'Sweep Turf Side',                                             'Floors',    90),
  ('Performance Center',  'Mop Bag Side',                                                'Floors',   100),
  ('Performance Center',  'Mop Turf Side',                                               'Floors',   110),
  ('Performance Center',  'Vacuum Turf & Boxing Ring',                                   'Equipment',120),
  ('Bathrooms',           'Bathrooms (Boys) — Spray/Rinse, Mirrors, Trash, Mop',         'Bathrooms',130),
  ('Bathrooms',           'Bathrooms (Girls) — Spray/Rinse, Mirrors, Trash, Mop',        'Bathrooms',140),
  ('Teen Center',         'Sweep & Mop',                                                 'Floors',   150),
  ('Entire Gym',          'Change All Blue Trashcans',                                   'Reset',    160),
  ('Entire Gym',          'Spray All Gloves & Hand Wraps',                               'Equipment',170),
  ('Entire Gym',          'Organize / Restock All Cleaning Supplies',                    'Reset',    180)
ON CONFLICT DO NOTHING;
