-- ═══════════════════════════════════════════════════════════════════
-- Weight Watchers: kiosk weigh-ins + weekly tracking + per-boxer goals
-- ═══════════════════════════════════════════════════════════════════
-- Boxers weigh in at a self-serve kiosk (search name → type weight to the
-- tenth, e.g. 105.6). Coaches see the week Mon–Fri in a table, sortable by
-- weight, and can assign each boxer a goal weight + a custom kiosk message
-- (shown in the weigh-in celebration; falls back to a default if unset).

BEGIN;

-- One weight per boxer per day. Re-weighing the same day updates the value.
CREATE TABLE IF NOT EXISTS public.weigh_ins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  weigh_date      date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/New_York')::date),
  weight_lb       numeric(6,2) NOT NULL CHECK (weight_lb > 0 AND weight_lb < 1000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, weigh_date)
);
CREATE INDEX IF NOT EXISTS weigh_ins_date_idx ON public.weigh_ins (weigh_date);
CREATE INDEX IF NOT EXISTS weigh_ins_reg_idx  ON public.weigh_ins (registration_id);

-- Optional per-boxer goal + custom kiosk message (one row per kid).
CREATE TABLE IF NOT EXISTS public.weight_goals (
  registration_id uuid PRIMARY KEY REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  target_weight   numeric(6,2) CHECK (target_weight IS NULL OR (target_weight > 0 AND target_weight < 1000)),
  kiosk_message   text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weigh_ins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_goals ENABLE ROW LEVEL SECURITY;

-- Staff (authenticated) read + manage both tables. anon has no direct table
-- access; the kiosk writes through the SECURITY DEFINER RPC below.
DROP POLICY IF EXISTS weigh_ins_auth_all ON public.weigh_ins;
CREATE POLICY weigh_ins_auth_all ON public.weigh_ins
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS weight_goals_auth_all ON public.weight_goals;
CREATE POLICY weight_goals_auth_all ON public.weight_goals
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Kiosk write path. Records today's weight (upsert) and returns everything the
-- celebration pop-up needs in one round trip: the name, the goal, the custom
-- message, and the previous weigh-in (for the "since last time" line).
CREATE OR REPLACE FUNCTION public.record_weigh_in(_registration_id uuid, _weight numeric)
RETURNS TABLE (
  child_first_name text,
  child_last_name  text,
  weight_lb        numeric,
  target_weight    numeric,
  kiosk_message    text,
  previous_weight  numeric,
  previous_date    date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today  date := (now() AT TIME ZONE 'America/New_York')::date;
  _reg    public.youth_registrations;
  _prev_w numeric;
  _prev_d date;
BEGIN
  IF _weight IS NULL OR _weight <= 0 OR _weight >= 1000 THEN
    RAISE EXCEPTION 'Please enter a valid weight';
  END IF;

  SELECT * INTO _reg FROM public.youth_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Youth not found';
  END IF;

  -- Only approved, current-year (gate-passing) youth may weigh in — same rule
  -- the check-in kiosk uses.
  IF _reg.approved_for_attendance IS NOT TRUE
     OR NOT public.passes_kiosk_year_gate(_reg.program_year, _reg.archived_at) THEN
    RAISE EXCEPTION 'This youth is not active for weigh-in';
  END IF;

  -- Most recent weigh-in BEFORE today (for "down/up X since ...").
  SELECT w.weight_lb, w.weigh_date INTO _prev_w, _prev_d
  FROM public.weigh_ins w
  WHERE w.registration_id = _registration_id AND w.weigh_date < _today
  ORDER BY w.weigh_date DESC
  LIMIT 1;

  INSERT INTO public.weigh_ins (registration_id, weigh_date, weight_lb)
  VALUES (_registration_id, _today, round(_weight, 2))
  ON CONFLICT (registration_id, weigh_date)
  DO UPDATE SET weight_lb = EXCLUDED.weight_lb, updated_at = now();

  RETURN QUERY
  SELECT r.child_first_name,
         r.child_last_name,
         round(_weight, 2)::numeric,
         g.target_weight,
         g.kiosk_message,
         _prev_w,
         _prev_d
  FROM public.youth_registrations r
  LEFT JOIN public.weight_goals g ON g.registration_id = r.id
  WHERE r.id = _registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_weigh_in(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_weigh_in(uuid, numeric) TO anon, authenticated;

COMMIT;
