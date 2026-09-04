-- ═══════════════════════════════════════════════════════════════════
-- Approval guard: match kid names with punctuation-stripping normalization
-- ═══════════════════════════════════════════════════════════════════
-- When an admin approves a registration, the guard un-approves any OTHER
-- approved row for the SAME kid (so a re-registered youth doesn't end up with
-- two attendable records — the cause of doubled kiosk cards and doubled Weight
-- Watchers rows).
--
-- The guard compared names with exact LOWER(TRIM(...)), so multi-word surnames
-- whose spacing/punctuation differed between the two registrations — "Palacios
-- Bustos" vs "PalaciosBustos", "Martinez-Perez" vs "Martinez Perez" — slipped
-- past it and the old record was never retired. The cross-year LINK trigger uses
-- the stronger normalization lower(regexp_replace(x,'[^a-zA-Z0-9]','','g')), so
-- those kids linked (counted once) but their stale old record stayed "approved".
--
-- This aligns the guard's name match to that same normalization. First name
-- still must match EXACTLY (normalized), so twins — same last name + birthday but
-- different first names — are never cross-retired. Only the name comparison
-- changes; the birthday/phone/email condition and everything else is unchanged.
-- Function-logic change only; no data is modified by this migration.

BEGIN;

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

  -- Guard against a kid ending up with two attendable records (the cause of
  -- doubled kiosk cards / phantom no-shows / doubled Weight Watchers rows). When
  -- approving, unapprove any OTHER approved row that is clearly the same child:
  -- same first+last name (compared with spacing/punctuation stripped, so
  -- "Lopez Perez" == "LopezPerez") AND a shared birthday, parent phone, or parent
  -- email. Twins have different first names, and two unrelated kids who share a
  -- name won't share contact info, so neither is affected.
  IF _approved THEN
    UPDATE public.youth_registrations o
       SET approved_for_attendance = false,
           updated_at = now()
     WHERE o.id <> updated_row.id
       AND o.approved_for_attendance = true
       AND lower(regexp_replace(o.child_first_name,           '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(updated_row.child_first_name, '[^a-zA-Z0-9]', '', 'g'))
       AND lower(regexp_replace(o.child_last_name,            '[^a-zA-Z0-9]', '', 'g'))
         = lower(regexp_replace(updated_row.child_last_name,  '[^a-zA-Z0-9]', '', 'g'))
       AND (
            (o.child_date_of_birth IS NOT NULL
              AND updated_row.child_date_of_birth IS NOT NULL
              AND o.child_date_of_birth = updated_row.child_date_of_birth)
         OR (regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g') <> ''
              AND regexp_replace(COALESCE(o.parent_phone, ''), '\D', '', 'g')
                = regexp_replace(COALESCE(updated_row.parent_phone, ''), '\D', '', 'g'))
         OR (LOWER(TRIM(COALESCE(o.parent_email, ''))) <> ''
              AND LOWER(TRIM(COALESCE(o.parent_email, '')))
                = LOWER(TRIM(COALESCE(updated_row.parent_email, ''))))
       );
  END IF;

  RETURN updated_row;
END;
$$;

COMMIT;
