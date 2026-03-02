
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS today_sort_order integer DEFAULT 1000;

-- Backfill existing Core items assigned today
WITH ranked_core AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) * 10 AS new_order
  FROM public.signals
  WHERE priority_layer = 'Core' AND date_assigned = CURRENT_DATE AND is_trashed = false AND is_archived = false
)
UPDATE public.signals s SET today_sort_order = r.new_order FROM ranked_core r WHERE s.id = r.id;

-- Backfill existing Bonus items assigned today
WITH ranked_bonus AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) * 10 AS new_order
  FROM public.signals
  WHERE priority_layer = 'Bonus' AND date_assigned = CURRENT_DATE AND is_trashed = false AND is_archived = false
)
UPDATE public.signals s SET today_sort_order = r.new_order FROM ranked_bonus r WHERE s.id = r.id;
