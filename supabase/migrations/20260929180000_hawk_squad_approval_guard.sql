-- Hawk Squad: one approved registration per student per year.
--
-- The same guard NLA has (admin_set_registration_approval), as a trigger:
-- when a registration is approved, any OTHER approved registration that is
-- clearly the same student is moved back to waiting, so a student never has
-- two attendable records (doubled kiosk cards, doubled counts). "Clearly the
-- same" = same first and last name with spacing/punctuation stripped, AND a
-- shared birthday, parent phone, or parent email. Twins differ by first name;
-- two unrelated students who share a name will not share contact details.
BEGIN;

CREATE OR REPLACE FUNCTION public.hawk_squad_one_approved_per_student()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approved_for_attendance IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  UPDATE public.hawk_squad_registrations o
     SET approved_for_attendance = false,
         updated_at = now()
   WHERE o.id <> NEW.id
     AND o.approved_for_attendance = true
     AND lower(regexp_replace(o.child_first_name,   '[^a-zA-Z0-9]', '', 'g'))
       = lower(regexp_replace(NEW.child_first_name, '[^a-zA-Z0-9]', '', 'g'))
     AND lower(regexp_replace(o.child_last_name,    '[^a-zA-Z0-9]', '', 'g'))
       = lower(regexp_replace(NEW.child_last_name,  '[^a-zA-Z0-9]', '', 'g'))
     AND (
          (o.child_date_of_birth IS NOT NULL AND NEW.child_date_of_birth IS NOT NULL
            AND o.child_date_of_birth = NEW.child_date_of_birth)
       OR (regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g') <> ''
            AND regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g')
              = regexp_replace(COALESCE(NEW.parent_phone, ''), '\D', '', 'g'))
       OR (lower(trim(COALESCE(o.parent_email, ''))) <> ''
            AND lower(trim(COALESCE(o.parent_email, '')))
              = lower(trim(COALESCE(NEW.parent_email, ''))))
     );
  RETURN NEW;
END;
$$;

-- AFTER, so the row being approved is already saved; the update it makes
-- sets approved=false on the others, which does not re-fire this guard.
DROP TRIGGER IF EXISTS trg_hawk_squad_one_approved_per_student ON public.hawk_squad_registrations;
CREATE TRIGGER trg_hawk_squad_one_approved_per_student
  AFTER INSERT OR UPDATE OF approved_for_attendance ON public.hawk_squad_registrations
  FOR EACH ROW WHEN (NEW.approved_for_attendance = true)
  EXECUTE FUNCTION public.hawk_squad_one_approved_per_student();

COMMIT;
