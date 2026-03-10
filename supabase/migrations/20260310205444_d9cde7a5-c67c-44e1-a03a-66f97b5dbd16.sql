CREATE OR REPLACE FUNCTION public.update_youth_headshot(_registration_id uuid, _headshot_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.youth_registrations
  SET child_headshot_url = _headshot_url,
      updated_at = now()
  WHERE id = _registration_id;
END;
$$;