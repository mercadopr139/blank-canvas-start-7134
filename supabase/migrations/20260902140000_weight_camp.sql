-- ═══════════════════════════════════════════════════════════════════
-- Weight Watchers: training-camp fight date (team-wide countdown)
-- ═══════════════════════════════════════════════════════════════════
-- One current camp for the whole team (e.g. "USA vs IRL", fight date Sep 24).
-- The kiosk pop-up and the admin table count down to it. Single-row settings
-- table (like kiosk_settings) — set it once per camp.

BEGIN;

CREATE TABLE IF NOT EXISTS public.weight_camp (
  id         boolean PRIMARY KEY DEFAULT true,
  camp_name  text,
  fight_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_camp_singleton CHECK (id)
);
INSERT INTO public.weight_camp (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weight_camp ENABLE ROW LEVEL SECURITY;

-- Staff read + edit the camp. anon has no direct access; the kiosk gets the
-- camp back through record_weigh_in (below).
DROP POLICY IF EXISTS weight_camp_auth_all ON public.weight_camp;
CREATE POLICY weight_camp_auth_all ON public.weight_camp
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Re-create the kiosk save RPC so it also returns the current camp for the
-- weigh-in pop-up countdown. (Return columns changed, so drop first.)
DROP FUNCTION IF EXISTS public.record_weigh_in(uuid, numeric);

CREATE FUNCTION public.record_weigh_in(_registration_id uuid, _weight numeric)
RETURNS TABLE (
  child_first_name text,
  child_last_name  text,
  weight_lb        numeric,
  target_weight    numeric,
  kiosk_message    text,
  previous_weight  numeric,
  previous_date    date,
  camp_name        text,
  fight_date       date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today   date := (now() AT TIME ZONE 'America/New_York')::date;
  _reg     public.youth_registrations;
  _prev_w  numeric;
  _prev_d  date;
  _camp_nm text;
  _camp_dt date;
BEGIN
  IF _weight IS NULL OR _weight <= 0 OR _weight >= 1000 THEN
    RAISE EXCEPTION 'Please enter a valid weight';
  END IF;

  SELECT * INTO _reg FROM public.youth_registrations WHERE id = _registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Youth not found';
  END IF;

  IF _reg.approved_for_attendance IS NOT TRUE
     OR NOT public.passes_kiosk_year_gate(_reg.program_year, _reg.archived_at) THEN
    RAISE EXCEPTION 'This youth is not active for weigh-in';
  END IF;

  SELECT w.weight_lb, w.weigh_date INTO _prev_w, _prev_d
  FROM public.weigh_ins w
  WHERE w.registration_id = _registration_id AND w.weigh_date < _today
  ORDER BY w.weigh_date DESC
  LIMIT 1;

  INSERT INTO public.weigh_ins (registration_id, weigh_date, weight_lb)
  VALUES (_registration_id, _today, round(_weight, 2))
  ON CONFLICT (registration_id, weigh_date)
  DO UPDATE SET weight_lb = EXCLUDED.weight_lb, updated_at = now();

  SELECT c.camp_name, c.fight_date INTO _camp_nm, _camp_dt
  FROM public.weight_camp c WHERE c.id;

  RETURN QUERY
  SELECT r.child_first_name, r.child_last_name, round(_weight, 2)::numeric,
         g.target_weight, g.kiosk_message, _prev_w, _prev_d, _camp_nm, _camp_dt
  FROM public.youth_registrations r
  LEFT JOIN public.weight_goals g ON g.registration_id = r.id
  WHERE r.id = _registration_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_weigh_in(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_weigh_in(uuid, numeric) TO anon, authenticated;

COMMIT;
