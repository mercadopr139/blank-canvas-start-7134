-- Trash Day is a job, not a banner.
--
-- The board shows it as a big red tile on Thursdays, but a reminder nobody is
-- assigned to is a reminder nobody does. As a duty_jobs row it gets the same
-- Add button as every other job, the kid's name goes on it, and it shows in
-- Daily Duties Intelligence. One row, in its own zone, seeded once.
INSERT INTO public.duty_jobs (zone, label, category, sort_order, is_active)
SELECT 'Trash Day', 'Take the trash cans to the curb', 'Reset', 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.duty_jobs WHERE zone = 'Trash Day');
