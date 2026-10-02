-- Wrap-up per day, per week.
--
-- The Template's Wrap-up row (practice_spiritual_template) is the standing
-- pattern — "Eat up · Clean up" most nights, Bible study on Thursday. On any
-- given week a coach may want one night to say something else without
-- changing the pattern for every week after it. That lives on the week row:
--   wrapups = { "4": { "label": "Pizza night · Clean up", "leader": "Mercado" } }
-- keyed by weekday (1 = Monday … 7 = Sunday). Missing key = use the template.
-- (Josh, 2026-10-02.)
ALTER TABLE public.practice_weeks
  ADD COLUMN IF NOT EXISTS wrapups jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.practice_weeks.wrapups IS
  'Per-weekday wrap-up overrides for this week only: {"<weekday>": {"label", "leader"}}. Absent = template.';
