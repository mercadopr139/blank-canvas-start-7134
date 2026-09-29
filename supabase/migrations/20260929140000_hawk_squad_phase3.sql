-- Hawk Squad, phase 3: youth served across programmes.
--
-- Hawk Squad lives in its own tables on purpose (see 20260929120000), so
-- nothing NLA reports can pick a Hawk Squad student up by accident. Some
-- students are in both, though, and a funder asking "how many youth did
-- No Limits serve?" wants one number with nobody counted twice. This is the
-- one deliberate join: a person on the NLA side is their cross-year identity
-- (COALESCE(youth_link_id, id)); a person on the Hawk side likewise; the two
-- sides are matched by name and date of birth. Admin only.

BEGIN;

CREATE OR REPLACE FUNCTION public.hawk_squad_youth_served(_from date, _to date)
RETURNS TABLE (nla_youth integer, hawk_youth integer, in_both integer, combined integer, in_both_names text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _nla integer; _hawk integer; _both integer; _names text[];
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  -- Everyone who checked in to NLA in the window (any programme source:
  -- Smile Lab kids are NLA kids), as people rather than registrations.
  CREATE TEMP TABLE _nla_people ON COMMIT DROP AS
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.attendance_records a
    JOIN public.youth_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to;

  CREATE TEMP TABLE _hawk_people ON COMMIT DROP AS
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.hawk_squad_attendance a
    JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to;

  SELECT count(DISTINCT person) INTO _nla FROM _nla_people;
  SELECT count(DISTINCT person) INTO _hawk FROM _hawk_people;

  -- A Hawk Squad person is "in both" when some NLA person has the same name
  -- and, where both sides know it, the same date of birth.
  SELECT count(DISTINCT h.person), array_agg(DISTINCT h.display ORDER BY h.display)
    INTO _both, _names
  FROM _hawk_people h
  WHERE EXISTS (
    SELECT 1 FROM _nla_people n
    WHERE n.fn = h.fn AND n.ln = h.ln
      AND (n.dob IS NULL OR h.dob IS NULL OR n.dob = h.dob)
  );

  RETURN QUERY SELECT _nla, _hawk, COALESCE(_both, 0), _nla + _hawk - COALESCE(_both, 0), COALESCE(_names, ARRAY[]::text[]);
END;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_youth_served(date, date) TO authenticated;

COMMIT;
