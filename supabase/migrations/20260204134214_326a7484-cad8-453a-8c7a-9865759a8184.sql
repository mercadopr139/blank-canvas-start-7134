-- Create service_logs table
CREATE TABLE public.service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  service_date DATE NOT NULL,
  service_type TEXT DEFAULT 'Fee for Service',
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (client_id, service_date)
);

-- Enable RLS
ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view service_logs
CREATE POLICY "Admins can view all service_logs"
ON public.service_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can create service_logs
CREATE POLICY "Admins can create service_logs"
ON public.service_logs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update service_logs
CREATE POLICY "Admins can update service_logs"
ON public.service_logs
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete service_logs
CREATE POLICY "Admins can delete service_logs"
ON public.service_logs
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_service_logs_updated_at
BEFORE UPDATE ON public.service_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();