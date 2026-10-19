-- The Lap: a standing checklist under each checkpoint (Josh, 2026-10-19).
--
-- The old agenda's second and third levels were mostly review prompts, not
-- tasks — "S&C included", "Review: Drivers' Schedule" — the same every week
-- and never meant to clear. The Lap had dropped them with the task tree.
-- They come back as ONE flat level per checkpoint: lines that are ticked as
-- they are reviewed, reset every lap (ticks belong to the lap). Anything
-- that needs doing becomes a commitment from the line. No nesting below.

CREATE TABLE IF NOT EXISTS public.lap_checklist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES public.lap_topics(id) ON DELETE CASCADE,
  title       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  /** Removed lines keep their past ticks; they just leave the list. */
  retired_at  timestamptz,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lap_checklist_items_topic_idx ON public.lap_checklist_items (topic_id, sort_order) WHERE retired_at IS NULL;
ALTER TABLE public.lap_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY lap_checklist_items_admin_select ON public.lap_checklist_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_checklist_items_admin_insert ON public.lap_checklist_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_checklist_items_admin_update ON public.lap_checklist_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_checklist_items_admin_delete ON public.lap_checklist_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- A tick is "we looked at this, this lap". Deleting a lap takes its ticks.
CREATE TABLE IF NOT EXISTS public.lap_checklist_ticks (
  lap_id      uuid NOT NULL REFERENCES public.laps(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES public.lap_checklist_items(id) ON DELETE CASCADE,
  ticked_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ticked_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lap_id, item_id)
);
ALTER TABLE public.lap_checklist_ticks ENABLE ROW LEVEL SECURITY;
CREATE POLICY lap_checklist_ticks_admin_select ON public.lap_checklist_ticks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_checklist_ticks_admin_insert ON public.lap_checklist_ticks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_checklist_ticks_admin_delete ON public.lap_checklist_ticks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed from the old agenda, once, while the list is empty: a topic's
-- level-2 rows become lines; level-3 rows flatten to "Parent · Child" so
-- nothing is lost and nothing is nested. Topics match by pillar and title,
-- the way step 1 copied them.
INSERT INTO public.lap_checklist_items (topic_id, title, sort_order)
SELECT t.id,
       CASE WHEN a.depth = 2 THEN a.title ELSE p.title || ' · ' || a.title END,
       row_number() OVER (PARTITION BY t.id ORDER BY
         CASE WHEN a.depth = 2 THEN a.sort_order ELSE p.sort_order END,
         CASE WHEN a.depth = 2 THEN 0 ELSE 1 END,
         a.sort_order, a.created_at) - 1
  FROM public.agenda_items a
  JOIN public.agenda_items p ON p.id = a.parent_id AND NOT p.is_archived
  LEFT JOIN public.agenda_items g ON g.id = p.parent_id
  JOIN public.lap_topics t
    ON t.retired_at IS NULL
   AND t.pillar = a.pillar::text
   AND t.title = CASE WHEN a.depth = 2 THEN p.title ELSE g.title END
 WHERE a.depth IN (2, 3) AND NOT a.is_archived
   AND NOT EXISTS (SELECT 1 FROM public.lap_checklist_items);
