
CREATE OR REPLACE FUNCTION public.get_today_checkin_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.attendance_records
  WHERE check_in_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date;
$$;
