-- Re-registrations link themselves; same-year re-submissions do not.
--
-- The auto-link trigger from 20260902160000 linked a new registration to an
-- older one when the name AND birthday matched, in any program year. Two
-- things it got wrong, both seen on 2026-09-15:
--
--   1. A parent who mistyped the birthday on re-registration (Leila Leao's
--      came in as the sign-up date; Jaymi Ginyard's year as 2002) was NOT
--      linked, so four re-registrations landed on the Duplicates page as
--      "birthday differs" for a human to sort out.
--   2. A parent who re-submitted the SAME year (Liam and Jack Alexander) WAS
--      linked -- which is the wrong call within a year. A same-year second
--      registration is a duplicate to merge, not a re-registration to link,
--      and linking it hid it from the Duplicates page.
--
-- Now: the trigger links only ACROSS program years, and it matches on the
-- name plus ANY ONE of birthday, parent email or parent phone. Twins share a
-- last name and a parent but not a first name, so they never link.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_youth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _fn text := lower(regexp_replace(coalesce(NEW.child_first_name,''), '[^a-zA-Z0-9]', '', 'g'));
  _ln text := lower(regexp_replace(coalesce(NEW.child_last_name,''),  '[^a-zA-Z0-9]', '', 'g'));
  _email text := lower(trim(coalesce(NEW.parent_email, '')));
  _phone text := regexp_replace(coalesce(NEW.parent_phone, ''), '\D', '', 'g');
BEGIN
  IF _fn = '' OR _ln = '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(o.youth_link_id, o.id) INTO _existing
  FROM public.youth_registrations o
  WHERE o.id <> NEW.id
    -- Across years only. The same year is a duplicate, and the Duplicates
    -- page is where a duplicate belongs.
    AND o.program_year IS DISTINCT FROM NEW.program_year
    AND lower(regexp_replace(coalesce(o.child_first_name,''), '[^a-zA-Z0-9]', '', 'g')) = _fn
    AND lower(regexp_replace(coalesce(o.child_last_name,''),  '[^a-zA-Z0-9]', '', 'g')) = _ln
    AND (
         (o.child_date_of_birth IS NOT NULL AND o.child_date_of_birth = NEW.child_date_of_birth)
      OR (_email <> '' AND lower(trim(coalesce(o.parent_email, ''))) = _email)
      OR (_phone <> '' AND regexp_replace(coalesce(o.parent_phone, ''), '\D', '', 'g') = _phone)
    )
  ORDER BY o.created_at ASC
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    NEW.youth_link_id := _existing;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_youth_link ON public.youth_registrations;
CREATE TRIGGER trg_set_youth_link
  BEFORE INSERT OR UPDATE OF child_first_name, child_last_name, child_date_of_birth, parent_email, parent_phone
  ON public.youth_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_youth_link();

COMMIT;
