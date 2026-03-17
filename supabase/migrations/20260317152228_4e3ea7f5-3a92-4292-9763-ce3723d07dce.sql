CREATE OR REPLACE FUNCTION public.admin_set_registration_approval(
  _registration_id uuid,
  _approved boolean
)
RETURNS public.youth_registrations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.youth_registrations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.youth_registrations
  SET approved_for_attendance = _approved,
      updated_at = now()
  WHERE id = _registration_id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  RETURN updated_row;
END;
$$;