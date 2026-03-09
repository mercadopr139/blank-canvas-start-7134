
-- Create admin allowlist table
CREATE TABLE public.admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage the allowlist
CREATE POLICY "Admins can view allowlist" ON public.admin_allowlist FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert allowlist" ON public.admin_allowlist FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete allowlist" ON public.admin_allowlist FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with approved emails
INSERT INTO public.admin_allowlist (email, added_by) VALUES
  ('joshmercado@nolimitsboxingacademy.org', 'system'),
  ('chrissycasiello@nolimitsboxingacademy.org', 'system');

-- Update the auto-assign trigger to check allowlist instead of hardcoded email
CREATE OR REPLACE FUNCTION public.auto_assign_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS assign_admin_chrissy ON auth.users;
CREATE TRIGGER assign_admin_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_on_signup();
