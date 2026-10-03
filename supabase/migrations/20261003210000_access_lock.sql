-- Access lock, stage 1: only one person may change who can do what.
--
-- Until now any login holding the admin role could write to the four tables
-- that decide access: staff_permissions (the checkboxes), user_roles (who is
-- an admin), staff_profiles (the staff cards, including active / inactive)
-- and admin_allowlist (whose sign-up becomes an admin). Staff Management hid
-- the page, but the database accepted the write from anyone.
--
-- From here the database accepts those writes from the access manager only.
-- Reading is unchanged: every admin still reads the staff list (names show on
-- the Message Board, the Agenda, the workbenches) and their own permissions.
-- Nobody's access changes; only who may change it.
--
-- The frontend carries the same rule in src/lib/superAdmins.ts
-- (ACCESS_MANAGER_EMAIL). Change both together.

CREATE OR REPLACE FUNCTION public.can_manage_access()
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'joshmercado@nolimitsboxingacademy.org';
$$;
GRANT EXECUTE ON FUNCTION public.can_manage_access() TO anon, authenticated;

-- Drop every write policy on the four tables, whatever it was named, so no
-- older rule is left standing beside the new one. Read-only policies stay.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('staff_permissions', 'user_roles', 'staff_profiles', 'admin_allowlist')
      AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- user_roles had one policy for everything, reading included. Admins keep
-- the read; a person can always read their own (existing policy).
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- admin_allowlist: make sure the read survives too.
DROP POLICY IF EXISTS "Admins can view allowlist" ON public.admin_allowlist;
CREATE POLICY "Admins can view allowlist" ON public.admin_allowlist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- The one write rule, on each table.
CREATE POLICY "Access manager writes staff_permissions" ON public.staff_permissions
  FOR ALL TO authenticated
  USING (public.can_manage_access()) WITH CHECK (public.can_manage_access());

CREATE POLICY "Access manager writes user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.can_manage_access()) WITH CHECK (public.can_manage_access());

CREATE POLICY "Access manager writes staff_profiles" ON public.staff_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_access()) WITH CHECK (public.can_manage_access());

CREATE POLICY "Access manager writes admin_allowlist" ON public.admin_allowlist
  FOR ALL TO authenticated
  USING (public.can_manage_access()) WITH CHECK (public.can_manage_access());

NOTIFY pgrst, 'reload schema';

-- What stands now, to check by eye: each table should show its read rules
-- plus exactly one "Access manager writes ..." rule.
SELECT tablename AS "table", policyname AS rule, cmd AS applies_to
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('staff_permissions', 'user_roles', 'staff_profiles', 'admin_allowlist')
ORDER BY tablename, cmd, policyname;
