-- Rev's Non-Battle Team email (Josh, 2026-10-26): Monday's workout isn't
-- written until after the Lap with Chrissy, so Monday's email goes at NOON
-- Eastern; Tuesday and Thursday stay at 7 AM. If the week is locked after the
-- send time, locking it sends the day's workout right then (until 4 PM).
--
-- 1. A log of what was sent, so a workout never goes to Rev twice.
-- 2. The cron job also runs at 16:00 and 17:00 UTC (noon Eastern, clock change
--    included); the function keeps only the run that matches each day's hour.
--    alter_job changes the schedule only — the job's command (and its secret)
--    stay as they were.
CREATE TABLE IF NOT EXISTS public.nbt_morning_sends (
  send_date  date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('workout', 'held')),
  sent_to    text[] NOT NULL DEFAULT '{}',
  sent_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (send_date, kind)
);
ALTER TABLE public.nbt_morning_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read the NBT send log" ON public.nbt_morning_sends;
CREATE POLICY "Admins read the NBT send log"
  ON public.nbt_morning_sends FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
-- Written only by the nbt-morning function (service role).

SELECT cron.alter_job(
  job_id   := (SELECT jobid FROM cron.job WHERE jobname = 'nbt-morning-7am-eastern'),
  schedule := '0 11,12,16,17 * * *'
);
