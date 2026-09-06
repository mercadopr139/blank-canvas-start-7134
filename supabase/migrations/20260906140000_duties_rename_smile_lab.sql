-- Rename the "Teen Center" duties zone to "Smile Lab".
--
-- The zone name lives on each duty_jobs row (the board and admin group by it).
-- This renames it in place, so the seeded "Sweep & Mop" job — and any jobs an
-- admin added under Teen Center — move to the Smile Lab zone. History is
-- untouched (assignments point at job ids, not the zone name).
UPDATE public.duty_jobs
SET zone = 'Smile Lab'
WHERE zone = 'Teen Center';
