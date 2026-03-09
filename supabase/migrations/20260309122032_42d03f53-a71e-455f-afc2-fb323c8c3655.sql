-- Auto-assign admin role to Chrissy when she signs up
CREATE OR REPLACE FUNCTION public.auto_assign_admin_chrissy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'chrissycasiello@nolimitsboxingacademy.org' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (fires after insert)
CREATE TRIGGER assign_admin_chrissy
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_chrissy();