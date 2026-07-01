-- Server-side "delete a workbench" support so removing a workbench is a
-- safe, one-click UI action instead of hand-run SQL.
--
-- Two SECURITY DEFINER functions, both restricted to the super admin
-- (email match, mirroring the frontend's SUPER_ADMIN_EMAIL gate):
--
--   get_workbench_impact(key) — read-only; returns how many focus areas
--     and signals are attached to a key, to populate the confirmation
--     dialog BEFORE anything is deleted.
--
--   delete_workbench(key) — performs the full guarded cascade in one
--     transaction (function body is atomic): detaches staff profiles,
--     removes dashboard tiles, revokes the permission, deletes signals +
--     focus areas, then the task_managers row. Removing that row is what
--     stops the dashboard backfill re-seeding the tile. Returns a jsonb
--     summary of what was removed.
--
-- PD and PC are hard-blocked as reserved legacy keys. A missing key
-- raises rather than silently no-opping, so the UI can surface it.

CREATE OR REPLACE FUNCTION public.get_workbench_impact(p_key text)
RETURNS TABLE(focus_areas int, signals int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := upper(trim(p_key));
BEGIN
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM 'joshmercado@nolimitsboxingacademy.org' THEN
    RAISE EXCEPTION 'Only the super admin can inspect a workbench';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.focus_areas WHERE manager_type = v_key),
    (SELECT count(*)::int FROM public.signals
       WHERE source = v_key OR source LIKE v_key || ':%');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_workbench(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text := upper(trim(p_key));
  v_fa       int;
  v_sig      int;
  v_tiles    int;
  v_perms    int;
  v_profiles int;
BEGIN
  IF (auth.jwt() ->> 'email') IS DISTINCT FROM 'joshmercado@nolimitsboxingacademy.org' THEN
    RAISE EXCEPTION 'Only the super admin can delete a workbench';
  END IF;

  IF v_key IN ('PD', 'PC') THEN
    RAISE EXCEPTION 'Refusing to delete reserved workbench %', v_key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.task_managers WHERE key = v_key) THEN
    RAISE EXCEPTION 'No workbench with key %', v_key;
  END IF;

  UPDATE public.staff_profiles SET task_manager_type = NULL WHERE task_manager_type = v_key;
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  DELETE FROM public.dashboard_tiles WHERE href = '/admin/task-manager/' || v_key;
  GET DIAGNOSTICS v_tiles = ROW_COUNT;

  DELETE FROM public.staff_permissions WHERE permission_key = 'task_manager_' || v_key;
  GET DIAGNOSTICS v_perms = ROW_COUNT;

  DELETE FROM public.signals WHERE source = v_key OR source LIKE v_key || ':%';
  GET DIAGNOSTICS v_sig = ROW_COUNT;

  DELETE FROM public.focus_areas WHERE manager_type = v_key;
  GET DIAGNOSTICS v_fa = ROW_COUNT;

  DELETE FROM public.task_managers WHERE key = v_key;

  RETURN jsonb_build_object(
    'key', v_key,
    'focus_areas', v_fa,
    'signals', v_sig,
    'tiles', v_tiles,
    'permissions', v_perms,
    'profiles_detached', v_profiles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workbench_impact(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_workbench(text) TO authenticated;
