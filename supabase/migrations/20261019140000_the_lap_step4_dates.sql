-- The Lap, step 4: dates the system does not otherwise know — a 990 due
-- date, an insurance renewal, a USA Boxing deadline — for the two-week
-- "coming up" strip at the start line (docs/LAP_PLAN.md). Program events,
-- excursions and grant due dates come from their own tables.
CREATE TABLE IF NOT EXISTS public.lap_dates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  on_date     date NOT NULL,
  pillar      text CHECK (pillar IN ('operations', 'sales_marketing', 'finance')),
  topic_id    uuid REFERENCES public.lap_topics(id) ON DELETE SET NULL,
  /** 'year' repeats it on the same month and day every year; null is once. */
  recurring_every text CHECK (recurring_every IN ('year')),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lap_dates_on_date_idx ON public.lap_dates (on_date);
ALTER TABLE public.lap_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY lap_dates_admin_select ON public.lap_dates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_dates_admin_insert ON public.lap_dates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_dates_admin_update ON public.lap_dates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_dates_admin_delete ON public.lap_dates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
