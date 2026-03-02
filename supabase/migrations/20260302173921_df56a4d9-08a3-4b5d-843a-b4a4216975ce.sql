
ALTER TABLE public.signals ADD COLUMN deck_sort_order integer DEFAULT 1000;

-- Backfill existing On Deck items (date_assigned IS NULL, status = 'Pending', is_archived = false, is_trashed = false)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) * 10 AS new_order
  FROM public.signals
  WHERE date_assigned IS NULL
    AND status = 'Pending'
    AND is_archived = false
    AND is_trashed = false
)
UPDATE public.signals s
SET deck_sort_order = r.new_order
FROM ranked r
WHERE s.id = r.id;
