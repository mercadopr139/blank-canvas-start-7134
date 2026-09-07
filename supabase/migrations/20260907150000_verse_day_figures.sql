-- Who the people in the verse actually are.
--
-- "Why do you think David admits he's afraid?" assumes the room knows who
-- David is. Plenty of the youth don't, and asking in front of eighty people is
-- not something a fourteen-year-old will do. So each day carries a one-line
-- introduction to anyone it names — enough to follow the question, not a
-- history lesson.
--
-- [{ "name": "David", "who": "A shepherd boy who became king of Israel..." }]
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
ALTER TABLE public.board_verse_days
  ADD COLUMN IF NOT EXISTS figures jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.board_verse_days.figures IS
  'People named in the passage or questions, with a one-line "who is this" for the youth.';
