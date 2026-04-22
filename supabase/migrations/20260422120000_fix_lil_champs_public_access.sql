-- Fix Lil Champs Corner kiosk: grant public access to search and count functions
GRANT EXECUTE ON FUNCTION public.search_lil_champs_youth(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_lil_champs_youth(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_today_lil_champs_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_today_lil_champs_count() TO authenticated;

-- Create a safe public roster function for the "Browse by Photo" feature.
-- Only returns first name, last name, date of birth, and headshot for approved Lil Champs youth.
-- No address, medical info, parent contacts, or any other sensitive fields.
CREATE OR REPLACE FUNCTION public.get_lil_champs_roster()
RETURNS TABLE(id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_date_of_birth,
    yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE
    yr.approved_for_attendance = true
    AND yr.extended_program = 'Lil Champs Corner'
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_lil_champs_roster() TO anon;
GRANT EXECUTE ON FUNCTION public.get_lil_champs_roster() TO authenticated;
