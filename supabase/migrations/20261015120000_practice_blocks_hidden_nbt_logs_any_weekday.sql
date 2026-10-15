-- Moving a team's workout to another night (Josh, 2026-10-14/15).
--
-- 1) A practice block can be hidden. When a coach moves a workout off a
--    night, the night's Strength / S&C block stays in the week as a hidden
--    row instead of being deleted or re-positioned, so the template sync
--    still sees the slot filled and never puts an empty block back, and the
--    other blocks in the column keep the positions the template knows them
--    by. The board and the editor simply don't draw hidden rows.
ALTER TABLE public.practice_blocks
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- 2) An NBT workout, and the sets logged against it, can land on any
--    practice weekday — the same freedom the Battle Team got on 10-14.
ALTER TABLE public.nbt_logs DROP CONSTRAINT IF EXISTS nbt_logs_day_key_check;
ALTER TABLE public.nbt_logs
  ADD CONSTRAINT nbt_logs_day_key_check
  CHECK (day_key IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));
