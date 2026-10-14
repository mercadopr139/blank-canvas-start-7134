-- A coach can push a night's Battle Team workout to tomorrow from the Gym
-- Board (Josh, 2026-10-14), so a workout — and the sets logged against it —
-- can land on any practice weekday, not only Monday / Wednesday / Friday.
ALTER TABLE public.strength_set_logs DROP CONSTRAINT IF EXISTS strength_set_logs_day_key_check;
ALTER TABLE public.strength_set_logs
  ADD CONSTRAINT strength_set_logs_day_key_check
  CHECK (day_key IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));
