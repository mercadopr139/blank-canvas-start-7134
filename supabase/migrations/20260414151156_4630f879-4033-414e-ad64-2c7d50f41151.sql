
-- meal_events table
CREATE TABLE public.meal_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date date NOT NULL UNIQUE,
  donor_name text,
  notes text,
  meal_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meal_events" ON public.meal_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert meal_events" ON public.meal_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update meal_events" ON public.meal_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete meal_events" ON public.meal_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Anon can read today meal_event" ON public.meal_events FOR SELECT TO anon USING (event_date = CURRENT_DATE);

CREATE TRIGGER update_meal_events_updated_at BEFORE UPDATE ON public.meal_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- meal_items table
CREATE TABLE public.meal_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_event_id uuid NOT NULL REFERENCES public.meal_events(id) ON DELETE CASCADE,
  food_name text NOT NULL,
  usda_fdc_id text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  sugar_g numeric,
  serving_description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meal_items" ON public.meal_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert meal_items" ON public.meal_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update meal_items" ON public.meal_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete meal_items" ON public.meal_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Anon can read today meal_items" ON public.meal_items FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.meal_events me WHERE me.id = meal_event_id AND me.event_date = CURRENT_DATE)
);

-- meal_checkins table
CREATE TABLE public.meal_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_event_id uuid NOT NULL REFERENCES public.meal_events(id) ON DELETE CASCADE,
  tapped_at timestamp with time zone NOT NULL DEFAULT now(),
  tapped_by uuid
);

ALTER TABLE public.meal_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert meal_checkins" ON public.meal_checkins FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can read meal_checkins" ON public.meal_checkins FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can view meal_checkins" ON public.meal_checkins FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete meal_checkins" ON public.meal_checkins FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can insert meal_checkins" ON public.meal_checkins FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Enable realtime for meal_checkins
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_checkins;

-- RPC: increment_meal_count
CREATE OR REPLACE FUNCTION public.increment_meal_count(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO public.meal_checkins (meal_event_id) VALUES (_event_id);
  UPDATE public.meal_events SET meal_count = meal_count + 1, updated_at = now() WHERE id = _event_id RETURNING meal_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_meal_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_meal_count(uuid) TO authenticated;

-- RPC: decrement_meal_count
CREATE OR REPLACE FUNCTION public.decrement_meal_count(_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
  last_checkin_id uuid;
BEGIN
  SELECT id INTO last_checkin_id FROM public.meal_checkins WHERE meal_event_id = _event_id ORDER BY tapped_at DESC LIMIT 1;
  IF last_checkin_id IS NOT NULL THEN
    DELETE FROM public.meal_checkins WHERE id = last_checkin_id;
    UPDATE public.meal_events SET meal_count = GREATEST(meal_count - 1, 0), updated_at = now() WHERE id = _event_id RETURNING meal_count INTO new_count;
  ELSE
    SELECT meal_count INTO new_count FROM public.meal_events WHERE id = _event_id;
  END IF;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_meal_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.decrement_meal_count(uuid) TO authenticated;

-- RPC: get_meal_report
CREATE OR REPLACE FUNCTION public.get_meal_report(_start_date date, _end_date date)
RETURNS TABLE(
  event_id uuid,
  event_date date,
  donor_name text,
  meal_count integer,
  notes text,
  total_calories numeric,
  total_protein numeric,
  total_carbs numeric,
  total_fat numeric,
  item_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    me.id as event_id,
    me.event_date,
    me.donor_name,
    me.meal_count,
    me.notes,
    COALESCE(SUM(mi.calories), 0) as total_calories,
    COALESCE(SUM(mi.protein_g), 0) as total_protein,
    COALESCE(SUM(mi.carbs_g), 0) as total_carbs,
    COALESCE(SUM(mi.fat_g), 0) as total_fat,
    COUNT(mi.id) as item_count
  FROM public.meal_events me
  LEFT JOIN public.meal_items mi ON mi.meal_event_id = me.id
  WHERE me.event_date BETWEEN _start_date AND _end_date
  GROUP BY me.id, me.event_date, me.donor_name, me.meal_count, me.notes
  ORDER BY me.event_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_meal_report(date, date) TO authenticated;
