-- NBT locks a WEEK, not a month.
--
-- The Non-Battle Team Workout Plan is now built and put on the wall one week
-- at a time, like the Battle Team's and the Practice Plan. A week is a draft
-- until a coach locks it; the wall shows locked weeks only. The month block
-- stays as the thread (its emphasis, its continuity) but no longer gates the
-- wall. Weeks already written are locked here so nothing disappears from the
-- board the moment this lands. (Josh, 2026-10-03.)
ALTER TABLE public.nbt_weeks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'locked')),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

UPDATE public.nbt_weeks
   SET status = 'locked', locked_at = COALESCE(locked_at, now())
 WHERE status = 'draft';

COMMENT ON COLUMN public.nbt_weeks.status IS
  'draft = the coach is still working on it; locked = on the gym board for everyone.';

NOTIFY pgrst, 'reload schema';
