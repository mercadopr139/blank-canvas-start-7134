-- "Today's Plan" — a curated daily worklist layered on top of the Core backlog.
--
-- Each morning a manager hand-picks a small set of signals to commit to for the
-- day. A signal is "on today's plan" when planned_date equals the local current
-- date. The workbench "Win the Day" fires when every planned signal for today is
-- complete. The stamp naturally goes stale overnight, so each day starts empty
-- and deliberate.

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS planned_date DATE;

COMMENT ON COLUMN public.signals.planned_date IS
  'The local date this signal was committed to a manager''s "Today''s Plan" on the workbench. When it equals the current date, the signal is on today''s plan; "Day Won" fires when all of today''s planned signals are complete.';

-- Partial index: the workbench only ever queries rows with a plan stamp.
CREATE INDEX IF NOT EXISTS idx_signals_planned_date
  ON public.signals (planned_date)
  WHERE planned_date IS NOT NULL;
