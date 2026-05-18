-- Schedule the nightly "Bald Eagle No-Shows" email at 7:30 PM America/New_York.
--
-- Same DST trick as the unclosed-trips schedule: pg_cron is UTC-only
-- and the installed version doesn't expose a per-job timezone column,
-- so we fire at BOTH 23:30 UTC and 00:30 UTC daily. The edge function's
-- guard accepts only the firing where local Eastern hour = 19:
--   - EDT (Mar–Nov): 23:30 UTC = 19 ET → sends. 00:30 UTC = 20 ET → guard rejects.
--   - EST (Nov–Mar): 23:30 UTC = 18 ET → guard rejects. 00:30 UTC = 19 ET → sends.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bald-eagle-no-shows-730pm-eastern') THEN
    PERFORM cron.unschedule('bald-eagle-no-shows-730pm-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'bald-eagle-no-shows-730pm-eastern',
  '30 23,0 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/report-bald-eagle-no-shows',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
