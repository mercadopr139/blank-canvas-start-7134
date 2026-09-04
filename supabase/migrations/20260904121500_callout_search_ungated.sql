-- Call-outs must never be blocked by the re-registration gate.
--
-- The public call-out form searched youth through search_kiosk_youth,
-- which carries passes_kiosk_year_gate(). Once the gate went live (and
-- the program year rolled over on Sept 1), any youth without a current
-- year registration stopped appearing in the form's name search — and
-- because the submit button requires a picked youth, they could not
-- call out at all. Gating check-in is intentional; gating call-outs is
-- backwards, since that is exactly the kid we most want hearing from.
--
-- This adds a dedicated, UNGATED search for the call-out form. It still
-- requires approved_for_attendance = true, so it exposes no registration
-- the kiosk search would not already expose. It also returns:
--   * is_bald_eagle   — the form previously tried to read this straight
--                       off youth_registrations, which RLS blocks for
--                       anon, so every call-out was silently stamped
--                       is_bald_eagle = false.
--   * is_current_year — lets the form say "you still need to re-register"
--                       on the confirmation screen instead of turning
--                       the kid away.

CREATE OR REPLACE FUNCTION public.search_callout_youth(_search text)
RETURNS TABLE (
  id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program public.boxing_program,
  child_headshot_url text,
  is_bald_eagle boolean,
  is_current_year boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program,
    yr.child_headshot_url,
    COALESCE(yr.is_bald_eagle, false),
    (yr.program_year = public.current_attendance_program_year()
       AND yr.archived_at IS NULL)
  FROM public.youth_registrations yr
  WHERE yr.approved_for_attendance = true
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (yr.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR yr.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY yr.child_last_name ASC, yr.child_first_name ASC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_callout_youth(text) TO anon, authenticated;
