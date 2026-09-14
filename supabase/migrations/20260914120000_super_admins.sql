-- Super-admin as a function, not a hardcoded email.
--
-- Super-admin was one literal email in six policies and RPCs. Adding a second
-- person -- Chrissy, with everything Josh has -- meant finding every one. Now
-- there is one list, in is_super_admin_email(), and every check calls it. The
-- frontend (src/lib/superAdmins.ts) and the edge functions
-- (supabase/functions/_shared/superAdmins.ts) carry the same list; change all
-- three together.

CREATE OR REPLACE FUNCTION public.is_super_admin_email(_email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(coalesce(_email, '')) IN (
    'joshmercado@nolimitsboxingacademy.org',
    'chrissycasiello@nolimitsboxingacademy.org'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT public.is_super_admin_email(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated;

-- ── Workbench inspect / delete (20260701010000) ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_workbench_impact(p_key text)
RETURNS TABLE(focus_areas int, signals int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key text := upper(trim(p_key));
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can inspect a workbench';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*)::int FROM public.focus_areas WHERE manager_type = v_key),
    (SELECT count(*)::int FROM public.signals WHERE source = v_key OR source LIKE v_key || ':%');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_workbench(p_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_key      text := upper(trim(p_key));
  v_fa       int;
  v_sig      int;
  v_tiles    int;
  v_perms    int;
  v_profiles int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can delete a workbench';
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

-- ── Website photos and the event banner (20260717010000, 20260821120000) ──
DROP POLICY IF EXISTS "site_images_admin_write" ON public.site_images;
CREATE POLICY "site_images_admin_write" ON public.site_images
  FOR ALL
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.permission_key = 'manage_website_photos' AND sp.granted
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.permission_key = 'manage_website_photos' AND sp.granted
    )
  );

DROP POLICY IF EXISTS "event_banner_admin_write" ON public.event_banner;
CREATE POLICY "event_banner_admin_write" ON public.event_banner
  FOR ALL
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.permission_key = 'manage_website_photos' AND sp.granted
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = auth.uid() AND sp.permission_key = 'manage_website_photos' AND sp.granted
    )
  );

-- ── Scripture Coach reviewer (20260905130000) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_scripture_reviewer(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.staff_permissions sp
      WHERE sp.user_id = _user
        AND sp.permission_key = 'operations_scripture_coach_reviewer'
        AND sp.granted
    )
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user AND public.is_super_admin_email(u.email)
    );
$$;

-- ── 75 Hard runs (20260908120000) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_see_hard75_run(run uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hard75_runs r
    WHERE r.id = run
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
  );
$$;

DROP POLICY IF EXISTS "Own or super-admin runs" ON public.hard75_runs;
CREATE POLICY "Own or super-admin runs" ON public.hard75_runs
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());
