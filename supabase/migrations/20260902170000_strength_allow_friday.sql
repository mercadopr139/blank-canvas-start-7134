-- Strength & Conditioning moved from Mon/Wed/Thu to Mon/Wed/Fri.
-- Widen the set-log day rule to allow Friday (Thursday kept valid so any
-- existing Thursday logs stay legal — no data is invalidated).

ALTER TABLE public.strength_set_logs DROP CONSTRAINT IF EXISTS strength_set_logs_day_key_check;
ALTER TABLE public.strength_set_logs
  ADD CONSTRAINT strength_set_logs_day_key_check
  CHECK (day_key IN ('monday', 'wednesday', 'thursday', 'friday'));
