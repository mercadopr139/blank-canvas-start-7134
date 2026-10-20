-- The Practice Plan opens to Staff (Josh, 2026-10-20): Rev (Pastor Bill)
-- leads the Non-Battle Team on Mon/Tue/Thu and the verse of the day, and gets
-- a Staff login with ONE box ticked — Practice Plan. Same pattern as Juniors
-- Aftercare: every table the app writes gets a policy keyed on
-- has_app('app_practice_plan'), which is true for Admins and for a Staff
-- person whose card has that box. Nothing here holds a youth's record.
--
-- Already open to any login (the wall board writes them): nbt_blocks,
-- nbt_weeks, nbt_logs, strength_weeks. Not touched.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'practice_settings', 'practice_template_blocks', 'practice_spiritual_template',
    'practice_weeks', 'practice_blocks', 'practice_meeting_points', 'practice_drills',
    'practice_reminders', 'practice_standing_reminders', 'practice_day_start_times',
    'practice_categories', 'board_verse_weeks', 'board_verse_days', 'nbt_athlete_levels'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Practice Plan staff manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Practice Plan staff manage %1$s" ON public.%1$I FOR ALL TO authenticated
         USING (public.has_app(''app_practice_plan''))
         WITH CHECK (public.has_app(''app_practice_plan''))', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'Practice Plan is open to Staff' AS result;
