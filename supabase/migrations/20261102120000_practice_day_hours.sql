-- Holiday hours (Josh, 2026-11-02): "Thursday it's teacher convention weekend
-- which we consider a holiday, practice moves to 11–1." The one-off start
-- time per date already exists (practice_day_start_times, keyed on the date
-- so it can never leak into next week). A holiday session is the one time
-- the END matters too, so the date gets an end time; the note ("Teacher
-- convention") already has its column. The planner's day card and the
-- board's banner both read this row. Safe to run more than once.

ALTER TABLE public.practice_day_start_times
  ADD COLUMN IF NOT EXISTS end_time time;

NOTIFY pgrst, 'reload schema';

SELECT 'practice day hours ready' AS done;
