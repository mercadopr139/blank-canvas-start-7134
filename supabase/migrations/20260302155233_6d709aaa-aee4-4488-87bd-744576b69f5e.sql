ALTER TABLE public.vision_cloud_items ADD COLUMN sort_order integer NOT NULL DEFAULT 1000;

-- Backfill existing rows based on created_at ascending
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) * 10 AS new_order
  FROM public.vision_cloud_items
)
UPDATE public.vision_cloud_items v
SET sort_order = r.new_order
FROM ranked r
WHERE v.id = r.id;