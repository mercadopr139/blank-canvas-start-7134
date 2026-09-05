-- Practice Plan — the gym board and the weekly plan behind it.
--
-- Replaces an abandoned first attempt that modelled one timeline per night.
-- The academy trains three groups at once, and the week is a standing pattern,
-- so there are two layers:
--
--   TEMPLATE  what KIND of session each group does each day. Set once a season.
--   WEEK      what we are ACTUALLY doing — the drills. Written every Monday.
--
-- Keeping them apart is the design: editing next week never touches the
-- template, and changing the template never rewrites a week already written.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md

-- ── Types ────────────────────────────────────────────────────────────
-- Battle Team / Non-Battle Team / Littles are loose labels used to split the
-- room during practice. Nothing assigns a child to one — they are the board's
-- three columns and nothing more, so this is an enum, not a table.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'practice_group') THEN
    CREATE TYPE public.practice_group AS ENUM (
      'battle_team',
      'non_battle_team',
      'littles'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'practice_week_status') THEN
    CREATE TYPE public.practice_week_status AS ENUM ('draft', 'published');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'practice_season') THEN
    CREATE TYPE public.practice_season AS ENUM ('in_season', 'off_season');
  END IF;
END $$;

-- ── Settings (single row) ────────────────────────────────────────────
-- Season decides the length of the week: Mon-Fri in season, Mon-Thu off. It
-- does not delete Friday's template rows, it just makes them dormant.
CREATE TABLE IF NOT EXISTS public.practice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  season public.practice_season NOT NULL DEFAULT 'in_season',
  -- Practice starts at 5:15. It will not be 5:15 forever.
  start_time time NOT NULL DEFAULT '17:15',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.practice_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ── Template ─────────────────────────────────────────────────────────
-- weekday: 1 = Monday … 5 = Friday.
CREATE TABLE IF NOT EXISTS public.practice_template_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group" public.practice_group NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  position smallint NOT NULL DEFAULT 0,
  category text NOT NULL,
  UNIQUE ("group", weekday, position)
);

-- Spiritual Development runs across all three groups and carries no weekly
-- detail — the pastors run their own lessons. The board only announces it.
CREATE TABLE IF NOT EXISTS public.practice_spiritual_template (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
  label text NOT NULL,
  leader text
);

-- ── The week ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.practice_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,          -- always a Monday
  status public.practice_week_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- `category` is snapshotted from the template rather than referenced, so that
-- changing the template next season never rewrites what a past week says was
-- trained.
CREATE TABLE IF NOT EXISTS public.practice_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.practice_weeks(id) ON DELETE CASCADE,
  "group" public.practice_group NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  position smallint NOT NULL DEFAULT 0,
  category text NOT NULL,
  detail text,
  UNIQUE (week_id, "group", weekday, position)
);
CREATE INDEX IF NOT EXISTS practice_blocks_week_idx ON public.practice_blocks (week_id, weekday);

-- The five-minute meeting that opens every practice. Per day, not per group —
-- the whole academy is in the room.
CREATE TABLE IF NOT EXISTS public.practice_meeting_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.practice_weeks(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  points jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (week_id, weekday)
);

-- ── Drill library ────────────────────────────────────────────────────
-- Builds itself out of what Josh types. No setup, no maintenance — it just
-- gets faster the more the tool is used.
CREATE TABLE IF NOT EXISTS public.practice_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detail text NOT NULL UNIQUE,
  category text,
  times_used integer NOT NULL DEFAULT 1,
  last_used timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS practice_drills_recent_idx
  ON public.practice_drills (times_used DESC, last_used DESC);

-- ── updated_at ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_practice_weeks_updated ON public.practice_weeks;
CREATE TRIGGER trg_practice_weeks_updated
  BEFORE UPDATE ON public.practice_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_practice_settings_updated ON public.practice_settings;
CREATE TRIGGER trg_practice_settings_updated
  BEFORE UPDATE ON public.practice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────────────
-- The gym board is a TV in the room with no login, so it reads anonymously.
-- It only ever shows drills and meeting points — never a child's name — and
-- only from a PUBLISHED week, so a half-written plan never reaches the wall.
ALTER TABLE public.practice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_template_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_spiritual_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_meeting_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_drills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Board reads settings" ON public.practice_settings;
CREATE POLICY "Board reads settings" ON public.practice_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Board reads spiritual track" ON public.practice_spiritual_template;
CREATE POLICY "Board reads spiritual track" ON public.practice_spiritual_template
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Board reads published weeks" ON public.practice_weeks;
CREATE POLICY "Board reads published weeks" ON public.practice_weeks
  FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "Board reads published blocks" ON public.practice_blocks;
CREATE POLICY "Board reads published blocks" ON public.practice_blocks
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.practice_weeks w
      WHERE w.id = week_id AND w.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Board reads published meeting points" ON public.practice_meeting_points;
CREATE POLICY "Board reads published meeting points" ON public.practice_meeting_points
  FOR SELECT TO anon, authenticated USING (
    EXISTS (
      SELECT 1 FROM public.practice_weeks w
      WHERE w.id = week_id AND w.status = 'published'
    )
  );

-- Admins manage everything, including drafts.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'practice_settings', 'practice_template_blocks', 'practice_spiritual_template',
    'practice_weeks', 'practice_blocks', 'practice_meeting_points', 'practice_drills'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Admins manage %1$s" ON public.%1$I FOR ALL TO authenticated
         USING (public.has_role(auth.uid(), ''admin''::public.app_role))
         WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t);
  END LOOP;
END $$;

-- ── Seed the template from Josh's whiteboard ─────────────────────────
INSERT INTO public.practice_template_blocks ("group", weekday, position, category) VALUES
  -- Battle Team — boxing, preparing for competition
  ('battle_team', 1, 0, 'Weights'),
  ('battle_team', 1, 1, 'Boxing Circuit'),
  ('battle_team', 2, 0, 'Coaching Juniors'),
  ('battle_team', 2, 1, 'Boxing Bootcamp'),
  ('battle_team', 3, 0, 'Weights'),
  ('battle_team', 3, 1, 'Sparring and/or Run'),
  ('battle_team', 4, 0, 'Boxing Circuit'),
  ('battle_team', 5, 0, 'Weights'),
  ('battle_team', 5, 1, 'Sparring and/or Run'),
  ('battle_team', 5, 2, 'Fun Friday'),
  -- Non-Battle Team — Boxing 101, competing other ways (5K, obstacles, CrossFit)
  ('non_battle_team', 1, 0, 'Boxing'),
  ('non_battle_team', 1, 1, 'Weights'),
  ('non_battle_team', 2, 0, 'Weights'),
  ('non_battle_team', 2, 1, 'Boxing'),
  ('non_battle_team', 3, 0, 'Boxing'),
  ('non_battle_team', 4, 0, 'Instructional Sparring'),
  ('non_battle_team', 4, 1, 'Weights'),
  ('non_battle_team', 5, 0, 'Fun Friday (Sparring)'),
  -- Littles — Boxing 101 and soccer
  ('littles', 1, 0, 'Boxing'),
  ('littles', 1, 1, 'Soccer'),
  ('littles', 2, 0, 'Strength'),
  ('littles', 2, 1, 'Smile Lab'),
  ('littles', 3, 0, 'Boxing'),
  ('littles', 3, 1, 'Soccer'),
  ('littles', 4, 0, 'Boxing'),
  ('littles', 4, 1, 'Soccer'),
  ('littles', 5, 0, 'Fun Friday'),
  ('littles', 5, 1, 'Sparring')
ON CONFLICT ("group", weekday, position) DO NOTHING;

INSERT INTO public.practice_spiritual_template (weekday, label, leader) VALUES
  (1, 'Chew on this…', 'Rev'),
  (2, 'Smile Lab', NULL),
  (3, 'Chew on this…', 'Pastor Harris'),
  (4, 'Bible Study — boys and girls separately', NULL),
  (5, 'Chew on this…', 'Pastor Harris')
ON CONFLICT (weekday) DO NOTHING;
