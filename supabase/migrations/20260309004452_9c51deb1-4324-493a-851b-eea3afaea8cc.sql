-- Fix search_path for the trigger function
CREATE OR REPLACE FUNCTION public.validate_headshot_only_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins to update anything
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::app_role
  ) THEN
    RETURN NEW;
  END IF;

  -- For non-admins (kiosk users), only allow headshot_url changes
  IF (
    NEW.child_first_name IS DISTINCT FROM OLD.child_first_name OR
    NEW.child_last_name IS DISTINCT FROM OLD.child_last_name OR
    NEW.parent_first_name IS DISTINCT FROM OLD.parent_first_name OR
    NEW.parent_last_name IS DISTINCT FROM OLD.parent_last_name OR
    NEW.parent_phone IS DISTINCT FROM OLD.parent_phone OR
    NEW.parent_email IS DISTINCT FROM OLD.parent_email OR
    NEW.child_date_of_birth IS DISTINCT FROM OLD.child_date_of_birth OR
    NEW.child_sex IS DISTINCT FROM OLD.child_sex OR
    NEW.child_boxing_program IS DISTINCT FROM OLD.child_boxing_program OR
    NEW.child_school_district IS DISTINCT FROM OLD.child_school_district OR
    NEW.child_race_ethnicity IS DISTINCT FROM OLD.child_race_ethnicity OR
    NEW.household_income_range IS DISTINCT FROM OLD.household_income_range OR
    NEW.adults_in_household IS DISTINCT FROM OLD.adults_in_household OR
    NEW.siblings_in_household IS DISTINCT FROM OLD.siblings_in_household OR
    NEW.approved_for_attendance IS DISTINCT FROM OLD.approved_for_attendance OR
    NEW.is_bald_eagle IS DISTINCT FROM OLD.is_bald_eagle
  ) THEN
    RAISE EXCEPTION 'Kiosk users can only update headshot URL';
  END IF;

  RETURN NEW;
END;
$$;