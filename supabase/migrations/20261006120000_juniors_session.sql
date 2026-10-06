-- Juniors Session: the Tuesday line-up and the setup checklist.
--
-- Junior Boxers practice on Tuesdays. Before they arrive the senior boxers
-- set the building up, and a few of them hold a role for the session -- the
-- blue stools at the doors, and the head coaches of each group. Two halves:
--
--   LINE-UP   Josh or Chrissy fill the roles before practice, from the whole
--             roster (the kids have not signed in yet). Admin-only writes;
--             the gym board reads it through a narrow function.
--   CHECKLIST Categories of tasks, some starred, some with a photo of the
--             proper set-up. Any senior boxer taps a task done on the board,
--             optionally with their name from today's check-ins. Kept per
--             date, so every Tuesday opens clean.
--
-- The board has no login, so like Daily Duties it reads active roles and
-- tasks directly (public SELECT) and writes only through SECURITY DEFINER
-- functions that touch today's rows and nothing else.

BEGIN;

-- ═══════════ Roles ═══════════
CREATE TABLE IF NOT EXISTS public.juniors_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  group_label text NOT NULL DEFAULT 'Coaching',   -- 'Coaching' | 'Blue Stools'
  location    text,                               -- 'Teen Center', 'Performance Center', 'Front door'
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.juniors_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Board reads active juniors roles" ON public.juniors_roles;
CREATE POLICY "Board reads active juniors roles" ON public.juniors_roles FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage juniors roles" ON public.juniors_roles;
CREATE POLICY "Admins manage juniors roles" ON public.juniors_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_juniors_roles_updated_at ON public.juniors_roles;
CREATE TRIGGER update_juniors_roles_updated_at BEFORE UPDATE ON public.juniors_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.juniors_role_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         uuid NOT NULL REFERENCES public.juniors_roles(id) ON DELETE CASCADE,
  session_date    date NOT NULL,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, session_date)
);
CREATE INDEX IF NOT EXISTS juniors_role_assignments_date_idx ON public.juniors_role_assignments (session_date);
ALTER TABLE public.juniors_role_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage juniors line-up" ON public.juniors_role_assignments;
CREATE POLICY "Admins manage juniors line-up" ON public.juniors_role_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- The board reads the line-up for a date: role + the youth's name and photo.
CREATE OR REPLACE FUNCTION public.get_juniors_lineup(_date date)
RETURNS TABLE (role_id uuid, registration_id uuid, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.role_id, a.registration_id, r.child_first_name, r.child_last_name, r.child_headshot_url
  FROM public.juniors_role_assignments a
  JOIN public.youth_registrations r ON r.id = a.registration_id
  WHERE a.session_date = _date;
$$;
GRANT EXECUTE ON FUNCTION public.get_juniors_lineup(date) TO anon, authenticated;

-- ═══════════ Checklist ═══════════
CREATE TABLE IF NOT EXISTS public.juniors_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  photo_url  text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.juniors_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Board reads active juniors categories" ON public.juniors_categories;
CREATE POLICY "Board reads active juniors categories" ON public.juniors_categories FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage juniors categories" ON public.juniors_categories;
CREATE POLICY "Admins manage juniors categories" ON public.juniors_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_juniors_categories_updated_at ON public.juniors_categories;
CREATE TRIGGER update_juniors_categories_updated_at BEFORE UPDATE ON public.juniors_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.juniors_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.juniors_categories(id) ON DELETE CASCADE,
  title       text NOT NULL,
  details     text,
  photo_url   text,
  starred     boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.juniors_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Board reads active juniors tasks" ON public.juniors_tasks;
CREATE POLICY "Board reads active juniors tasks" ON public.juniors_tasks FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage juniors tasks" ON public.juniors_tasks;
CREATE POLICY "Admins manage juniors tasks" ON public.juniors_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_juniors_tasks_updated_at ON public.juniors_tasks;
CREATE TRIGGER update_juniors_tasks_updated_at BEFORE UPDATE ON public.juniors_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.juniors_task_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES public.juniors_tasks(id) ON DELETE CASCADE,
  session_date    date NOT NULL,
  registration_id uuid REFERENCES public.youth_registrations(id) ON DELETE SET NULL,
  done_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, session_date)
);
CREATE INDEX IF NOT EXISTS juniors_task_completions_date_idx ON public.juniors_task_completions (session_date);
ALTER TABLE public.juniors_task_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage juniors completions" ON public.juniors_task_completions;
CREATE POLICY "Admins manage juniors completions" ON public.juniors_task_completions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Today in New Jersey, the only day the board may write.
CREATE OR REPLACE FUNCTION public.juniors_today()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'America/New_York')::date $$;

CREATE OR REPLACE FUNCTION public.get_juniors_completions(_date date)
RETURNS TABLE (task_id uuid, done_at timestamptz, child_first_name text, child_last_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.task_id, c.done_at, r.child_first_name, r.child_last_name
  FROM public.juniors_task_completions c
  LEFT JOIN public.youth_registrations r ON r.id = c.registration_id
  WHERE c.session_date = _date;
$$;
GRANT EXECUTE ON FUNCTION public.get_juniors_completions(date) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.juniors_check_task(_task_id uuid, _registration_id uuid DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.juniors_task_completions (task_id, session_date, registration_id)
  SELECT _task_id, public.juniors_today(), _registration_id
  WHERE EXISTS (SELECT 1 FROM public.juniors_tasks t WHERE t.id = _task_id AND t.is_active)
  ON CONFLICT (task_id, session_date) DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION public.juniors_check_task(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.juniors_uncheck_task(_task_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.juniors_task_completions WHERE task_id = _task_id AND session_date = public.juniors_today();
$$;
GRANT EXECUTE ON FUNCTION public.juniors_uncheck_task(uuid) TO anon, authenticated;

-- ═══════════ Seed: the roles and Josh's checklist ═══════════
INSERT INTO public.juniors_roles (title, group_label, location, sort_order)
SELECT * FROM (VALUES
  ('Junior Boxing Head Coach',   'Coaching',    NULL,                 10),
  ('Non-Battle Team Head Coach', 'Coaching',    NULL,                 20),
  ('Littles Head Coach',         'Coaching',    NULL,                 30),
  ('Front Door Blue Stool',      'Blue Stools', 'Front door',         40),
  ('Blue Stool #2',              'Blue Stools', 'Teen Center',        50),
  ('Blue Stool #3',              'Blue Stools', 'Teen Center',        60),
  ('Blue Stool #4',              'Blue Stools', 'Performance Center', 70),
  ('Blue Stool #5',              'Blue Stools', 'Performance Center', 80)
) AS v(title, group_label, location, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.juniors_roles);

DO $$
DECLARE setup uuid; security uuid; coaches uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.juniors_categories) THEN RETURN; END IF;
  INSERT INTO public.juniors_categories (title, sort_order) VALUES ('Setup', 10) RETURNING id INTO setup;
  INSERT INTO public.juniors_categories (title, sort_order) VALUES ('Security', 20) RETURNING id INTO security;
  INSERT INTO public.juniors_categories (title, sort_order) VALUES ('Coaches', 30) RETURNING id INTO coaches;
  INSERT INTO public.juniors_tasks (category_id, title, starred, sort_order) VALUES
    (setup, 'Place 1 blue stool at the entrance, next to the front desk, with radio', true, 10),
    (setup, 'Place 1 blue stool at each entry/exit of the Smile Lab / Teen Center (2 total)', true, 20),
    (setup, 'Set up retractable yellow barricades on the basketball court at half court', false, 30),
    (setup, 'Close cardio equipment with steel barricades', false, 40),
    (setup, 'Block off cardio corner with yellow barricades', false, 50),
    (setup, 'Steel barricades already set up around treadmills', false, 60),
    (setup, 'Pull out the red bench', false, 70),
    (setup, 'Drop the bleachers off the rubber', false, 80),
    (setup, 'Pull down all green gloves and line them along the wall in the NLAPC', false, 90),
    (setup, 'Pull yellow bins out from under the steps and place behind the couch', false, 100),
    (setup, 'Pinnies under net on the left side', false, 110),
    (setup, 'Lower basketball rim', false, 120),
    (setup, 'Make sure left-side basketball rack is locked', true, 130),
    (setup, 'Radios behind front desk', false, 140),
    (security, 'Place NO JUNIOR BOXER sign in A-frame', true, 10),
    (security, 'Close door if security — one person in / one person out for bathrooms', true, 20),
    (coaches, 'Tell Coach Mercado/Chrissy to set up the entry camera', true, 10),
    (coaches, 'Set DDs to Juniors', false, 20);
END $$;

COMMIT;
