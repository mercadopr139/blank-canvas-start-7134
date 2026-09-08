-- 75 Hard — 75 consecutive days, two sessions a day, no rest days.
--
-- The program's whole meaning is that missing one thing sends you back to Day 1,
-- so this schema keeps failed attempts rather than deleting them: on day 62 of a
-- second attempt, the record of getting to day 41 the first time is the point.
--
-- Plan: docs/HARD75_PLAN.md

-- ── A run: one person's attempt at the 75 ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hard75_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who is doing it. Not a youth_registration: the first participant is a
  -- 45-year-old fireman, and the program is written for adults.
  participant    text NOT NULL,
  age            integer CHECK (age IS NULL OR (age > 0 AND age < 120)),
  -- Anything the workouts must respect — a bad shoulder, a knee.
  limitations    text,
  goal           text,
  start_date     date NOT NULL,
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'failed', 'complete')),
  -- Set when a missed day ends the attempt: which day it died on, and why.
  failed_on_day  integer,
  failed_reason  text,
  -- The attempt this one restarted from, so the history chains backwards.
  restarted_from uuid REFERENCES public.hard75_runs(id) ON DELETE SET NULL,
  -- Owner. Photos and rows are visible to this user and the super-admin only.
  owner_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hard75_runs_owner_idx ON public.hard75_runs (owner_id);
CREATE INDEX IF NOT EXISTS hard75_runs_status_idx ON public.hard75_runs (status);

-- ── The 75 days ──────────────────────────────────────────────────────────
-- Written in full when a run starts, so the whole calendar exists on day one.
-- Seeing day 40 on day 1 is most of the motivation.
CREATE TABLE IF NOT EXISTS public.hard75_days (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES public.hard75_runs(id) ON DELETE CASCADE,
  day_number    integer NOT NULL CHECK (day_number BETWEEN 1 AND 75),
  date          date NOT NULL,

  -- The two sessions. jsonb because a workout is a shape, not a table:
  -- { title, focus, blocks: [{ name, detail, sub }], notes }
  strength      jsonb NOT NULL DEFAULT '{}'::jsonb,
  cardio        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The checklist. All six have to be true for the day to count.
  strength_done boolean NOT NULL DEFAULT false,
  cardio_done   boolean NOT NULL DEFAULT false,
  outdoor_done  boolean NOT NULL DEFAULT false,
  water_done    boolean NOT NULL DEFAULT false,
  reading_done  boolean NOT NULL DEFAULT false,
  diet_done     boolean NOT NULL DEFAULT false,

  -- Storage path inside the private hard75-photos bucket.
  photo_path    text,
  notes         text,
  completed_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (run_id, day_number)
);

CREATE INDEX IF NOT EXISTS hard75_days_run_idx ON public.hard75_days (run_id, day_number);
CREATE INDEX IF NOT EXISTS hard75_days_date_idx ON public.hard75_days (run_id, date);

-- ── updated_at ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS hard75_runs_updated_at ON public.hard75_runs;
CREATE TRIGGER hard75_runs_updated_at
  BEFORE UPDATE ON public.hard75_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS hard75_days_updated_at ON public.hard75_days;
CREATE TRIGGER hard75_days_updated_at
  BEFORE UPDATE ON public.hard75_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Who may see a run ────────────────────────────────────────────────────
-- The participant who owns it, or the super-admin. NOT every admin: the days
-- carry progress photos of a man's body, and "any coach with a checkbox" is the
-- wrong audience for that.
CREATE OR REPLACE FUNCTION public.can_see_hard75_run(run uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hard75_runs r
    WHERE r.id = run
      AND (
        r.owner_id = auth.uid()
        OR (auth.jwt() ->> 'email') = 'joshmercado@nolimitsboxingacademy.org'
      )
  );
$$;

ALTER TABLE public.hard75_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hard75_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own or super-admin runs" ON public.hard75_runs;
CREATE POLICY "Own or super-admin runs" ON public.hard75_runs
  FOR ALL TO authenticated
  USING (
    owner_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'joshmercado@nolimitsboxingacademy.org'
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (auth.jwt() ->> 'email') = 'joshmercado@nolimitsboxingacademy.org'
  );

DROP POLICY IF EXISTS "Own or super-admin days" ON public.hard75_days;
CREATE POLICY "Own or super-admin days" ON public.hard75_days
  FOR ALL TO authenticated
  USING (public.can_see_hard75_run(run_id))
  WITH CHECK (public.can_see_hard75_run(run_id));

-- ── Progress photos ──────────────────────────────────────────────────────
-- PRIVATE bucket, unlike site-images. These are shirtless body photos taken
-- every day for 75 days; they are served through signed URLs and never sit on a
-- public path. Objects are keyed <run_id>/<day>.<ext>, so the first path
-- segment decides who may touch them.
INSERT INTO storage.buckets (id, name, public)
VALUES ('hard75-photos', 'hard75-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "hard75_photos_read" ON storage.objects;
CREATE POLICY "hard75_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'hard75-photos'
    AND public.can_see_hard75_run(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "hard75_photos_insert" ON storage.objects;
CREATE POLICY "hard75_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'hard75-photos'
    AND public.can_see_hard75_run(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "hard75_photos_update" ON storage.objects;
CREATE POLICY "hard75_photos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'hard75-photos'
    AND public.can_see_hard75_run(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "hard75_photos_delete" ON storage.objects;
CREATE POLICY "hard75_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'hard75-photos'
    AND public.can_see_hard75_run(((storage.foldername(name))[1])::uuid)
  );
