-- Every box clickable (Josh, 2026-10-20): a ticked box in Staff Management
-- gives that person Admin-level reach inside that one app and nothing else.
-- Josh holds the only switch; his circle would report a wrong tick.
--
-- 1. app_tables says which app touches which table — data, so the map can be
--    read and changed without touching a policy.
-- 2. has_table(t): an Admin, or a Staff login holding a box whose app uses t.
-- 3. One "Box holders manage <table>" policy per table that was Admin-only.
--    Tables already open to any login, and the access-control tables, are
--    left alone. Juniors Aftercare keeps its row-scoped youth/attendance
--    policies (Jaime sees her lab's kids only) — its box is not in the map
--    for those two tables.
-- 4. require_app(key) beside require_admin(); the admin-only RPCs each app
--    calls are re-created on it, so a box holder can use the app's buttons.
-- Corner Coach and Staff Management stay Admin / Super Admin by tier.

CREATE TABLE IF NOT EXISTS public.app_tables (
  app_key    text NOT NULL,
  table_name text NOT NULL,
  PRIMARY KEY (app_key, table_name)
);
ALTER TABLE public.app_tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_tables_read ON public.app_tables;
CREATE POLICY app_tables_read ON public.app_tables FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS app_tables_manage ON public.app_tables;
CREATE POLICY app_tables_manage ON public.app_tables FOR ALL TO authenticated
  USING (public.can_manage_access()) WITH CHECK (public.can_manage_access());

DELETE FROM public.app_tables;
INSERT INTO public.app_tables (app_key, table_name) VALUES
  ('app_message_board', 'lap_topics'),
  ('app_the_lap', 'excursions'),
  ('app_the_lap', 'grant_folders'),
  ('app_the_lap', 'lap_checklist_items'),
  ('app_the_lap', 'lap_checklist_ticks'),
  ('app_the_lap', 'lap_dates'),
  ('app_the_lap', 'lap_decisions'),
  ('app_the_lap', 'lap_topics'),
  ('app_the_lap', 'laps'),
  ('app_the_lap', 'meal_events'),
  ('app_the_lap', 'program_events'),
  ('app_the_lap', 'revenue'),
  ('app_the_lap', 'runs'),
  ('app_the_lap', 'signals'),
  ('app_the_lap', 'task_managers'),
  ('app_the_lap', 'youth_registrations'),
  ('app_registration_intelligence', 'youth_registrations'),
  ('app_registrations', 'duplicate_dismissals'),
  ('app_registrations', 'registration_form_fields'),
  ('app_registrations', 'youth_registrations'),
  ('app_reregistration', 'youth_registrations'),
  ('app_duplicate_registrations', 'duplicate_dismissals'),
  ('app_registration_form_editor', 'registration_form_fields'),
  ('app_attendance_intelligence', 'attendance_records'),
  ('app_attendance_intelligence', 'callouts'),
  ('app_attendance_intelligence', 'excursions'),
  ('app_attendance_intelligence', 'practice_days'),
  ('app_attendance_intelligence', 'program_events'),
  ('app_attendance_intelligence', 'weather_data'),
  ('app_attendance_intelligence', 'youth_registrations'),
  ('app_program_highlights', 'attendance_records'),
  ('app_program_highlights', 'excursions'),
  ('app_program_highlights', 'program_events'),
  ('app_program_highlights', 'program_highlights_reports'),
  ('app_excursion_intelligence', 'attendance_records'),
  ('app_excursion_intelligence', 'excursion_signups'),
  ('app_excursion_intelligence', 'excursions'),
  ('app_excursion_intelligence', 'youth_registrations'),
  ('app_events_intelligence', 'attendance_records'),
  ('app_events_intelligence', 'program_events'),
  ('app_events_intelligence', 'youth_registrations'),
  ('app_attendance_reports', 'attendance_records'),
  ('app_attendance_reports', 'excursions'),
  ('app_attendance_reports', 'practice_days'),
  ('app_attendance_reports', 'youth_registrations'),
  ('app_callouts', 'callouts'),
  ('app_callouts', 'youth_registrations'),
  ('app_transport_intelligence', 'runs'),
  ('app_transport_intelligence', 'transport_attendance'),
  ('app_transport_intelligence', 'youth_registrations'),
  ('app_transport_drivers', 'drivers'),
  ('app_transport_youth', 'youth_profiles'),
  ('app_transport_youth', 'youth_registrations'),
  ('app_transport_runs', 'driver_pay_periods'),
  ('app_transport_runs', 'drivers'),
  ('app_transport_runs', 'incidents'),
  ('app_transport_runs', 'routes'),
  ('app_transport_runs', 'run_approvals'),
  ('app_transport_runs', 'runs'),
  ('app_transport_runs', 'transport_attendance'),
  ('app_transport_runs', 'youth_profiles'),
  ('app_transport_incidents', 'incidents'),
  ('app_transport_impact_reports', 'driver_pay_periods'),
  ('app_transport_impact_reports', 'run_approvals'),
  ('app_transport_impact_reports', 'runs'),
  ('app_transport_impact_reports', 'transport_attendance'),
  ('app_transport_impact_reports', 'transport_impact_reports'),
  ('app_transport_impact_reports', 'youth_profiles'),
  ('app_transport_impact_reports', 'youth_registrations'),
  ('app_meal_intelligence', 'meal_checkins'),
  ('app_meal_intelligence', 'meal_events'),
  ('app_meal_intelligence', 'meal_items'),
  ('app_meal_setup', 'meal_events'),
  ('app_meal_setup', 'meal_items'),
  ('app_practice_plan', 'board_verse_days'),
  ('app_practice_plan', 'board_verse_weeks'),
  ('app_practice_plan', 'practice_blocks'),
  ('app_practice_plan', 'practice_categories'),
  ('app_practice_plan', 'practice_drills'),
  ('app_practice_plan', 'practice_meeting_points'),
  ('app_practice_plan', 'practice_reminders'),
  ('app_practice_plan', 'practice_settings'),
  ('app_practice_plan', 'practice_spiritual_template'),
  ('app_practice_plan', 'practice_template_blocks'),
  ('app_practice_plan', 'practice_weeks'),
  ('app_daily_duties', 'duty_assignments'),
  ('app_daily_duties', 'duty_jobs'),
  ('app_juniors_session', 'youth_registrations'),
  ('app_weight_watchers', 'youth_registrations'),
  ('app_scripture_coach', 'scripture_sessions'),
  ('app_scripture_coach', 'youth_registrations'),
  ('app_scripture_coach_intelligence', 'scripture_sessions'),
  ('app_hawk_intelligence', 'attendance_records'),
  ('app_hawk_intelligence', 'hawk_squad_attendance'),
  ('app_hawk_intelligence', 'hawk_squad_practice_days'),
  ('app_hawk_intelligence', 'hawk_squad_registrations'),
  ('app_hawk_intelligence', 'hawk_squad_weekly_moments'),
  ('app_hawk_registrations', 'hawk_squad_form_fields'),
  ('app_hawk_registrations', 'hawk_squad_registrations'),
  ('app_hawk_form_editor', 'hawk_squad_form_fields'),
  ('app_bam_intelligence', 'attendance_records'),
  ('app_bam_intelligence', 'bam_attendance'),
  ('app_bam_intelligence', 'bam_practice_days'),
  ('app_bam_intelligence', 'bam_registrations'),
  ('app_bam_intelligence', 'bam_weekly_moments'),
  ('app_bam_registrations', 'bam_form_fields'),
  ('app_bam_registrations', 'bam_registrations'),
  ('app_bam_form_editor', 'bam_form_fields'),
  ('app_forms', 'form_responses'),
  ('app_forms', 'forms'),
  ('app_forms', 'youth_registrations'),
  ('app_revenue', 'donations'),
  ('app_revenue', 'receipt_sends'),
  ('app_revenue', 'revenue'),
  ('app_revenue', 'supporters'),
  ('app_revenue', 'youth_registrations'),
  ('app_master_revenue', 'revenue'),
  ('app_master_revenue', 'supporters'),
  ('app_master_revenue', 'youth_registrations'),
  ('app_supporters', 'donations'),
  ('app_supporters', 'engagements'),
  ('app_supporters', 'revenue'),
  ('app_supporters', 'supporters'),
  ('app_supporters', 'tasks'),
  ('app_engagements', 'engagements'),
  ('app_engagements', 'supporters'),
  ('app_sales_tasks', 'supporters'),
  ('app_sales_tasks', 'tasks'),
  ('app_bulk_outreach', 'supporters'),
  ('app_raffle', 'raffle_batches'),
  ('app_raffle', 'raffle_campaigns'),
  ('app_raffle', 'raffle_payments'),
  ('app_raffle', 'raffle_returns'),
  ('app_raffle', 'revenue'),
  ('app_raffle', 'youth_registrations'),
  ('app_raffle_intelligence', 'raffle_batches'),
  ('app_raffle_intelligence', 'raffle_campaigns'),
  ('app_raffle_intelligence', 'raffle_payments'),
  ('app_raffle_intelligence', 'raffle_returns'),
  ('app_raffle_intelligence', 'youth_registrations'),
  ('app_invoice_quote', 'ad_hoc_docs'),
  ('app_billing', 'client_services'),
  ('app_billing', 'clients'),
  ('app_billing', 'deposit_batches'),
  ('app_billing', 'donations'),
  ('app_billing', 'invoice_approvals'),
  ('app_billing', 'invoice_sends'),
  ('app_billing', 'invoices'),
  ('app_billing', 'service_logs'),
  ('app_billing', 'supporters'),
  ('app_billing', 'youth_registrations'),
  ('app_csbg_invoice', 'csbg_invoices'),
  ('app_csbg_budget', 'csbg_budget_actuals'),
  ('app_csbg_checklist', 'csbg_monthly_checklists'),
  ('app_csbg_dashboard', 'csbg_monthly_checklists'),
  ('app_csbg_submissions', 'csbg_submissions'),
  ('app_document_vault', 'vault_categories'),
  ('app_document_vault', 'vault_documents'),
  ('app_document_vault', 'vault_folders'),
  ('app_grant_coach', 'grant_checklist_items'),
  ('app_grant_coach', 'grant_documents'),
  ('app_grant_coach', 'grant_folders'),
  ('app_grant_coach', 'grant_messages'),
  ('app_grant_coach', 'grant_org_documents'),
  ('app_grant_coach', 'grant_org_fields');

CREATE OR REPLACE FUNCTION public.has_table(_table text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.app_tables t
        WHERE t.table_name = _table AND public.has_app(t.app_key)
      );
$$;
GRANT EXECUTE ON FUNCTION public.has_table(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_app(_key text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_app(_key) THEN
    RAISE EXCEPTION 'This needs the % box' , _key USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.require_app(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_app(text) TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_hoc_docs',
    'attendance_records',
    'bam_attendance',
    'bam_form_fields',
    'bam_practice_days',
    'bam_registrations',
    'bam_weekly_moments',
    'board_verse_days',
    'board_verse_weeks',
    'callouts',
    'client_services',
    'clients',
    'csbg_budget_actuals',
    'csbg_invoices',
    'csbg_monthly_checklists',
    'csbg_submissions',
    'deposit_batches',
    'donations',
    'driver_pay_periods',
    'drivers',
    'duplicate_dismissals',
    'duty_assignments',
    'duty_jobs',
    'engagements',
    'excursion_signups',
    'excursions',
    'form_responses',
    'forms',
    'grant_checklist_items',
    'grant_documents',
    'grant_folders',
    'grant_messages',
    'grant_org_documents',
    'grant_org_fields',
    'hawk_squad_attendance',
    'hawk_squad_form_fields',
    'hawk_squad_practice_days',
    'hawk_squad_registrations',
    'hawk_squad_weekly_moments',
    'incidents',
    'invoice_approvals',
    'invoice_sends',
    'invoices',
    'lap_checklist_items',
    'lap_checklist_ticks',
    'lap_dates',
    'lap_decisions',
    'lap_topics',
    'laps',
    'meal_checkins',
    'meal_events',
    'meal_items',
    'practice_blocks',
    'practice_categories',
    'practice_days',
    'practice_drills',
    'practice_meeting_points',
    'practice_reminders',
    'practice_settings',
    'practice_spiritual_template',
    'practice_template_blocks',
    'practice_weeks',
    'program_events',
    'program_highlights_reports',
    'raffle_batches',
    'raffle_campaigns',
    'raffle_payments',
    'raffle_returns',
    'receipt_sends',
    'registration_form_fields',
    'revenue',
    'routes',
    'run_approvals',
    'runs',
    'scripture_sessions',
    'service_logs',
    'signals',
    'supporters',
    'task_managers',
    'tasks',
    'transport_attendance',
    'transport_impact_reports',
    'vault_categories',
    'vault_documents',
    'vault_folders',
    'weather_data',
    'youth_profiles',
    'youth_registrations'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skipping %, no such table', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "Box holders manage %1$s" ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY "Box holders manage %1$s" ON public.%1$I FOR ALL TO authenticated
         USING (public.has_table(%1$L)) WITH CHECK (public.has_table(%1$L))', t);
  END LOOP;
END $$;

-- The RPCs, on the box instead of the role.
-- admin_add_excursion_personnel (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_add_excursion_personnel(
  _excursion_id uuid,
  _name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  INSERT INTO public.excursion_personnel (excursion_id, name)
  VALUES (_excursion_id, trim(_name))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- admin_add_excursion_vehicle (from 20260808120000_excursion_driver_as_participant.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_add_excursion_vehicle(
  _excursion_id uuid, _name text, _seat_cap integer, _driver_name text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _new_id uuid;
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Vehicle name is required'; END IF;
  IF _seat_cap IS NULL OR _seat_cap <= 0 THEN RAISE EXCEPTION 'Seat capacity must be greater than 0'; END IF;

  INSERT INTO public.excursion_vehicles (excursion_id, name, seat_cap, driver_name)
  VALUES (_excursion_id, trim(_name), _seat_cap, NULLIF(trim(COALESCE(_driver_name, '')), ''))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END; $$;

-- admin_assign_youth_to_vehicle (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_assign_youth_to_vehicle(
  _vehicle_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _seat_cap integer;
  _current_count bigint;
  _already_in_this_vehicle boolean;
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');

  SELECT excursion_id, seat_cap INTO _excursion_id, _seat_cap
  FROM public.excursion_vehicles WHERE id = _vehicle_id;
  IF _excursion_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.excursion_vehicle_assignments
    WHERE vehicle_id = _vehicle_id AND registration_id = _registration_id
  ) INTO _already_in_this_vehicle;

  IF NOT _already_in_this_vehicle THEN
    SELECT COUNT(*) INTO _current_count
    FROM public.excursion_vehicle_assignments
    WHERE vehicle_id = _vehicle_id;
    IF _current_count >= _seat_cap THEN
      RAISE EXCEPTION 'Vehicle is at capacity (% of % seats filled)', _current_count, _seat_cap;
    END IF;
  END IF;

  INSERT INTO public.excursion_vehicle_assignments (excursion_id, vehicle_id, registration_id)
  VALUES (_excursion_id, _vehicle_id, _registration_id)
  ON CONFLICT (excursion_id, registration_id)
  DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id;
END;
$$;

-- admin_record_excursion_attendance (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_record_excursion_attendance(
  _excursion_id uuid,
  _registration_id uuid,
  _check_in_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');

  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, excursion_id
  )
  VALUES (
    _registration_id, _check_in_date, 'Excursion', _excursion_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- admin_remove_excursion_personnel (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_remove_excursion_personnel(_personnel_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');
  DELETE FROM public.excursion_personnel WHERE id = _personnel_id;
END;
$$;

-- admin_remove_excursion_vehicle (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_remove_excursion_vehicle(_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');
  DELETE FROM public.excursion_vehicles WHERE id = _vehicle_id;
END;
$$;

-- admin_unassign_youth_from_vehicle (from 20260616000000_excursion_admin_overrides.sql) → app_excursion_intelligence
CREATE OR REPLACE FUNCTION public.admin_unassign_youth_from_vehicle(
  _excursion_id uuid,
  _registration_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_app('app_excursion_intelligence');
  DELETE FROM public.excursion_vehicle_assignments
   WHERE excursion_id = _excursion_id AND registration_id = _registration_id;
END;
$$;

-- admin_record_event_attendance (from 20260718001000_event_attendance.sql) → app_events_intelligence
CREATE OR REPLACE FUNCTION public.admin_record_event_attendance(
  _event_id uuid,
  _registration_id uuid,
  _check_in_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_app('app_events_intelligence');

  INSERT INTO public.attendance_records (
    registration_id, check_in_date, program_source, event_id
  )
  VALUES (
    _registration_id, _check_in_date, 'Event', _event_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- admin_get_duplicate_registrations (from 20260915130000_duplicate_detector_min_uuid.sql) → app_duplicate_registrations
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
  PERFORM public.require_app('app_duplicate_registrations');

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
      -- Postgres has no min(uuid); the key is text anyway.
      MIN(b.id::text) AS rep,
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
    MAX(ar.check_in_date) AS last_attendance, c.dup_key, c.match_type
  FROM public.youth_registrations yr
  JOIN clustered c ON c.id = yr.id
  LEFT JOIN public.attendance_records ar ON ar.registration_id = yr.id
  GROUP BY yr.id, c.dup_key, c.match_type
  ORDER BY LOWER(TRIM(yr.child_last_name)) ASC,
           LOWER(TRIM(yr.child_first_name)) ASC, yr.created_at ASC;
END;
$$;

-- admin_merge_youth_registrations (from 20260915120000_same_year_duplicates.sql) → app_duplicate_registrations
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
  PERFORM public.require_app('app_duplicate_registrations');

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

-- admin_link_youth (from 20260902160000_youth_identity_linking.sql) → app_duplicate_registrations
CREATE OR REPLACE FUNCTION public.admin_link_youth(_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link uuid;
BEGIN
  PERFORM public.require_app('app_duplicate_registrations');
  IF _ids IS NULL OR array_length(_ids,1) IS NULL OR array_length(_ids,1) < 2 THEN
    RAISE EXCEPTION 'Pick at least two registrations to link';
  END IF;
  -- Canonical id = the oldest registration among the set (or its existing link).
  SELECT COALESCE(youth_link_id, id) INTO _link
  FROM public.youth_registrations WHERE id = ANY(_ids)
  ORDER BY created_at ASC LIMIT 1;
  UPDATE public.youth_registrations SET youth_link_id = _link WHERE id = ANY(_ids);
END;
$$;

-- admin_archive_program_year (from 20260616040000_archive_program_year_rpc.sql) → app_registrations
CREATE OR REPLACE FUNCTION public.admin_archive_program_year(_program_year text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count bigint;
BEGIN
  PERFORM public.require_app('app_registrations');

  IF _program_year IS NULL OR length(trim(_program_year)) = 0 THEN
    RAISE EXCEPTION 'Program year is required';
  END IF;

  WITH archived AS (
    UPDATE public.youth_registrations
       SET archived_at = now()
     WHERE program_year = _program_year
       AND archived_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO _count FROM archived;

  RETURN _count;
END;
$$;

-- admin_set_registration_approval (from 20260904120000_approval_guard_normalize_names.sql) → app_registrations
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

  IF NOT public.has_app('app_registrations') THEN
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
  -- doubled kiosk cards / phantom no-shows / doubled Weight Watchers rows). When
  -- approving, unapprove any OTHER approved row that is clearly the same child:
  -- same first+last name (compared with spacing/punctuation stripped, so
  -- "Lopez Perez" == "LopezPerez") AND a shared birthday, parent phone, or parent
  -- email. Twins have different first names, and two unrelated kids who share a
  -- name won't share contact info, so neither is affected.
  IF _approved THEN
    UPDATE public.youth_registrations o
       SET approved_for_attendance = false,
           updated_at = now()
     WHERE o.id <> updated_row.id
       AND o.approved_for_attendance = true
       AND lower(regexp_replace(o.child_first_name,           '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(updated_row.child_first_name, '[^a-zA-Z0-9]', '', 'g'))
       AND lower(regexp_replace(o.child_last_name,            '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(updated_row.child_last_name,  '[^a-zA-Z0-9]', '', 'g'))
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

-- youth_served_all_programs (from 20260930130000_bam_program.sql) → app_youth_served
CREATE OR REPLACE FUNCTION public.youth_served_all_programs(_from date, _to date)
RETURNS TABLE (nla_youth integer, hawk_youth integer, bam_youth integer, in_both integer, combined integer, in_both_names text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_app('app_youth_served') OR public.is_super_admin()) THEN
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
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.hawk_squad_attendance a JOIN public.hawk_squad_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  bam AS (
    SELECT DISTINCT COALESCE(r.youth_link_id, r.id) AS person,
           lower(trim(r.child_first_name)) AS fn, lower(trim(r.child_last_name)) AS ln, r.child_date_of_birth AS dob,
           r.child_first_name || ' ' || r.child_last_name AS display
    FROM public.bam_attendance a JOIN public.bam_registrations r ON r.id = a.registration_id
    WHERE a.check_in_date BETWEEN _from AND _to
  ),
  hawk_in_nla AS (
    SELECT DISTINCT h.person, h.display FROM hawk h
    WHERE EXISTS (SELECT 1 FROM nla n WHERE n.fn = h.fn AND n.ln = h.ln AND (n.dob IS NULL OR h.dob IS NULL OR n.dob = h.dob))
  ),
  bam_in_nla AS (
    SELECT DISTINCT b.person, b.display FROM bam b
    WHERE EXISTS (SELECT 1 FROM nla n WHERE n.fn = b.fn AND n.ln = b.ln AND (n.dob IS NULL OR b.dob IS NULL OR n.dob = b.dob))
  ),
  bam_in_hawk AS (
    SELECT DISTINCT b.person, b.display FROM bam b
    WHERE EXISTS (SELECT 1 FROM hawk h WHERE h.fn = b.fn AND h.ln = b.ln AND (h.dob IS NULL OR b.dob IS NULL OR h.dob = b.dob))
  ),
  bam_in_all AS (
    SELECT DISTINCT b.person FROM bam_in_hawk b WHERE b.person IN (SELECT person FROM bam_in_nla)
  ),
  counts AS (
    SELECT (SELECT count(DISTINCT person) FROM nla)::integer AS n,
           (SELECT count(DISTINCT person) FROM hawk)::integer AS h,
           (SELECT count(DISTINCT person) FROM bam)::integer AS b,
           (SELECT count(DISTINCT person) FROM hawk_in_nla)::integer AS hn,
           (SELECT count(DISTINCT person) FROM bam_in_nla)::integer AS bn,
           (SELECT count(DISTINCT person) FROM bam_in_hawk)::integer AS bh,
           (SELECT count(DISTINCT person) FROM bam_in_all)::integer AS all3,
           (SELECT COALESCE(array_agg(DISTINCT display ORDER BY display), ARRAY[]::text[])
              FROM (SELECT display FROM hawk_in_nla UNION SELECT display FROM bam_in_nla UNION SELECT display FROM bam_in_hawk) x) AS names
  )
  SELECT c.n, c.h, c.b,
         (c.hn + c.bn + c.bh - 2 * c.all3),
         (c.n + c.h + c.b - c.hn - c.bn - c.bh + c.all3),
         c.names
  FROM counts c;
END;
$$;

-- youth_served_demographics (from 20261003190000_youth_served_demographics.sql) → app_youth_served
CREATE OR REPLACE FUNCTION public.youth_served_demographics(_from date, _to date)
RETURNS TABLE (person uuid, child_sex text, child_race_ethnicity text, free_or_reduced_lunch text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_app('app_youth_served') OR public.is_super_admin()) THEN
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

-- hawk_squad_youth_served (from 20260929150000_hawk_squad_youth_served_fix.sql) → app_youth_served
CREATE OR REPLACE FUNCTION public.hawk_squad_youth_served(_from date, _to date)
RETURNS TABLE (nla_youth integer, hawk_youth integer, in_both integer, combined integer, in_both_names text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_app('app_youth_served') OR public.is_super_admin()) THEN
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

NOTIFY pgrst, 'reload schema';
SELECT 'Every box opens its app' AS result;
