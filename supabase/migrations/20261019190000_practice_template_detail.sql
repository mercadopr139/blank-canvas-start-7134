-- Practice Plan: the template carries standing text (Josh, 2026-10-19).
--
-- Until now the template held only what KIND of session each group runs;
-- the words inside a block lived on the week, so anything that never
-- changes ("Chest · See workout plan" every Battle Team Monday) was retyped
-- each week. A template block now has its own bullets. A week block with
-- nothing typed shows them; typing in the week overrides for that week
-- only; clearing goes back to the template, not to blank.
ALTER TABLE public.practice_template_blocks ADD COLUMN IF NOT EXISTS detail text;
COMMENT ON COLUMN public.practice_template_blocks.detail IS
  'Standing bullets for this slot. A week block with no detail of its own prints these.';

-- The gym board is a TV with no login, and it now needs the template to
-- print inherited text. The template holds session kinds and standing
-- drills — never a child's name — so reading it anonymously is as safe as
-- the spiritual track and the settings already are.
DROP POLICY IF EXISTS "Board reads the template" ON public.practice_template_blocks;
CREATE POLICY "Board reads the template" ON public.practice_template_blocks
  FOR SELECT TO anon, authenticated USING (true);
