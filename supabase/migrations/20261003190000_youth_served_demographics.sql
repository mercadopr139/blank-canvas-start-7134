-- Youth Served (all programs): who the distinct youth are.
--
-- youth_served_all_programs() gives the one number; this returns one row per
-- person behind it, with sex, race / ethnicity and lunch status, so the page
-- can show demographics for exactly the same distinct set. Same identity
-- rules: each side collapses to a person (youth_link_id, else the row), and a
-- Hawk Squad or BAM student who is also an NLA youth is matched by first
-- name, last name and date of birth and kept once, on the NLA side. When a
-- person has several registrations the newest one answers for them.
-- No names leave the database; the page only tallies.

CREATE OR REPLACE FUNCTION public.youth_served_demographics(_from date, _to date)
RETURNS TABLE (person uuid, child_sex text, child_race_ethnicity text, free_or_reduced_lunch text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  RETURN QUERY
  WITH nla AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.attendance_records a JOIN public.youth_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  hawk AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.hawk_squad_attendance a JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  bam AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob
    FROM public.bam_attendance a JOIN public.bam_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  -- Hawk Squad students not already counted as NLA youth.
  hawk_only AS (
    SELECT h.* FROM hawk h
    WHERE NOT EXISTS (SELECT 1 FROM nla n WHERE n.fn = h.fn AND n.ln = h.ln AND (n.dob IS NULL OR h.dob IS NULL OR n.dob = h.dob))
  ),
  -- BAM students not already counted as NLA youth or Hawk Squad students.
  bam_only AS (
    SELECT b.* FROM bam b
    WHERE NOT EXISTS (SELECT 1 FROM nla n WHERE n.fn = b.fn AND n.ln = b.ln AND (n.dob IS NULL OR b.dob IS NULL OR n.dob = b.dob))
      AND NOT EXISTS (SELECT 1 FROM hawk h WHERE h.fn = b.fn AND h.ln = b.ln AND (h.dob IS NULL OR b.dob IS NULL OR h.dob = b.dob))
  ),
  nla_demo AS (
    SELECT DISTINCT ON (x.person) x.person,
           r.child_sex::text, r.child_race_ethnicity::text, r.free_or_reduced_lunch::text
    FROM nla x JOIN public.youth_registrations r ON COALESCE(r.youth_link_id, r.id) = x.person
    ORDER BY x.person, r.created_at DESC
  ),
  hawk_demo AS (
    SELECT DISTINCT ON (x.person) x.person,
           r.child_sex::text, r.child_race_ethnicity::text, r.free_or_reduced_lunch::text
    FROM hawk_only x JOIN public.hawk_squad_registrations r ON COALESCE(r.youth_link_id, r.id) = x.person
    ORDER BY x.person, r.created_at DESC
  ),
  bam_demo AS (
    SELECT DISTINCT ON (x.person) x.person,
           r.child_sex::text, r.child_race_ethnicity::text, r.free_or_reduced_lunch::text
    FROM bam_only x JOIN public.bam_registrations r ON COALESCE(r.youth_link_id, r.id) = x.person
    ORDER BY x.person, r.created_at DESC
  )
  SELECT * FROM nla_demo
  UNION ALL SELECT * FROM hawk_demo
  UNION ALL SELECT * FROM bam_demo;
END;
$$;
GRANT EXECUTE ON FUNCTION public.youth_served_demographics(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
