
-- Create trigger function to auto-assign Lil Champs Corner for Junior Boxers
CREATE OR REPLACE FUNCTION public.auto_assign_lil_champs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.child_boxing_program = 'Junior Boxing (Ages 7-10)' THEN
    NEW.extended_program := 'Lil Champs Corner';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on youth_registrations
CREATE TRIGGER trg_auto_assign_lil_champs
BEFORE INSERT ON public.youth_registrations
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_lil_champs();
