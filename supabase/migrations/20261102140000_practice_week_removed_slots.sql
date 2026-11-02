-- A column removed from a week on purpose stays removed (Josh, 2026-11-02:
-- Thursday's usual columns came off for a holiday, and the planner then
-- offered to put the four template slots back as "missing"). The week now
-- remembers each slot it removed — "group|weekday|position" — and the
-- template check skips those, so the purple banner appears only when the
-- template itself changed under Edit Template. Safe to run more than once.

ALTER TABLE public.practice_weeks
  ADD COLUMN IF NOT EXISTS removed_slots text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';

SELECT 'practice week removed slots ready' AS done;
