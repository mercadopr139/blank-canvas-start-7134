-- ═══════════════════════════════════════════════════════════════════
-- Smarter duplicate-registration detection (name + date of birth)
-- ═══════════════════════════════════════════════════════════════════
-- The old detector grouped purely by first+last name, which (a) lumped two
-- DIFFERENT kids who share a name into one group, and (b) missed the common
-- case where a parent shortens or misspells the name across registrations.
--
-- New rule: the anchor is the DATE OF BIRTH.
--   • If a birthday is present → group by (date_of_birth + last name). Same
--     birthday + same last name = the same kid, even if the FIRST name is
--     spelled differently (Chris vs Christian). Different birthday = a
--     different child, so same-name-different-DOB rows are correctly split.
--   • If a birthday is missing → fall back to exact first+last name.
-- The function now also returns the birthday, the parent name, and a stable
-- `dup_key` so the UI can group and show which kid is which.
--
-- The merge safety-guard is updated to match: it refuses to merge a
-- registration whose birthday differs from the keeper's (with the same
-- name-only fallback when a birthday is missing).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Return signature changed, so drop before recreating.
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
  dup_key                 text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  WITH keyed AS (
    SELECT
      yr.id,
      -- Same birthday + same last name = same kid (first name may be
      -- shortened/misspelled). No birthday → fall back to exact name.
      CASE
        WHEN yr.child_date_of_birth IS NOT NULL
          THEN 'dob:' || yr.child_date_of_birth::text || '|' || LOWER(TRIM(yr.child_last_name))
        ELSE 'name:' || LOWER(TRIM(yr.child_first_name)) || '|' || LOWER(TRIM(yr.child_last_name))
      END AS dup_key
    FROM public.youth_registrations yr
    WHERE yr.child_last_name IS NOT NULL
  ),
  dup_keys AS (
    SELECT k.dup_key
    FROM keyed k
    GROUP BY k.dup_key
    HAVING COUNT(*) > 1
  )
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program::text,
    yr.child_date_of_birth,
    yr.parent_first_name,
    yr.parent_last_name,
    yr.created_at::date AS registered_on,
    yr.approved_for_attendance,
    COUNT(ar.id) AS attendance_count,
    MIN(ar.check_in_date) AS first_attendance,
    MAX(ar.check_in_date) AS last_attendance,
    k.dup_key
  FROM public.youth_registrations yr
  JOIN keyed k     ON k.id = yr.id
  JOIN dup_keys dk ON dk.dup_key = k.dup_key
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id, k.dup_key
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC,
           yr.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_duplicate_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_duplicate_registrations() TO authenticated;

-- ─── Merge: replace the name-only guard with a birthday-aware guard ───
CREATE OR REPLACE FUNCTION public.admin_merge_youth_registrations(
  _keeper_id uuid,
  _dupe_ids  uuid[]
)
RETURNS TABLE (
  attendance_moved      bigint,
  attendance_dropped    bigint,
  registrations_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _moved      bigint;
  _dropped    bigint;
  _deleted    bigint;
  _keeper_fn  text;
  _keeper_ln  text;
  _keeper_dob date;
  _bad_count  bigint;
BEGIN
  PERFORM public.require_admin();

  IF _keeper_id IS NULL THEN
    RAISE EXCEPTION 'Keeper id is required';
  END IF;
  IF _dupe_ids IS NULL OR array_length(_dupe_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one dupe id is required';
  END IF;
  IF _keeper_id = ANY(_dupe_ids) THEN
    RAISE EXCEPTION 'Keeper id cannot also be in the dupe list';
  END IF;

  SELECT LOWER(TRIM(yr.child_first_name)),
         LOWER(TRIM(yr.child_last_name)),
         yr.child_date_of_birth
    INTO _keeper_fn, _keeper_ln, _keeper_dob
  FROM public.youth_registrations yr
  WHERE yr.id = _keeper_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keeper registration not found';
  END IF;

  -- Safety net against a misclick that would merge two different children.
  -- Same birthday = same kid (names may be spelled differently). If a birthday
  -- is missing on either side, require the same name instead.
  SELECT COUNT(*) INTO _bad_count
  FROM public.youth_registrations yr
  WHERE yr.id = ANY(_dupe_ids)
    AND (
      (yr.child_date_of_birth IS NOT NULL AND _keeper_dob IS NOT NULL
        AND yr.child_date_of_birth <> _keeper_dob)
      OR ((yr.child_date_of_birth IS NULL OR _keeper_dob IS NULL)
        AND (LOWER(TRIM(yr.child_first_name)) <> _keeper_fn
          OR LOWER(TRIM(yr.child_last_name))  <> _keeper_ln))
    );

  IF _bad_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to merge — % dupe registration(s) have a different birthday or name than the keeper',
      _bad_count;
  END IF;

  -- 1. Move attendance from dupes to keeper, skipping conflicting rows.
  WITH moved AS (
    UPDATE public.attendance_records ar
       SET registration_id = _keeper_id
     WHERE ar.registration_id = ANY(_dupe_ids)
       AND NOT EXISTS (
         SELECT 1 FROM public.attendance_records keeper
          WHERE keeper.registration_id = _keeper_id
            AND keeper.check_in_date  = ar.check_in_date
            AND keeper.program_source = ar.program_source
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO _moved FROM moved;

  -- 2. Drop attendance rows still attached to dupes (collided with keeper).
  WITH dropped AS (
    DELETE FROM public.attendance_records
     WHERE registration_id = ANY(_dupe_ids)
    RETURNING 1
  )
  SELECT COUNT(*) INTO _dropped FROM dropped;

  -- 3. Delete the dupe registrations.
  WITH deleted AS (
    DELETE FROM public.youth_registrations
     WHERE id = ANY(_dupe_ids)
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deleted FROM deleted;

  attendance_moved      := _moved;
  attendance_dropped    := _dropped;
  registrations_deleted := _deleted;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_merge_youth_registrations(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_merge_youth_registrations(uuid, uuid[]) TO authenticated;

COMMIT;
