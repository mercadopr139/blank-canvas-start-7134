-- The Lap, weekly goals (Josh, 2026-10-19): a "commitment" is a WEEKLY GOAL
-- on every screen. A goal made from a checklist line remembers the line;
-- when the goal is done — on the Lap or on the Workbench — the line ticks
-- itself for that lap. The Agenda Meeting tile reads "This week's goals".

ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS lap_checklist_item_id uuid REFERENCES public.lap_checklist_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS signals_lap_checklist_item_idx
  ON public.signals (lap_checklist_item_id) WHERE lap_checklist_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.signals_tick_lap_line()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lap_checklist_item_id IS NULL OR NEW.lap_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'Complete' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Complete') THEN
    INSERT INTO public.lap_checklist_ticks (lap_id, item_id)
    VALUES (NEW.lap_id, NEW.lap_checklist_item_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS signals_tick_lap_line ON public.signals;
CREATE TRIGGER signals_tick_lap_line
  AFTER INSERT OR UPDATE OF status ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.signals_tick_lap_line();

UPDATE public.focus_areas
   SET subtitle = 'This week''s goals'
 WHERE key = 'agenda' AND subtitle = 'What we committed to this week';

NOTIFY pgrst, 'reload schema';
SELECT 'Weekly goals know their line' AS result;
