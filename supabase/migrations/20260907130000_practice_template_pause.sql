-- Pause a template item instead of deleting it.
--
-- Smile Lab is on the Tuesday spiritual row every week — except it doesn't
-- start again for a few weeks. Deleting it loses the arrangement and somebody
-- has to remember to recreate it; leaving it there puts a programme on the
-- board that isn't running.
--
-- So: paused. It keeps its place in the template, stops being copied into new
-- weeks, and stops showing on the board. Switch it back on and it returns
-- exactly as it was — the same idea as Friday going dormant out of season.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
ALTER TABLE public.practice_template_blocks
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.practice_spiritual_template
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.practice_template_blocks.is_active IS
  'False = paused: kept in the template, skipped when starting a week.';
COMMENT ON COLUMN public.practice_spiritual_template.is_active IS
  'False = paused: kept in the template, hidden on the gym board.';
