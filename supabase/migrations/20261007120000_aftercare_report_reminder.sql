-- Aftercare report reminder: 8 PM Eastern, every day, to each lab's coach
-- for any Tuesday session whose half of the journal is still unwritten.
-- Same DST-proof pattern as the Bald Eagle email: fire at 00:00 and 01:00
-- UTC and let the function keep only the run that is 8 PM Eastern.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aftercare-report-reminder-8pm-eastern') THEN
    PERFORM cron.unschedule('aftercare-report-reminder-8pm-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'aftercare-report-reminder-8pm-eastern',
  '0 0,1 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/aftercare-report-reminder',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

COMMIT;
