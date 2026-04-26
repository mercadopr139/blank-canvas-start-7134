-- Fix: get_todays_excursion() was using Postgres CURRENT_DATE (UTC), so
-- after ~8 PM Eastern the function was already looking at "tomorrow" and
-- couldn't find an Excursion the coach had just added for today. NLA
-- operates in Eastern Time, so the function now resolves "today" in
-- America/New_York the same way the front-end check-in pages do.

CREATE OR REPLACE FUNCTION public.get_todays_excursion()
RETURNS TABLE (
  id uuid,
  date date,
  name text,
  notes text,
  youth_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, date, name, notes, youth_count
  FROM public.excursions
  WHERE date = (NOW() AT TIME ZONE 'America/New_York')::date
  ORDER BY created_at DESC
  LIMIT 1;
$$;
