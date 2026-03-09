-- Secure kiosk search function (returns only non-sensitive fields)
CREATE OR REPLACE FUNCTION public.search_kiosk_youth(_search text)
RETURNS TABLE (
  id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program,
    yr.child_headshot_url
  FROM public.youth_registrations yr
  WHERE
    yr.approved_for_attendance = true
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (
      yr.child_first_name ILIKE ('%' || trim(_search) || '%')
      OR yr.child_last_name ILIKE ('%' || trim(_search) || '%')
    )
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_kiosk_youth(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_kiosk_youth(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_kiosk_youth(text) TO authenticated;