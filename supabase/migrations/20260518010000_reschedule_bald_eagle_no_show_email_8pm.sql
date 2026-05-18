-- Move the Bald Eagle No-Show email from 7:30 PM to 8 PM Eastern.
--
-- Reason: practice can run until ~8 PM, and a 7:30 PM email could
-- mistakenly flag a youth who actually checks in between 7:30 and 8 PM.
-- 8 PM matches the in-app banner threshold too, so they stay in sync.
--
-- Same DST trick: schedule at BOTH 00:00 UTC and 01:00 UTC, let the
-- edge function's Eastern-hour guard (now 20) accept only the right one:
--   - EDT (Mar–Nov): 00:00 UTC = 20 ET → sends. 01:00 UTC = 21 ET → skip.
--   - EST (Nov–Mar): 00:00 UTC = 19 ET → skip. 01:00 UTC = 20 ET → sends.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bald-eagle-no-shows-730pm-eastern') THEN
    PERFORM cron.unschedule('bald-eagle-no-shows-730pm-eastern');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bald-eagle-no-shows-8pm-eastern') THEN
    PERFORM cron.unschedule('bald-eagle-no-shows-8pm-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'bald-eagle-no-shows-8pm-eastern',
  '0 0,1 * * *',
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
