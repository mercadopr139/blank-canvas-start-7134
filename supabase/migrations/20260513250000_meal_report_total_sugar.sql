-- Extend get_meal_report to also return total_sugar per event. The
-- nutritional-insights dashboard already shows an average-sugar tile
-- (sourced from a separate query); this brings the per-event grid in
-- line so each row can display the sugar that contributed to it.
--
-- The return type changes, so CREATE OR REPLACE won't work — Postgres
-- requires a DROP first when output columns are added/removed. The
-- EXECUTE grant is re-applied at the bottom because DROP wipes it.

DROP FUNCTION IF EXISTS public.get_meal_report(date, date);

CREATE FUNCTION public.get_meal_report(_start_date date, _end_date date)
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
  total_sugar numeric,
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
    COALESCE(SUM(mi.sugar_g), 0) as total_sugar,
    COUNT(mi.id) as item_count
  FROM public.meal_events me
  LEFT JOIN public.meal_items mi ON mi.meal_event_id = me.id
  WHERE me.event_date BETWEEN _start_date AND _end_date
  GROUP BY me.id, me.event_date, me.donor_name, me.meal_count, me.notes
  ORDER BY me.event_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_meal_report(date, date) TO authenticated;
