-- Rev's morning email (Josh, 2026-10-20): the Non-Battle Team workout at
-- 7 AM Eastern on Monday, Tuesday and Thursday, from the nbt-morning
-- function. Scheduled at 11:00 and 12:00 UTC every day; the function keeps
-- only the run that is 7 AM Eastern (clock change included) and only the
-- Non-Battle Team days, and holds the email with a note to Josh when the
-- week is not locked. Same pattern as the Lap reminder.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nbt-morning-7am-eastern') THEN
    PERFORM cron.unschedule('nbt-morning-7am-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'nbt-morning-7am-eastern',
  '0 11,12 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/nbt-morning',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
COMMIT;
SELECT 'Rev gets the Non-Battle Team workout at 7 AM on Mon, Tue and Thu' AS result;
