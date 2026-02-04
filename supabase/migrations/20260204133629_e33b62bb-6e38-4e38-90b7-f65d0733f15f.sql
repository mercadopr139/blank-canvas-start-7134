-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create rate_type enum
CREATE TYPE public.rate_type AS ENUM ('per_day', 'per_session', 'per_hour', 'flat_monthly');

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  contact_name TEXT,
  billing_email TEXT,
  phone TEXT,
  billing_address TEXT,
  rate_type rate_type,
  rate_amount NUMERIC(10, 2),
  service_description_default TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Only admins can view clients
CREATE POLICY "Admins can view all clients"
ON public.clients
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can create clients
CREATE POLICY "Admins can create clients"
ON public.clients
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update clients
CREATE POLICY "Admins can update clients"
ON public.clients
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete clients
CREATE POLICY "Admins can delete clients"
ON public.clients
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();