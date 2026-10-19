-- The Lap, step 5: the message board link (docs/LAP_PLAN.md).
--
-- 1) A conversation can be pinned to a lap checkpoint, so it is waiting
--    there when the runner arrives. Untagged conversations still show at
--    their pillar.
ALTER TABLE public.mb_conversations
  ADD COLUMN IF NOT EXISTS lap_topic_id uuid REFERENCES public.lap_topics(id) ON DELETE SET NULL;

-- 2) The morning-of reminder: 8 AM Eastern on lap day, listing last lap's
--    open commitments. Scheduled at 12:00 and 13:00 UTC; the function keeps
--    the run that is 8 AM Eastern and the day that is lap day.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lap-reminder-8am-eastern') THEN
    PERFORM cron.unschedule('lap-reminder-8am-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'lap-reminder-8am-eastern',
  '0 12,13 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/lap-reminder',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
COMMIT;
