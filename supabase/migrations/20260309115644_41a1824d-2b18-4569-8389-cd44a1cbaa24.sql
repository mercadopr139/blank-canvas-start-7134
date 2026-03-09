
CREATE TABLE public.upcoming_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.upcoming_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all upcoming_events" ON public.upcoming_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create upcoming_events" ON public.upcoming_events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update upcoming_events" ON public.upcoming_events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete upcoming_events" ON public.upcoming_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
