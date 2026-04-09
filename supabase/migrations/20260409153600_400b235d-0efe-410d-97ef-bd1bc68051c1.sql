
-- Create practice_days table to track which days are practice days
CREATE TABLE public.practice_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  is_practice_day boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.practice_days ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can view practice_days"
  ON public.practice_days FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert practice_days"
  ON public.practice_days FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update practice_days"
  ON public.practice_days FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete practice_days"
  ON public.practice_days FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger for updated_at
CREATE TRIGGER update_practice_days_updated_at
  BEFORE UPDATE ON public.practice_days
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index on date for fast lookups
CREATE INDEX idx_practice_days_date ON public.practice_days (date);
