-- The lift plan drives the practice plan's Strength / S&C column (Josh,
-- 2026-11-02: the Battle Team plan was built for Thursday after the practice
-- plan, and Thursday's column never got a Strength slot). Building a lift
-- week now adds that column on each night it lifts, "this week only", with
-- the lift as its line. Such a column is marked here so a rebuild can keep
-- its line current and take it off a night the lift week dropped — while a
-- column Josh made himself is never touched. Safe to run more than once.

ALTER TABLE public.practice_blocks
  ADD COLUMN IF NOT EXISTS from_lift boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

SELECT 'practice blocks from lift ready' AS done;
