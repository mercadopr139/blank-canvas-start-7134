-- Juniors line-up: a role can be held by an adult coach, typed by name.
--
-- The three head-coach roles are adults, not registered youth, so an
-- assignment is now EITHER a youth registration OR a typed name. The board
-- shows a typed name without a photo.
BEGIN;

ALTER TABLE public.juniors_role_assignments
  ALTER COLUMN registration_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS person_name text;

ALTER TABLE public.juniors_role_assignments DROP CONSTRAINT IF EXISTS juniors_role_assignments_someone;
ALTER TABLE public.juniors_role_assignments
  ADD CONSTRAINT juniors_role_assignments_someone
  CHECK (registration_id IS NOT NULL OR (person_name IS NOT NULL AND length(trim(person_name)) > 0));

-- The return columns change, so the function must be dropped, not replaced.
DROP FUNCTION IF EXISTS public.get_juniors_lineup(date);
CREATE FUNCTION public.get_juniors_lineup(_date date)
RETURNS TABLE (role_id uuid, registration_id uuid, person_name text, child_first_name text, child_last_name text, child_headshot_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.role_id, a.registration_id, a.person_name, r.child_first_name, r.child_last_name, r.child_headshot_url
  FROM public.juniors_role_assignments a
  LEFT JOIN public.youth_registrations r ON r.id = a.registration_id
  WHERE a.session_date = _date;
$$;
GRANT EXECUTE ON FUNCTION public.get_juniors_lineup(date) TO anon, authenticated;

COMMIT;
