-- A one-off start time for a single date.
--
-- Practice starts at 5:15. Except on Labor Day, when it's 11:15am. That is a
-- fact about one date, not a change to the schedule — so it lives here and
-- expires with the day, leaving practice_settings.start_time as the standing
-- default it should be.
--
-- Keyed on the date rather than the week so a holiday can be set whether or
-- not a week has been started, and can never leak into the following week.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md
CREATE TABLE IF NOT EXISTS public.practice_day_start_times (
  practice_date date PRIMARY KEY,
  start_time time NOT NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_practice_day_start_times_updated ON public.practice_day_start_times;
CREATE TRIGGER trg_practice_day_start_times_updated
  BEFORE UPDATE ON public.practice_day_start_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.practice_day_start_times ENABLE ROW LEVEL SECURITY;

-- The board counts down to it, and the board has no login.
DROP POLICY IF EXISTS "Board reads day start times" ON public.practice_day_start_times;
CREATE POLICY "Board reads day start times"
  ON public.practice_day_start_times FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage day start times" ON public.practice_day_start_times;
CREATE POLICY "Admins manage day start times"
  ON public.practice_day_start_times FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
