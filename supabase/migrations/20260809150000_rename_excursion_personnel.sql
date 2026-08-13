-- ═══════════════════════════════════════════════════════════════════
-- Coach Mode: rename a coach/volunteer (fix a typo) without losing their
-- vehicle / driver placement
-- ═══════════════════════════════════════════════════════════════════
-- Just updates the name in place. Works after the roster is locked (like the
-- other coach edits), blocked only once the trip is closed.
CREATE OR REPLACE FUNCTION public.rename_excursion_personnel(
  _personnel_id uuid,
  _name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _excursion_id uuid;
  _closed timestamptz;
BEGIN
  SELECT excursion_id INTO _excursion_id FROM public.excursion_personnel WHERE id = _personnel_id;
  IF _excursion_id IS NULL THEN RETURN; END IF;
  SELECT returned_at INTO _closed FROM public.excursions WHERE id = _excursion_id;
  IF _closed IS NOT NULL THEN
    RAISE EXCEPTION 'Trip is closed' USING ERRCODE = 'check_violation';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  UPDATE public.excursion_personnel SET name = trim(_name) WHERE id = _personnel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_excursion_personnel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_excursion_personnel(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.rename_excursion_personnel(uuid, text) TO authenticated;

-- Admin variant (bypasses the closed check).
CREATE OR REPLACE FUNCTION public.admin_rename_excursion_personnel(
  _personnel_id uuid,
  _name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  UPDATE public.excursion_personnel SET name = trim(_name) WHERE id = _personnel_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rename_excursion_personnel(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rename_excursion_personnel(uuid, text) TO authenticated;
