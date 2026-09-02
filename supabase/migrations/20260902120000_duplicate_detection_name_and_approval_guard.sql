-- ═══════════════════════════════════════════════════════════════════
-- Catch same-name / different-birthday duplicates + guard approvals
-- ═══════════════════════════════════════════════════════════════════
-- Problem this fixes (reported Sep 2026): a kid can end up with TWO live
-- registration rows — e.g. "Denum Jones" registered twice with a mistyped or
-- missing date of birth. The kiosk then shows two cards; signing into one
-- leaves the other on the roster as absent/no-show.
--
-- The old duplicate detector only clustered rows that shared a BIRTHDAY (or an
-- exact name when no birthday), so a same-name/different-birthday pair was
-- never flagged ("it's not a possible dup") and the merge tool refused to
-- combine them.
--
-- Three changes:
--   1. admin_get_duplicate_registrations() also clusters rows that share an
--      exact first+last name, and labels each cluster:
--        'strong'   — two rows share a birthday (high confidence)
--        'possible' — same name, birthday differs/missing (review carefully)
--   2. admin_merge_youth_registrations() gains _allow_dob_mismatch so a
--      reviewed "possible" pair can be merged (still refuses different LAST
--      names as a floor safety).
--   3. admin_set_registration_approval() — approving a youth now auto-unapproves
--      any OTHER approved row for the same kid (same first+last name AND a shared
--      birthday, parent phone, or parent email). Twins (different first names)
--      and different families who happen to share a name are unaffected.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Detection ────────────────────────────────────────────────────
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
      -- Same birthday + last name is the strong signal (first name may be
      -- shortened/misspelled). The name key catches the reverse case: an exact
      -- first+last name whose birthday was mistyped or left blank.
      CASE WHEN yr.child_date_of_birth IS NOT NULL
        THEN 'dob:' || yr.child_date_of_birth::text || '|' || LOWER(TRIM(yr.child_last_name))
      END AS dob_key,
      'name:' || LOWER(TRIM(yr.child_first_name)) || '|' || LOWER(TRIM(yr.child_last_name)) AS name_key
    FROM public.youth_registrations yr
    WHERE yr.child_last_name IS NOT NULL
      AND TRIM(yr.child_last_name) <> ''
  ),
  -- Link each row to every row it shares a name (or a non-null birthday) with.
  -- rep = smallest id in that neighbourhood → a stable cluster key. Clusters
  -- here are tiny (2–3 rows) and fully connected, so neighbour-min == cluster.
  links AS (
    SELECT
      a.id AS id,
      MIN(b.id) AS rep,
      bool_or(a.id <> b.id AND a.dob_key IS NOT NULL AND a.dob_key = b.dob_key) AS has_dob_partner,
      bool_or(a.id <> b.id) AS has_partner
    FROM base a
    JOIN base b
      ON a.name_key = b.name_key
      OR (a.dob_key IS NOT NULL AND a.dob_key = b.dob_key)
    GROUP BY a.id
  ),
  clustered AS (
    SELECT
      l.id,
      l.rep::text AS dup_key,
      CASE WHEN l.has_dob_partner THEN 'strong' ELSE 'possible' END AS match_type
    FROM links l
    WHERE l.has_partner
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
    c.dup_key,
    c.match_type
  FROM public.youth_registrations yr
  JOIN clustered c ON c.id = yr.id
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id, c.dup_key, c.match_type
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC,
           yr.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_duplicate_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_duplicate_registrations() TO authenticated;

-- ─── 2. Merge with optional birthday-mismatch override ────────────────
-- Drop BOTH the original 2-arg signature and the new 3-arg one so this
-- migration is safe to re-run (idempotent).
DROP FUNCTION IF EXISTS public.admin_merge_youth_registrations(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.admin_merge_youth_registrations(uuid, uuid[], boolean);

CREATE FUNCTION public.admin_merge_youth_registrations(
  _keeper_id          uuid,
  _dupe_ids           uuid[],
  _allow_dob_mismatch boolean DEFAULT false
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

  IF _allow_dob_mismatch THEN
    -- Reviewed same-name pair whose birthday differs. Still never merge across
    -- different LAST names — that would combine two clearly different kids.
    SELECT COUNT(*) INTO _bad_count
    FROM public.youth_registrations yr
    WHERE yr.id = ANY(_dupe_ids)
      AND LOWER(TRIM(yr.child_last_name)) <> _keeper_ln;

    IF _bad_count > 0 THEN
      RAISE EXCEPTION
        'Refusing to merge — % dupe registration(s) have a different last name than the keeper',
        _bad_count;
    END IF;
  ELSE
    -- Default guard: same birthday = same kid (names may differ). Missing
    -- birthday on either side → require the same name instead.
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

REVOKE ALL ON FUNCTION public.admin_merge_youth_registrations(uuid, uuid[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_merge_youth_registrations(uuid, uuid[], boolean) TO authenticated;

-- ─── 3. Approval guard: one approved registration per kid ─────────────
CREATE OR REPLACE FUNCTION public.admin_set_registration_approval(
  _registration_id uuid,
  _approved boolean
)
RETURNS public.youth_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.youth_registrations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.youth_registrations
  SET approved_for_attendance = _approved,
      updated_at = now()
  WHERE id = _registration_id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  -- Guard against a kid ending up with two attendable records (the cause of
  -- doubled kiosk cards / phantom no-shows). When approving, unapprove any
  -- OTHER approved row that is clearly the same child: exact first+last name
  -- AND a shared birthday, parent phone, or parent email. Twins have different
  -- first names, and two unrelated kids who share a name won't share contact
  -- info, so neither is affected.
  IF _approved THEN
    UPDATE public.youth_registrations o
       SET approved_for_attendance = false,
           updated_at = now()
     WHERE o.id <> updated_row.id
       AND o.approved_for_attendance = true
       AND LOWER(TRIM(o.child_first_name)) = LOWER(TRIM(updated_row.child_first_name))
       AND LOWER(TRIM(o.child_last_name))  = LOWER(TRIM(updated_row.child_last_name))
       AND (
            (o.child_date_of_birth IS NOT NULL
              AND updated_row.child_date_of_birth IS NOT NULL
              AND o.child_date_of_birth = updated_row.child_date_of_birth)
         OR (regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g') <> ''
              AND regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g')
                = regexp_replace(COALESCE(updated_row.parent_phone, ''), '\D', '', 'g'))
         OR (LOWER(TRIM(COALESCE(o.parent_email, ''))) <> ''
              AND LOWER(TRIM(COALESCE(o.parent_email, '')))
                = LOWER(TRIM(COALESCE(updated_row.parent_email, ''))))
       );
  END IF;

  RETURN updated_row;
END;
$$;

COMMIT;
