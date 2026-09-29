-- Hawk Squad kiosk: an archived student is never offered, gate or no gate.
--
-- passes_kiosk_year_gate() only looks at archived_at once the current-year
-- gate is switched on; with the gate off it returns true for everyone. The
-- Registrations page also un-approves on archive, so nothing slipped through,
-- but the kiosk functions should say it themselves rather than rely on that.
BEGIN;

CREATE OR REPLACE FUNCTION public.search_hawk_squad_youth(_search text)
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_date_of_birth date, child_headshot_url text, can_be_dismissed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_date_of_birth, r.child_headshot_url,
         (r.dismissal_waiver_signed_at IS NOT NULL) AS can_be_dismissed
  FROM public.hawk_squad_registrations r
  WHERE r.approved_for_attendance = true
    AND r.archived_at IS NULL
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
    AND _search IS NOT NULL
    AND length(trim(_search)) >= 2
    AND (r.child_first_name ILIKE ('%' || trim(_search) || '%')
         OR r.child_last_name ILIKE ('%' || trim(_search) || '%'))
  ORDER BY r.child_last_name ASC, r.child_first_name ASC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.hawk_squad_kiosk_roster()
RETURNS TABLE (id uuid, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.child_first_name, r.child_last_name, r.child_headshot_url
  FROM public.hawk_squad_registrations r
  WHERE r.approved_for_attendance = true
    AND r.archived_at IS NULL
    AND public.passes_kiosk_year_gate(r.program_year, r.archived_at)
  ORDER BY r.child_last_name ASC, r.child_first_name ASC;
$$;

COMMIT;
