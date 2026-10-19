-- The Lap, step 2: decisions. A checkpoint can hold a one-line "we decided",
-- separate from any task, kept on the lap's record (docs/LAP_PLAN.md).
CREATE TABLE IF NOT EXISTS public.lap_decisions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lap_id      uuid NOT NULL REFERENCES public.laps(id) ON DELETE CASCADE,
  topic_id    uuid REFERENCES public.lap_topics(id) ON DELETE SET NULL,
  text        text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lap_decisions_lap_idx ON public.lap_decisions (lap_id, created_at);
ALTER TABLE public.lap_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY lap_decisions_admin_select ON public.lap_decisions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_decisions_admin_insert ON public.lap_decisions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_decisions_admin_update ON public.lap_decisions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_decisions_admin_delete ON public.lap_decisions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
