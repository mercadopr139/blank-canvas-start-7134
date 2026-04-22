-- Create tables that were built in Lovable's UI without migration files.
-- This must run before any migrations that ALTER these tables.

CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  rate_type text NOT NULL,
  rate_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_services"
  ON public.client_services
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  rate_type text NOT NULL,
  rate_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage service_types"
  ON public.service_types
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
