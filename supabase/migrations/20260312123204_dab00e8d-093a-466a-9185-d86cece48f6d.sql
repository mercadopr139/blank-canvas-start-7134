
ALTER TABLE public.youth_registrations
ADD COLUMN bald_eagle_active boolean NOT NULL DEFAULT true;

-- Auto-activate bald eagle on check-in
CREATE OR REPLACE FUNCTION public.auto_activate_bald_eagle_on_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.youth_registrations
  SET bald_eagle_active = true, updated_at = now()
  WHERE id = NEW.registration_id
    AND is_bald_eagle = true
    AND bald_eagle_active = false;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_activate_bald_eagle
AFTER INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.auto_activate_bald_eagle_on_checkin();
