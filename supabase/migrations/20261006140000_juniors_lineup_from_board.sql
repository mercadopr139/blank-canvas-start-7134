-- Juniors line-up from the Gym Board.
--
-- Josh or Chrissy fill the blue stools from the board itself, where they are
-- standing. The board has no login, so like Daily Duties these are narrow
-- functions: they touch today's line-up only, for an active role only, and
-- the youth picker is the existing kiosk search (approved, current year).
BEGIN;

CREATE OR REPLACE FUNCTION public.juniors_assign_role(_role_id uuid, _registration_id uuid DEFAULT NULL, _person_name text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.juniors_role_assignments (role_id, session_date, registration_id, person_name)
  SELECT _role_id, public.juniors_today(), _registration_id,
         CASE WHEN _registration_id IS NULL THEN nullif(trim(_person_name), '') ELSE NULL END
  WHERE EXISTS (SELECT 1 FROM public.juniors_roles r WHERE r.id = _role_id AND r.is_active)
    AND (_registration_id IS NOT NULL OR nullif(trim(_person_name), '') IS NOT NULL)
  ON CONFLICT (role_id, session_date) DO UPDATE
    SET registration_id = EXCLUDED.registration_id, person_name = EXCLUDED.person_name;
$$;
GRANT EXECUTE ON FUNCTION public.juniors_assign_role(uuid, uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.juniors_clear_role(_role_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.juniors_role_assignments WHERE role_id = _role_id AND session_date = public.juniors_today();
$$;
GRANT EXECUTE ON FUNCTION public.juniors_clear_role(uuid) TO anon, authenticated;

COMMIT;
