-- The Daily Duties cleanup zone goes back to the room's real name.
--
-- "Smile Lab" is now one of the two Juniors Aftercare programs (the other is
-- Life Lab), not a room. The room where the jobs happen is the Teen Center,
-- which is what this zone was called before 20260906140000 renamed it.
-- History is untouched (assignments point at job ids, not the zone name).
-- (Josh, 2026-10-03.)
UPDATE public.duty_jobs
   SET zone = 'Teen Center'
 WHERE zone = 'Smile Lab';
