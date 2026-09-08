-- A timer per session.
--
-- 75 Hard asks for two 45-minute workouts a day, so the participant needs to
-- know what he has left while he is in the middle of one. Two reasons this
-- lives in the database rather than in component state:
--
--   1. He will lock his phone between sets. A timer that dies when the tab
--      sleeps is worse than no timer.
--   2. The elapsed seconds are the record of how long each session ACTUALLY
--      took, which is what tells us whether the workouts are the right length.
--
-- Stored as accumulated seconds plus a "running since" stamp, so pausing is
-- exact and a closed tab costs nothing.
--
-- Plan: docs/HARD75_PLAN.md
ALTER TABLE public.hard75_days
  ADD COLUMN IF NOT EXISTS strength_seconds integer NOT NULL DEFAULT 0
    CHECK (strength_seconds >= 0),
  ADD COLUMN IF NOT EXISTS strength_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS cardio_seconds integer NOT NULL DEFAULT 0
    CHECK (cardio_seconds >= 0),
  ADD COLUMN IF NOT EXISTS cardio_started_at timestamptz;

COMMENT ON COLUMN public.hard75_days.strength_seconds IS
  'Accumulated seconds, excluding any currently-running stretch. Add now() - strength_started_at for the live total.';
