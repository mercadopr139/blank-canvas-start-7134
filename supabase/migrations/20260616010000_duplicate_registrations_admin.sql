-- ═══════════════════════════════════════════════════════════════════
-- Duplicate Youth Registrations — admin tool
-- ═══════════════════════════════════════════════════════════════════
-- Adds two RPCs that power the Admin → Operations → Duplicate
-- Registrations page:
--
--   1. admin_get_duplicate_registrations() — returns every registration
--      row whose (first_name, last_name) is shared by 2+ rows, with
--      attendance counts so the UI can recommend a keeper.
--
--   2. admin_merge_youth_registrations(keeper, dupes[]) — wraps the
--      manual merge transaction:
--        a. move attendance from dupes to keeper, skipping rows that
--           would collide on (registration_id, check_in_date,
--           program_source) — the unique constraint
--        b. delete any leftover attendance rows on the dupes (they
--           collided with keeper records, so they're true duplicates)
--        c. delete the dupe registrations
--      Returns stats so the UI can show "X moved, Y dropped".
--
-- Both are admin-only via the require_admin() guard from Phase A.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) List every registration whose name has duplicates ────────────
CREATE OR REPLACE FUNCTION public.admin_get_duplicate_registrations()
RETURNS TABLE (
  id uuid,
  child_first_name text,
  child_last_name text,
  child_boxing_program text,
  registered_on date,
  approved_for_attendance boolean,
  attendance_count bigint,
  first_attendance date,
  last_attendance date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();

  RETURN QUERY
  WITH dupe_names AS (
    SELECT
      LOWER(TRIM(yr.child_first_name)) AS fn,
      LOWER(TRIM(yr.child_last_name))  AS ln
    FROM public.youth_registrations yr
    WHERE yr.child_first_name IS NOT NULL
      AND yr.child_last_name  IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  )
  SELECT
    yr.id,
    yr.child_first_name,
    yr.child_last_name,
    yr.child_boxing_program::text,
    yr.created_at::date AS registered_on,
    yr.approved_for_attendance,
    COUNT(ar.id) AS attendance_count,
    MIN(ar.check_in_date) AS first_attendance,
    MAX(ar.check_in_date) AS last_attendance
  FROM public.youth_registrations yr
  JOIN dupe_names dn
    ON LOWER(TRIM(yr.child_first_name)) = dn.fn
   AND LOWER(TRIM(yr.child_last_name))  = dn.ln
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC,
           yr.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_duplicate_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_duplicate_registrations() TO authenticated;

-- ─── 2) Merge dupes into a keeper ────────────────────────────────────
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

  -- Sanity check: every dupe must share the keeper's normalized name.
  -- This is the last line of defense against a misclick that would
  -- silently merge two unrelated kids.
  SELECT LOWER(TRIM(yr.child_first_name)),
         LOWER(TRIM(yr.child_last_name))
    INTO _keeper_fn, _keeper_ln
  FROM public.youth_registrations yr
  WHERE yr.id = _keeper_id;

  IF _keeper_fn IS NULL THEN
    RAISE EXCEPTION 'Keeper registration not found';
  END IF;

  SELECT COUNT(*) INTO _bad_count
  FROM public.youth_registrations yr
  WHERE yr.id = ANY(_dupe_ids)
    AND (LOWER(TRIM(yr.child_first_name)) <> _keeper_fn
      OR LOWER(TRIM(yr.child_last_name))  <> _keeper_ln);

  IF _bad_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to merge — % dupe registration(s) have a different name than the keeper',
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

  -- 2. Drop attendance rows still attached to dupes (those that collided
  --    with a keeper record — they're true duplicates).
  WITH dropped AS (
    DELETE FROM public.attendance_records
     WHERE registration_id = ANY(_dupe_ids)
    RETURNING 1
  )
  SELECT COUNT(*) INTO _dropped FROM dropped;

  -- 3. Delete the dupe registrations. excursion_vehicle_assignments
  --    cascades; callouts.registration_id is ON DELETE SET NULL.
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
