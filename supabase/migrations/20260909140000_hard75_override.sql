-- What he actually did, when it wasn't the plan.
--
-- Deliberately NOT a replacement for the strength/cardio jsonb. Overwriting the
-- plan would destroy the record of what was prescribed, and then "did he run the
-- programme?" becomes unanswerable six weeks later — a swapped session would be
-- indistinguishable from a rewritten one.
--
-- So the override sits on top: the board shows what he did, the plan stays
-- underneath, and either can be read afterwards.
ALTER TABLE public.hard75_days
  ADD COLUMN IF NOT EXISTS strength_override text,
  ADD COLUMN IF NOT EXISTS cardio_override text;

COMMENT ON COLUMN public.hard75_days.strength_override IS
  'Free text: the strength session actually performed, when it differed from the plan. The plan stays in the strength column.';
COMMENT ON COLUMN public.hard75_days.cardio_override IS
  'Free text: the cardio session actually performed, when it differed from the plan. The plan stays in the cardio column.';
