-- "Not this week" on the planner's strip (Josh, 2026-11-02): a Monday-and-
-- Thursday week needs no Verse of the Week and no lift plans, and the strip
-- should not sit at "1 of 4 done" forever. One row per step skipped for a
-- week; gone when Josh undoes it; next week starts clean. The practice plan
-- itself can never be skipped. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.week_step_skips (
  week_start  date NOT NULL,
  step        text NOT NULL CHECK (step IN ('verse', 'battle', 'nbt')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (week_start, step)
);

ALTER TABLE public.week_step_skips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage week step skips" ON public.week_step_skips;
CREATE POLICY "Admins manage week step skips"
  ON public.week_step_skips FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

NOTIFY pgrst, 'reload schema';

SELECT 'week step skips ready' AS done;
