-- Reminders that repeat every week on the same day.
--
-- "Take the trash out to the street" is true every Wednesday, forever. Nobody
-- should have to retype it each week, and it should not depend on when the
-- week was created — so it belongs to the template, not to a week.
--
-- The board shows these alongside the week's own one-off reminders: standing
-- ones first, then whatever was added for tonight.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
CREATE TABLE IF NOT EXISTS public.practice_standing_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  text text NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  UNIQUE (weekday, text)
);

ALTER TABLE public.practice_standing_reminders ENABLE ROW LEVEL SECURITY;

-- Readable by the board (a TV with no login); writable by admins only.
DROP POLICY IF EXISTS "Board reads standing reminders" ON public.practice_standing_reminders;
CREATE POLICY "Board reads standing reminders"
  ON public.practice_standing_reminders FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage standing reminders" ON public.practice_standing_reminders;
CREATE POLICY "Admins manage standing reminders"
  ON public.practice_standing_reminders FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.practice_standing_reminders (weekday, text, position)
VALUES (3, 'Take Trash Out to Street!', 0)
ON CONFLICT (weekday, text) DO NOTHING;
