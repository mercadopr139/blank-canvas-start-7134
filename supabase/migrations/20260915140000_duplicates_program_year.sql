-- The duplicate detector says which program year each row belongs to.
--
-- Five of the seven groups on the page today were the same kid across two
-- program years with a mistyped birthday on the re-registration. The page
-- showed "birthday differs" and nothing about the year, so nothing on screen
-- said "Link, don't Merge" -- and Merge on a cross-year pair deletes last
-- year's record and its history, which is exactly what went wrong on
-- 2026-09-02. With the year on every row the page can badge a cross-year
-- group and refuse to merge it.
--
-- The return type changes, so the function is dropped and recreated; the
-- body is otherwise 20260915130000 unchanged.

BEGIN;

DROP FUNCTION IF EXISTS public.admin_get_duplicate_registrations();

CREATE FUNCTION public.admin_get_duplicate_registrations()
RETURNS TABLE (
  id                      uuid,
  child_first_name        text,
  child_last_name         text,
  child_boxing_program    text,
  child_date_of_birth     date,
  parent_first_name       text,
  parent_last_name        text,
  registered_on           date,
  approved_for_attendance boolean,
  attendance_count        bigint,
  first_attendance        date,
  last_attendance         date,
  dup_key                 text,
  match_type              text,
  program_year            text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  WITH base AS (
    SELECT
      yr.id,
      COALESCE(yr.youth_link_id, yr.id) AS identity,
      yr.program_year,
      lower(regexp_replace(yr.child_first_name, '[^a-zA-Z0-9]', '', 'g')) AS fn,
      CASE WHEN yr.child_date_of_birth IS NOT NULL
        THEN 'dob:' || yr.child_date_of_birth::text || '|'
             || lower(regexp_replace(yr.child_last_name, '[^a-zA-Z0-9]', '', 'g'))
      END AS dob_key,
      'name:' || lower(regexp_replace(yr.child_first_name, '[^a-zA-Z0-9]', '', 'g'))
             || '|' || lower(regexp_replace(yr.child_last_name, '[^a-zA-Z0-9]', '', 'g')) AS name_key
    FROM public.youth_registrations yr
    WHERE yr.child_last_name IS NOT NULL
      AND TRIM(yr.child_last_name) <> ''
  ),
  links AS (
    SELECT
      a.id AS id,
      MIN(b.id::text) AS rep,
      bool_or(
        a.id <> b.id AND a.dob_key IS NOT NULL AND a.dob_key = b.dob_key
        AND public.first_name_compatible(a.fn, b.fn)
      ) AS has_dob_partner,
      COUNT(DISTINCT b.identity) AS identity_count,
      bool_or(
        a.id <> b.id AND a.identity = b.identity
        AND a.program_year IS NOT DISTINCT FROM b.program_year
      ) AS same_year_twin
    FROM base a
    JOIN base b
      ON a.name_key = b.name_key
      OR (a.dob_key IS NOT NULL AND a.dob_key = b.dob_key
          AND public.first_name_compatible(a.fn, b.fn))
    GROUP BY a.id
  ),
  clustered AS (
    SELECT l.id, l.rep AS dup_key,
      CASE WHEN l.has_dob_partner OR l.same_year_twin THEN 'strong' ELSE 'possible' END AS match_type
    FROM links l
    WHERE l.identity_count > 1 OR l.same_year_twin
  )
  SELECT
    yr.id, yr.child_first_name, yr.child_last_name, yr.child_boxing_program::text,
    yr.child_date_of_birth, yr.parent_first_name, yr.parent_last_name,
    yr.created_at::date AS registered_on, yr.approved_for_attendance,
    COUNT(ar.id) AS attendance_count, MIN(ar.check_in_date) AS first_attendance,
    MAX(ar.check_in_date) AS last_attendance, c.dup_key, c.match_type,
    yr.program_year
  FROM public.youth_registrations yr
  JOIN clustered c ON c.id = yr.id
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id, c.dup_key, c.match_type
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC, yr.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_duplicate_registrations() TO authenticated;

COMMIT;
