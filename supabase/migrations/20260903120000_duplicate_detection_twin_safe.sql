-- ═══════════════════════════════════════════════════════════════════
-- Duplicate detection: twin-safe + hide already-resolved (linked) pairs
-- ═══════════════════════════════════════════════════════════════════
-- Two fixes to admin_get_duplicate_registrations(), the function behind the
-- Duplicate Registrations page. READ-ONLY detection change — it reads rows and
-- returns a list; it never writes, deletes, or merges anything. Fully reversible
-- by redeploying the prior version (20260902150000).
--
-- 1) TWIN-SAFE. The old "strong" match linked any two rows sharing birthday +
--    last name while IGNORING the first name — so TWINS (same last name +
--    birthday, different first names, e.g. Jordyn vs Justin Banks) were clustered
--    as one "duplicate." The birthday match now ALSO requires compatible first
--    names: identical, or one a prefix of the other (chris → christian) to still
--    catch nickname/short forms and typos. Twins have unrelated first names, so
--    they never cluster. (The name-based "possible" match already required the
--    same first name, so it was never the problem.)
--
-- 2) HIDE RESOLVED PAIRS. A returning kid legitimately has one row per program
--    year; once those rows are LINKED (share youth_link_id) they're already
--    counted as one person and need no action. The page now only surfaces a
--    cluster when it spans MORE THAN ONE distinct identity
--    (COALESCE(youth_link_id, id)) — i.e. genuinely unresolved duplicates:
--    same-year double-registrations, or cross-year pairs that aren't linked yet.
--    Already-linked returning kids (and linked twins) drop off the list.

BEGIN;

-- First-name compatibility: same normalized name, or one a prefix of the other
-- (≥3 chars each). Inputs are already normalized (lowercase, alphanumerics only),
-- so LIKE carries no wildcard-injection risk.
CREATE OR REPLACE FUNCTION public.first_name_compatible(_a text, _b text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT _a = _b
     OR (length(_a) >= 3 AND length(_b) >= 3
         AND (_a LIKE _b || '%' OR _b LIKE _a || '%'));
$$;

CREATE OR REPLACE FUNCTION public.admin_get_duplicate_registrations()
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
  match_type              text
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
      MIN(b.id) AS rep,
      -- A birthday partner now also has to have a compatible first name, so
      -- twins don't count as each other's duplicate.
      bool_or(
        a.id <> b.id AND a.dob_key IS NOT NULL AND a.dob_key = b.dob_key
        AND public.first_name_compatible(a.fn, b.fn)
      ) AS has_dob_partner,
      -- Distinct real people in this neighbourhood. 1 = the row (plus its own
      -- already-linked other-year rows) → resolved, nothing to do. >1 = at least
      -- two unlinked identities → a genuine duplicate to review.
      COUNT(DISTINCT b.identity) AS identity_count
    FROM base a
    JOIN base b
      ON a.name_key = b.name_key
      OR (a.dob_key IS NOT NULL AND a.dob_key = b.dob_key
          AND public.first_name_compatible(a.fn, b.fn))
    GROUP BY a.id
  ),
  clustered AS (
    SELECT l.id, l.rep::text AS dup_key,
      CASE WHEN l.has_dob_partner THEN 'strong' ELSE 'possible' END AS match_type
    FROM links l
    WHERE l.identity_count > 1
  )
  SELECT
    yr.id, yr.child_first_name, yr.child_last_name, yr.child_boxing_program::text,
    yr.child_date_of_birth, yr.parent_first_name, yr.parent_last_name,
    yr.created_at::date AS registered_on, yr.approved_for_attendance,
    COUNT(ar.id) AS attendance_count, MIN(ar.check_in_date) AS first_attendance,
    MAX(ar.check_in_date) AS last_attendance, c.dup_key, c.match_type
  FROM public.youth_registrations yr
  JOIN clustered c ON c.id = yr.id
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id, c.dup_key, c.match_type
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC, yr.created_at ASC;
END;
$$;

COMMIT;
