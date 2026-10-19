-- The Lap checklist, second pass (Josh, 2026-10-19): a line can be a heading
-- with sub-lines under it ("Daily Duties" → "Review Current System", "Videos
-- Needed"), and any line can carry a standing note. Two levels and no more:
-- a sub-line never has children — a trigger refuses it. A note is content,
-- not structure, so it is how a sub-line says more without growing a child.

ALTER TABLE public.lap_checklist_items
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.lap_checklist_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS note      text;
CREATE INDEX IF NOT EXISTS lap_checklist_items_parent_idx ON public.lap_checklist_items (parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lap_checklist_two_levels()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'A checklist line cannot be its own heading';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lap_checklist_items p WHERE p.id = NEW.parent_id AND p.parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'A sub-line cannot have sub-lines: the checklist is two levels';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lap_checklist_items c WHERE c.parent_id = NEW.id) THEN
      RAISE EXCEPTION 'A heading with sub-lines cannot move under another heading';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lap_checklist_items p WHERE p.id = NEW.parent_id AND p.topic_id <> NEW.topic_id) THEN
      RAISE EXCEPTION 'A sub-line belongs to the same checkpoint as its heading';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS lap_checklist_two_levels ON public.lap_checklist_items;
CREATE TRIGGER lap_checklist_two_levels
  BEFORE INSERT OR UPDATE OF parent_id, topic_id ON public.lap_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.lap_checklist_two_levels();

-- The first pass flattened the old level-3 rows as "Parent · Child". Split
-- them back: the heading is the line in the same checkpoint whose title is
-- the part before " · " (it was seeded alongside), the sub-line keeps the
-- part after. Only lines that still carry the separator are touched.
UPDATE public.lap_checklist_items c
   SET parent_id = p.id,
       title     = substring(c.title from position(' · ' in c.title) + 3)
  FROM public.lap_checklist_items p
 WHERE c.parent_id IS NULL
   AND position(' · ' in c.title) > 0
   AND p.topic_id = c.topic_id
   AND p.parent_id IS NULL
   AND p.retired_at IS NULL
   AND p.title = substring(c.title from 1 for position(' · ' in c.title) - 1);

-- Sub-lines are ordered within their heading.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY parent_id ORDER BY sort_order, created_at) - 1 AS n
    FROM public.lap_checklist_items WHERE parent_id IS NOT NULL
)
UPDATE public.lap_checklist_items c SET sort_order = r.n FROM ranked r WHERE r.id = c.id;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY topic_id ORDER BY sort_order, created_at) - 1 AS n
    FROM public.lap_checklist_items WHERE parent_id IS NULL
)
UPDATE public.lap_checklist_items c SET sort_order = r.n FROM ranked r WHERE r.id = c.id;
