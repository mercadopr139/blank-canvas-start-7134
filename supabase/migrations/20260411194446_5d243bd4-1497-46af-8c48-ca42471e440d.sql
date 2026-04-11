
CREATE TABLE public.transport_impact_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_name TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  report_data JSONB,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transport_impact_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view transport_impact_reports"
  ON public.transport_impact_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create transport_impact_reports"
  ON public.transport_impact_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update transport_impact_reports"
  ON public.transport_impact_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete transport_impact_reports"
  ON public.transport_impact_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
