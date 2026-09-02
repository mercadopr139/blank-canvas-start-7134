-- ═══════════════════════════════════════════════════════════════════
-- Duplicate detection: ignore spacing/punctuation in names
-- ═══════════════════════════════════════════════════════════════════
-- "Lopez Perez", "Lopez-Perez", and "LopezPerez" are the same surname. The
-- detector and the merge guard now compare names with all non-alphanumeric
-- characters stripped, so these cluster and can be merged.
--
-- The merge also now carries a dupe's weigh-ins and goal over to the keeper
-- before deleting it, so Weight Watchers data is never lost in a merge.
-- Normalization used everywhere: lower(regexp_replace(x, '[^a-zA-Z0-9]', '', 'g'))

BEGIN;

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
      bool_or(a.id <> b.id AND a.dob_key IS NOT NULL AND a.dob_key = b.dob_key) AS has_dob_partner,
      bool_or(a.id <> b.id) AS has_partner
    FROM base a
    JOIN base b
      ON a.name_key = b.name_key
      OR (a.dob_key IS NOT NULL AND a.dob_key = b.dob_key)
    GROUP BY a.id
  ),
  clustered AS (
    SELECT l.id, l.rep::text AS dup_key,
      CASE WHEN l.has_dob_partner THEN 'strong' ELSE 'possible' END AS match_type
    FROM links l
    WHERE l.has_partner
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

-- Merge: normalize the name guard + carry weigh-ins and goals to the keeper.
CREATE OR REPLACE FUNCTION public.admin_merge_youth_registrations(
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
  _moved bigint; _dropped bigint; _deleted bigint;
  _keeper_fn text; _keeper_ln text; _keeper_dob date; _bad_count bigint;
BEGIN
  PERFORM public.require_admin();

  IF _keeper_id IS NULL THEN RAISE EXCEPTION 'Keeper id is required'; END IF;
  IF _dupe_ids IS NULL OR array_length(_dupe_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one dupe id is required';
  END IF;
  IF _keeper_id = ANY(_dupe_ids) THEN
    RAISE EXCEPTION 'Keeper id cannot also be in the dupe list';
  END IF;

  SELECT lower(regexp_replace(child_first_name, '[^a-zA-Z0-9]', '', 'g')),
         lower(regexp_replace(child_last_name,  '[^a-zA-Z0-9]', '', 'g')),
         child_date_of_birth
    INTO _keeper_fn, _keeper_ln, _keeper_dob
  FROM public.youth_registrations WHERE id = _keeper_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Keeper registration not found'; END IF;

  IF _allow_dob_mismatch THEN
    SELECT COUNT(*) INTO _bad_count FROM public.youth_registrations yr
    WHERE yr.id = ANY(_dupe_ids)
      AND lower(regexp_replace(yr.child_last_name, '[^a-zA-Z0-9]', '', 'g')) <> _keeper_ln;
    IF _bad_count > 0 THEN
      RAISE EXCEPTION 'Refusing to merge — % dupe registration(s) have a different last name than the keeper', _bad_count;
    END IF;
  ELSE
    SELECT COUNT(*) INTO _bad_count FROM public.youth_registrations yr
    WHERE yr.id = ANY(_dupe_ids)
      AND (
        (yr.child_date_of_birth IS NOT NULL AND _keeper_dob IS NOT NULL
          AND yr.child_date_of_birth <> _keeper_dob)
        OR ((yr.child_date_of_birth IS NULL OR _keeper_dob IS NULL)
          AND (lower(regexp_replace(yr.child_first_name, '[^a-zA-Z0-9]', '', 'g')) <> _keeper_fn
            OR lower(regexp_replace(yr.child_last_name,  '[^a-zA-Z0-9]', '', 'g')) <> _keeper_ln))
      );
    IF _bad_count > 0 THEN
      RAISE EXCEPTION 'Refusing to merge — % dupe registration(s) have a different birthday or name than the keeper', _bad_count;
    END IF;
  END IF;

  -- Carry weigh-ins to the keeper (skip a date the keeper already has), drop rest.
  UPDATE public.weigh_ins w SET registration_id = _keeper_id
   WHERE w.registration_id = ANY(_dupe_ids)
     AND NOT EXISTS (
       SELECT 1 FROM public.weigh_ins k
        WHERE k.registration_id = _keeper_id AND k.weigh_date = w.weigh_date
     );
  DELETE FROM public.weigh_ins WHERE registration_id = ANY(_dupe_ids);

  -- Adopt a goal from a dupe only if the keeper doesn't already have one.
  IF NOT EXISTS (SELECT 1 FROM public.weight_goals WHERE registration_id = _keeper_id) THEN
    INSERT INTO public.weight_goals (registration_id, target_weight, kiosk_message, updated_at)
    SELECT _keeper_id, g.target_weight, g.kiosk_message, now()
    FROM public.weight_goals g
    WHERE g.registration_id = ANY(_dupe_ids)
    ORDER BY g.updated_at DESC
    LIMIT 1
    ON CONFLICT (registration_id) DO NOTHING;
  END IF;
  DELETE FROM public.weight_goals WHERE registration_id = ANY(_dupe_ids);

  -- Move attendance, skipping conflicts.
  WITH moved AS (
    UPDATE public.attendance_records ar SET registration_id = _keeper_id
     WHERE ar.registration_id = ANY(_dupe_ids)
       AND NOT EXISTS (
         SELECT 1 FROM public.attendance_records keeper
          WHERE keeper.registration_id = _keeper_id
            AND keeper.check_in_date  = ar.check_in_date
            AND keeper.program_source = ar.program_source
       )
    RETURNING 1
  ) SELECT COUNT(*) INTO _moved FROM moved;

  WITH dropped AS (
    DELETE FROM public.attendance_records WHERE registration_id = ANY(_dupe_ids) RETURNING 1
  ) SELECT COUNT(*) INTO _dropped FROM dropped;

  WITH deleted AS (
    DELETE FROM public.youth_registrations WHERE id = ANY(_dupe_ids) RETURNING 1
  ) SELECT COUNT(*) INTO _deleted FROM deleted;

  attendance_moved := _moved; attendance_dropped := _dropped; registrations_deleted := _deleted;
  RETURN NEXT;
END;
$$;

COMMIT;
