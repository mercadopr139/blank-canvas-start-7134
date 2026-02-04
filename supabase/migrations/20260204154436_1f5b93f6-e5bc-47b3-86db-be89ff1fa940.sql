-- Create client_services table for storing multiple services per client
CREATE TABLE public.client_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('per_hour', 'per_day', 'per_session', 'flat_fee')),
  rate_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin access
CREATE POLICY "Admins can view all client_services"
ON public.client_services
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create client_services"
ON public.client_services
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update client_services"
ON public.client_services
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete client_services"
ON public.client_services
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups by client
CREATE INDEX idx_client_services_client_id ON public.client_services(client_id);

-- Create trigger for updated_at
CREATE TRIGGER update_client_services_updated_at
BEFORE UPDATE ON public.client_services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();