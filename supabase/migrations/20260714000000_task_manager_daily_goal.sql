-- Per-manager daily "Win the Day" goal.
--
-- The workbench home used to fire "Day Won" only when EVERY Core signal in the
-- rolling backlog was complete. As focus areas grew, that became unreachable.
-- We switch to a daily goal: complete N signals in a single day (by
-- completed_at) to win. Each manager sets their own target; defaults to 5.

ALTER TABLE public.task_managers
  ADD COLUMN IF NOT EXISTS daily_goal INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.task_managers.daily_goal IS
  'Number of Core signals a manager must complete in a single day (by completed_at, local time) to "Win the Day" on the workbench home. Defaults to 5.';
