-- The Staff level: a login that reaches only the data of the apps checked for it.
--
-- Until now every login held the admin role, and nearly every table rule asks
-- "is this an admin". So the boxes in Staff Management locked screens, not
-- data. This migration makes the data follow the boxes.
--
--   Admin   holds the admin role, exactly when the Admin switch is on. The
--           switch and the role are now one thing: a trigger keeps them in
--           step, so turning the switch off takes the data away too.
--   Staff   holds no role. Every existing table rule turns them away, which
--           is the default. They get data only where a rule names an app
--           whose box is checked for them.
--
-- Apps open to Staff are opened one at a time, each with its own rules. This
-- migration opens the first: Juniors Aftercare, limited to Juniors youth.
--
-- Nothing changes for the Super Admin or for the three Admins.

-- ── 1. The two questions every rule and every screen ask ──────────────────

-- Is this app's box checked for the caller? (Always yes for an Admin.)
CREATE OR REPLACE FUNCTION public.has_app(_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.staff_permissions p
        JOIN public.staff_profiles sp ON sp.user_id = p.user_id
        WHERE p.user_id = auth.uid()
          AND p.permission_key = _key
          AND p.granted
          AND sp.status = 'active'
          AND sp.removed_at IS NULL
      );
$$;
GRANT EXECUTE ON FUNCTION public.has_app(text) TO authenticated;

-- May the caller come into the back end at all? An Admin, or anyone with an
-- active staff card. What they find inside is decided app by app.
CREATE OR REPLACE FUNCTION public.can_enter_backend()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.staff_profiles sp
        WHERE sp.user_id = auth.uid()
          AND sp.status = 'active'
          AND sp.removed_at IS NULL
      );
$$;
GRANT EXECUTE ON FUNCTION public.can_enter_backend() TO authenticated;

-- ── 2. The Admin switch and the admin role are one thing ──────────────────
CREATE OR REPLACE FUNCTION public.sync_admin_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_key  text;
  v_on   boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_key  := OLD.permission_key;
  ELSE
    v_user := NEW.user_id;
    v_key  := NEW.permission_key;
    v_on   := NEW.granted;
  END IF;

  IF v_key <> 'access_admin' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_on THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT v_user, 'admin'::public.app_role
    WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_user)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- The Super Admin keeps the role whatever a row says.
    DELETE FROM public.user_roles ur
    WHERE ur.user_id = v_user
      AND ur.role = 'admin'::public.app_role
      AND NOT public.is_super_admin_email((SELECT u.email FROM auth.users u WHERE u.id = v_user));
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_permissions_sync_admin ON public.staff_permissions;
CREATE TRIGGER staff_permissions_sync_admin
AFTER INSERT OR UPDATE OR DELETE ON public.staff_permissions
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role();

-- Bring today's rows into step: the admin role belongs to the Super Admin and
-- to everyone whose Admin switch is on, and to nobody else.
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.staff_permissions p
JOIN auth.users u ON u.id = p.user_id
WHERE p.permission_key = 'access_admin' AND p.granted
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'::public.app_role
  AND NOT public.is_super_admin_email((SELECT u.email FROM auth.users u WHERE u.id = ur.user_id))
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_permissions p
    WHERE p.user_id = ur.user_id AND p.permission_key = 'access_admin' AND p.granted
  );

-- ── 3. No side doors to the admin role ────────────────────────────────────
-- Signing up with an allowlisted email used to make a login an admin on the
-- spot. Access is given in Staff Management and nowhere else.
-- (The trigger on auth.users stays; the function it calls now does nothing.)
CREATE OR REPLACE FUNCTION public.auto_assign_admin_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
DELETE FROM public.admin_allowlist WHERE true;

-- ── 4. Juniors Aftercare, open to Staff, limited to Juniors youth ─────────

-- A Juniors youth: one who has checked in to the aftercare. Not "tagged for
-- it": every Junior Boxer (7-10) is tagged automatically, which was 291
-- registrations on the day this was written, against about 20 who attend.
-- The kiosk and the add-a-student search reach the tagged list through
-- their own functions, which return names and photos only.
CREATE OR REPLACE FUNCTION public.is_juniors_youth(_registration uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.attendance_records a
                 WHERE a.registration_id = _registration AND a.program_source = 'Smile Lab');
$$;
GRANT EXECUTE ON FUNCTION public.is_juniors_youth(uuid) TO authenticated;

DROP POLICY IF EXISTS "Juniors Aftercare staff read Juniors youth" ON public.youth_registrations;
CREATE POLICY "Juniors Aftercare staff read Juniors youth" ON public.youth_registrations
  FOR SELECT TO authenticated
  USING (public.has_app('app_juniors_aftercare') AND public.is_juniors_youth(id));

DROP POLICY IF EXISTS "Juniors Aftercare staff read attendance" ON public.attendance_records;
CREATE POLICY "Juniors Aftercare staff read attendance" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (program_source = 'Smile Lab' AND public.has_app('app_juniors_aftercare'));

DROP POLICY IF EXISTS "Juniors Aftercare staff add attendance" ON public.attendance_records;
CREATE POLICY "Juniors Aftercare staff add attendance" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (program_source = 'Smile Lab' AND public.has_app('app_juniors_aftercare'));

DROP POLICY IF EXISTS "Juniors Aftercare staff change attendance" ON public.attendance_records;
CREATE POLICY "Juniors Aftercare staff change attendance" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (program_source = 'Smile Lab' AND public.has_app('app_juniors_aftercare'))
  WITH CHECK (program_source = 'Smile Lab' AND public.has_app('app_juniors_aftercare'));

DROP POLICY IF EXISTS "Juniors Aftercare staff remove attendance" ON public.attendance_records;
CREATE POLICY "Juniors Aftercare staff remove attendance" ON public.attendance_records
  FOR DELETE TO authenticated
  USING (program_source = 'Smile Lab' AND public.has_app('app_juniors_aftercare'));

DROP POLICY IF EXISTS "Juniors Aftercare staff manage practice days" ON public.juniors_aftercare_practice_days;
CREATE POLICY "Juniors Aftercare staff manage practice days" ON public.juniors_aftercare_practice_days
  FOR ALL TO authenticated
  USING (public.has_app('app_juniors_aftercare'))
  WITH CHECK (public.has_app('app_juniors_aftercare'));

NOTIFY pgrst, 'reload schema';
