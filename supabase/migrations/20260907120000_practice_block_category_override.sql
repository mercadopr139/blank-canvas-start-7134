-- A week may deliberately differ from the template.
--
-- The template says Tuesday's second Battle Team column is "Sparring". Some
-- weeks it isn't — the column itself changes for that one week, without
-- touching the standing pattern.
--
-- This flag is what tells a deliberate one-off apart from drift. The "template
-- has changed" sync compares a week's categories against the template and
-- offers to bring them back in line; without a marker it would treat a
-- deliberate change as something to correct and quietly undo it. Flagged
-- blocks are left alone by that sync.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
ALTER TABLE public.practice_blocks
  ADD COLUMN IF NOT EXISTS category_overridden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.practice_blocks.category_overridden IS
  'True when the category was changed for THIS WEEK only. The template sync skips these.';
