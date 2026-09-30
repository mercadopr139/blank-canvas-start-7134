-- Hawk Squad: Weekly Standout Moments.
--
-- One free-text entry per week (the week runs Monday to Sunday and is keyed
-- by its Monday). Chrissy writes the little things that make a report real --
-- "dodgeball and Domino's", "they helped each other prep for the SAT class"
-- -- and the grant report weaves them in. A reminder email goes to her at
-- 8 AM Eastern from Friday, every day, until the week's entry is written.

BEGIN;

CREATE TABLE IF NOT EXISTS public.hawk_squad_weekly_moments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   date NOT NULL UNIQUE,           -- the Monday
  notes        text NOT NULL DEFAULT '',
  author_email text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hawk_squad_weekly_moments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage hawk weekly moments" ON public.hawk_squad_weekly_moments;
CREATE POLICY "Admins manage hawk weekly moments" ON public.hawk_squad_weekly_moments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP TRIGGER IF EXISTS update_hawk_squad_weekly_moments_updated_at ON public.hawk_squad_weekly_moments;
CREATE TRIGGER update_hawk_squad_weekly_moments_updated_at
  BEFORE UPDATE ON public.hawk_squad_weekly_moments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The reminder. Same DST-proof pattern as the Bald Eagle email: fire at
-- 12:00 and 13:00 UTC and let the function keep only the run that is 8 AM
-- Eastern. The function decides whether there is anything to remind about.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hawk-squad-moments-8am-eastern') THEN
    PERFORM cron.unschedule('hawk-squad-moments-8am-eastern');
  END IF;
END $$;

SELECT cron.schedule(
  'hawk-squad-moments-8am-eastern',
  '0 12,13 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rkdkmzjontaufbyjbcku.supabase.co/functions/v1/hawk-squad-moments-reminder',
    headers := jsonb_build_object(
      'X-Cron-Secret', '92824534-55a6-4469-8825-336ef44b9a41-e33baadf-16cb-4bf9-a12a-ed36d62d29c6',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

COMMIT;
