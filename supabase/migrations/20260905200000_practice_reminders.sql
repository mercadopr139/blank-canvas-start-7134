-- Special Reminders — announcements that stay on the wall all night.
--
-- Distinct from the team meeting's discussion points on purpose:
--   Things to Discuss  the agenda for those five minutes.
--   Special Reminders  what everyone should keep seeing for the rest of the
--                      night — "Pastor Harris is out, Coach Bill leads",
--                      "Guest speaker tonight", "Buses leave at 7 sharp".
--
-- Per week per day, so a reminder disappears with the week rather than
-- becoming part of the standing pattern.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
CREATE TABLE IF NOT EXISTS public.practice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES public.practice_weeks(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_id, weekday)
);

DROP TRIGGER IF EXISTS trg_practice_reminders_updated ON public.practice_reminders;
CREATE TRIGGER trg_practice_reminders_updated
  BEFORE UPDATE ON public.practice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.practice_reminders ENABLE ROW LEVEL SECURITY;

-- Same rule as the rest of the board: readable once the week is published,
-- writable only by admins.
DROP POLICY IF EXISTS "Board reads published reminders" ON public.practice_reminders;
CREATE POLICY "Board reads published reminders"
  ON public.practice_reminders FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.practice_weeks w
      WHERE w.id = week_id AND w.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Admins manage practice_reminders" ON public.practice_reminders;
CREATE POLICY "Admins manage practice_reminders"
  ON public.practice_reminders FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
