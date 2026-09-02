-- ═══════════════════════════════════════════════════════════════════
-- Cross-year youth identity linking (unduplicated counts)
-- ═══════════════════════════════════════════════════════════════════
-- A kid who re-registers has one registration row per program year. To count
-- kids ONCE across years (real "unduplicated youth served"), every registration
-- for the same kid shares a `youth_link_id`. A registration's identity is then
-- COALESCE(youth_link_id, id) — so single-registration kids are simply themselves.
--
-- Matching is deterministic and TWIN-SAFE: same normalized first name + last
-- name + birthday. Twins share a birthday and last name but have different first
-- names, so they stay separate. Nickname/typo/missing-birthday cases won't
-- auto-link (they'd just count as two, same as today) and can be linked by hand
-- later — never a silent wrong merge of two different-named kids.

BEGIN;

ALTER TABLE public.youth_registrations ADD COLUMN IF NOT EXISTS youth_link_id uuid;
CREATE INDEX IF NOT EXISTS youth_registrations_link_idx ON public.youth_registrations (youth_link_id);

-- ── Backfill: link existing registrations that are the same kid ──
WITH grp AS (
  SELECT id,
    lower(regexp_replace(coalesce(child_first_name,''), '[^a-zA-Z0-9]', '', 'g')) || '|' ||
    lower(regexp_replace(coalesce(child_last_name,''),  '[^a-zA-Z0-9]', '', 'g')) || '|' ||
    child_date_of_birth::text AS k
  FROM public.youth_registrations
  WHERE child_date_of_birth IS NOT NULL
    AND TRIM(coalesce(child_last_name,''))  <> ''
    AND TRIM(coalesce(child_first_name,'')) <> ''
),
canon AS (
  SELECT k, (MIN(id::text))::uuid AS link_id FROM grp GROUP BY k HAVING COUNT(*) > 1
)
UPDATE public.youth_registrations yr
SET youth_link_id = canon.link_id
FROM grp
JOIN canon ON canon.k = grp.k
WHERE grp.id = yr.id;

-- ── Going forward: auto-link a new/edited registration to the same kid ──
CREATE OR REPLACE FUNCTION public.set_youth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
BEGIN
  IF NEW.child_date_of_birth IS NULL
     OR TRIM(coalesce(NEW.child_first_name,'')) = ''
     OR TRIM(coalesce(NEW.child_last_name,''))  = '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(o.youth_link_id, o.id) INTO _existing
  FROM public.youth_registrations o
  WHERE o.id <> NEW.id
    AND o.child_date_of_birth = NEW.child_date_of_birth
    AND lower(regexp_replace(coalesce(o.child_first_name,''), '[^a-zA-Z0-9]', '', 'g'))
      = lower(regexp_replace(coalesce(NEW.child_first_name,''), '[^a-zA-Z0-9]', '', 'g'))
    AND lower(regexp_replace(coalesce(o.child_last_name,''),  '[^a-zA-Z0-9]', '', 'g'))
      = lower(regexp_replace(coalesce(NEW.child_last_name,''),  '[^a-zA-Z0-9]', '', 'g'))
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
  BEFORE INSERT OR UPDATE OF child_first_name, child_last_name, child_date_of_birth
  ON public.youth_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_youth_link();

-- ── Admin: manually link / unlink registrations (for edge cases) ──
CREATE OR REPLACE FUNCTION public.admin_link_youth(_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _link uuid;
BEGIN
  PERFORM public.require_admin();
  IF _ids IS NULL OR array_length(_ids,1) IS NULL OR array_length(_ids,1) < 2 THEN
    RAISE EXCEPTION 'Pick at least two registrations to link';
  END IF;
  -- Canonical id = the oldest registration among the set (or its existing link).
  SELECT COALESCE(youth_link_id, id) INTO _link
  FROM public.youth_registrations WHERE id = ANY(_ids)
  ORDER BY created_at ASC LIMIT 1;
  UPDATE public.youth_registrations SET youth_link_id = _link WHERE id = ANY(_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_link_youth(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_link_youth(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unlink_youth(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  UPDATE public.youth_registrations SET youth_link_id = NULL WHERE id = _id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_unlink_youth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unlink_youth(uuid) TO authenticated;

COMMIT;
