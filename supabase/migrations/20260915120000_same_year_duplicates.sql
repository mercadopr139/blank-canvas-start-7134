-- A same-year re-submission is a duplicate, even when it has been auto-linked.
--
-- What happened (Liam and Jack Alexander, 2026-09-14): a parent who had
-- registered in August registered again in September, same program year. The
-- insert trigger from 20260902160000 saw the same kid and LINKED the new row to
-- the old one -- the right call for a re-registration across years, the wrong
-- one within a year. Two things then went wrong at once:
--
--   1. Duplicate Registrations hid the pair. It clusters by identity
--      (COALESCE(youth_link_id, id)) and only reports a cluster with more than
--      one identity; a linked pair is one identity, so it looked resolved.
--   2. Re-Registration Approvals could never clear it. The approval guard
--      allows one approved registration per kid per year, so approving the
--      old row un-approved the new one and vice versa -- "they keep reverting".
--
-- FIX 1: the detector also reports two rows that share an identity AND a
-- program year. That can only be a same-year duplicate (or a wrong link); it
-- is never twins, who never share an identity.
--
-- FIX 2: the merge repoints youth_link_id. It deleted dupes without touching
-- links, so merging a linked pair would have left the keeper pointing at a
-- row that no longer existed. Rows that linked to a dupe now link to the
-- keeper; a keeper that linked to a dupe becomes its own identity.
--
-- Also carried across in a merge, which they were not before: duty
-- assignments (they cascade-deleted with the dupe) and NBT logs (they were
-- set to null).

BEGIN;

-- ── Fix 1: the detector ──────────────────────────────────────────────────
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
      MIN(b.id) AS rep,
      bool_or(
        a.id <> b.id AND a.dob_key IS NOT NULL AND a.dob_key = b.dob_key
        AND public.first_name_compatible(a.fn, b.fn)
      ) AS has_dob_partner,
      COUNT(DISTINCT b.identity) AS identity_count,
      -- The same kid, twice, in the same year. Linked or not, that is a duplicate.
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
    SELECT l.id, l.rep::text AS dup_key,
      CASE WHEN l.has_dob_partner OR l.same_year_twin THEN 'strong' ELSE 'possible' END AS match_type
    FROM links l
    WHERE l.identity_count > 1 OR l.same_year_twin
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

-- ── Fix 2: the merge ─────────────────────────────────────────────────────
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

  -- Duty assignments: move to the keeper, skip a job+night the keeper already has.
  UPDATE public.duty_assignments d SET registration_id = _keeper_id
   WHERE d.registration_id = ANY(_dupe_ids)
     AND NOT EXISTS (
       SELECT 1 FROM public.duty_assignments k
        WHERE k.registration_id = _keeper_id AND k.job_id = d.job_id AND k.duty_date = d.duty_date
     );
  DELETE FROM public.duty_assignments WHERE registration_id = ANY(_dupe_ids);

  -- NBT logs: same, one per athlete per session.
  UPDATE public.nbt_logs l SET registration_id = _keeper_id
   WHERE l.registration_id = ANY(_dupe_ids)
     AND NOT EXISTS (
       SELECT 1 FROM public.nbt_logs k
        WHERE k.registration_id = _keeper_id AND k.workout_date = l.workout_date
     );
  DELETE FROM public.nbt_logs WHERE registration_id = ANY(_dupe_ids);

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

  -- Links: whatever pointed at a dupe now points at the keeper, and the keeper
  -- never points at a row about to be deleted -- it becomes its own identity.
  UPDATE public.youth_registrations SET youth_link_id = _keeper_id
   WHERE youth_link_id = ANY(_dupe_ids) AND id <> _keeper_id;
  UPDATE public.youth_registrations SET youth_link_id = NULL
   WHERE id = _keeper_id AND youth_link_id = ANY(_dupe_ids);

  WITH deleted AS (
    DELETE FROM public.youth_registrations WHERE id = ANY(_dupe_ids) RETURNING 1
  ) SELECT COUNT(*) INTO _deleted FROM deleted;

  attendance_moved := _moved; attendance_dropped := _dropped; registrations_deleted := _deleted;
  RETURN NEXT;
END;
$$;

COMMIT;
