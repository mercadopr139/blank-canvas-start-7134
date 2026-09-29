-- hawk_squad_youth_served, take two.
--
-- The first version (20260929140000) built two temp tables inside a STABLE
-- function. Postgres refuses DDL in a non-volatile function, and plpgsql
-- bodies are not checked at CREATE, so it was accepted and then failed on
-- the first call. This is the same query as one statement of CTEs.

BEGIN;

CREATE OR REPLACE FUNCTION public.hawk_squad_youth_served(_from date, _to date)
RETURNS TABLE (nla_youth integer, hawk_youth integer, in_both integer, combined integer, in_both_names text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  RETURN QUERY
  WITH nla AS (
    -- Everyone who checked in to NLA in the window (any programme source:
    -- Smile Lab kids are NLA kids), as people rather than registrations.
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.attendance_records a
    JOIN public.youth_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  hawk AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.hawk_squad_attendance a
    JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  both_sides AS (
    -- A Hawk Squad person is "in both" when some NLA person has the same
    -- name and, where both sides know it, the same date of birth.
    SELECT DISTINCT h.person, h.display
    FROM hawk h
    WHERE EXISTS (
      SELECT 1 FROM nla n
      WHERE n.fn = h.fn AND n.ln = h.ln
        AND (n.dob IS NULL OR h.dob IS NULL OR n.dob = h.dob)
    )
  ),
  counts AS (
    SELECT (SELECT count(DISTINCT person) FROM nla)::integer AS n,
           (SELECT count(DISTINCT person) FROM hawk)::integer AS h,
           (SELECT count(DISTINCT person) FROM both_sides)::integer AS b,
           (SELECT COALESCE(array_agg(DISTINCT display ORDER BY display), ARRAY[]::text[]) FROM both_sides) AS names
  )
  SELECT c.n, c.h, c.b, c.n + c.h - c.b, c.names FROM counts c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_youth_served(date, date) TO authenticated;

COMMIT;
