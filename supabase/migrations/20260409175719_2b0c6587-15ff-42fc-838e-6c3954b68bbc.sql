
CREATE TABLE public.callouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  is_bald_eagle BOOLEAN NOT NULL DEFAULT false,
  is_acceptable BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.callouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit callouts"
  ON public.callouts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view callouts"
  ON public.callouts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update callouts"
  ON public.callouts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete callouts"
  ON public.callouts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_callouts_date ON public.callouts (date);
CREATE INDEX idx_callouts_name ON public.callouts (first_name, last_name);
