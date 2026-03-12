
-- Enable RLS on service_types
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view all service_types"
  ON public.service_types FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create service_types"
  ON public.service_types FOR INSERT
  TO public
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update service_types"
  ON public.service_types FOR UPDATE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service_types"
  ON public.service_types FOR DELETE
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));
