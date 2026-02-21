-- Create the Revenue table
CREATE TABLE public.revenue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supporter_id uuid REFERENCES public.supporters(id) ON DELETE SET NULL,
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  revenue_type text NOT NULL,
  payment_method text,
  invoice_sent boolean NOT NULL DEFAULT false,
  reporting_required boolean NOT NULL DEFAULT false,
  thank_you_sent boolean NOT NULL DEFAULT false,
  thank_you_date date,
  logged_by text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.revenue ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all revenue" ON public.revenue FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create revenue" ON public.revenue FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update revenue" ON public.revenue FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete revenue" ON public.revenue FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update timestamp trigger
CREATE TRIGGER update_revenue_updated_at
  BEFORE UPDATE ON public.revenue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();