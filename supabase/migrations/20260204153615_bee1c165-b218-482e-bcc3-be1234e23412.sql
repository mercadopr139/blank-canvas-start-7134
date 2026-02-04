-- Create service_types table for predefined services with rates
CREATE TABLE public.service_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_hour', 'per_day', 'per_session', 'flat_fee')),
  rate_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view all service types"
ON public.service_types
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create service types"
ON public.service_types
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service types"
ON public.service_types
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service types"
ON public.service_types
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add service_type_id column to service_logs for linking to predefined service types
ALTER TABLE public.service_logs 
ADD COLUMN service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;

-- Insert the initial service types
INSERT INTO public.service_types (name, rate_type, rate_amount, description) VALUES
  ('Youth Basketball Practice (WCA)', 'per_hour', 100, 'Youth basketball practice sessions at WCA'),
  ('Program Supervision', 'per_hour', 50, 'Program supervision services'),
  ('Administrative Support', 'flat_fee', 150, 'Administrative support services');

-- Create trigger for updated_at
CREATE TRIGGER update_service_types_updated_at
BEFORE UPDATE ON public.service_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();