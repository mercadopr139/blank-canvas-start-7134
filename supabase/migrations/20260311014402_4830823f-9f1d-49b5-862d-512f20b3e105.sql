-- Update get_today_checkin_count to only count NLA check-ins
CREATE OR REPLACE FUNCTION public.get_today_checkin_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.attendance_records
  WHERE check_in_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
    AND program_source = 'NLA';
$function$;