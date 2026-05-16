-- Schedule the nightly "Unclosed Trips" email at 9 PM America/New_York.
--
-- Supabase's pg_cron schedules in UTC and the installed version
-- doesn't expose a per-job timezone column. We fire at BOTH 01:00 UTC
-- and 02:00 UTC every day; the edge function has a time guard that
-- only sends when the local Eastern hour equals 21, so:
--   - In EDT (Mar–Nov): 01:00 UTC = 21 ET → sends. 02:00 UTC = 22 ET → guard rejects.
--   - In EST (Nov–Mar): 01:00 UTC = 20 ET → guard rejects. 02:00 UTC = 21 ET → sends.
-- DST handles itself this way without anyone editing the schedule.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'unclosed-trips-9pm-eastern') THEN
    PERFORM cron.unschedule('unclosed-trips-9pm-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'unclosed-trips-9pm-eastern',
  '0 1,2 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/report-incomplete-trips',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
