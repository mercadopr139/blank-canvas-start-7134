-- ═══════════════════════════════════════════════════════════════════
-- Program-year archive ceremony — Phase D
-- ═══════════════════════════════════════════════════════════════════
-- Adds an admin-only RPC that closes out a finished program year by
-- stamping `archived_at = NOW()` on every still-active row tagged
-- with that program_year. Used by the "Archive 2025-26 Program Year"
-- button that appears in admin between Aug 1 and Sept 30 each year.
--
-- Idempotent: rows already archived stay archived (the WHERE clause
-- skips them), so re-running is safe. Returns the count of rows
-- actually archived in this call.
--
-- All in one transaction. Admin-gated via require_admin() from the
-- Phase A excursion-override migration.

CREATE OR REPLACE FUNCTION public.admin_archive_program_year(_program_year text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count bigint;
BEGIN
  PERFORM public.require_admin();

  IF _program_year IS NULL OR length(trim(_program_year)) = 0 THEN
    RAISE EXCEPTION 'Program year is required';
  END IF;

  WITH archived AS (
    UPDATE public.youth_registrations
       SET archived_at = now()
     WHERE program_year = _program_year
       AND archived_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO _count FROM archived;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_program_year(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_archive_program_year(text) TO authenticated;
