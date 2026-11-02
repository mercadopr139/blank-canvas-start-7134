-- The nights a lift week runs on (Josh, 2026-11-02): "because it's a modified
-- week, I should have the option to make Battle Team lift Monday & Thursday
-- even though the logic is built for Monday Wednesday Friday." Each lift
-- week remembers which nights it was built for. Null = the programme's own
-- nights (Battle Team Mon/Wed/Fri, NBT Mon/Tue/Thu), exactly as before, so
-- every week already written reads the same. Safe to run more than once.

ALTER TABLE public.strength_weeks
  ADD COLUMN IF NOT EXISTS nights text[];

ALTER TABLE public.nbt_weeks
  ADD COLUMN IF NOT EXISTS nights text[];

NOTIFY pgrst, 'reload schema';

SELECT 'lift week nights ready' AS done;
