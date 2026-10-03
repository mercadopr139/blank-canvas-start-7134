-- One Super Admin, and Deactivate that really deactivates.
--
-- 1. Super Admin is Josh alone. Chrissy becomes an Admin: the access_admin
--    switch in Staff Management, like Alex and Landon. She keeps what she
--    used as a Super Admin through ordinary boxes: Website Photos, the
--    Scripture Coach reviewer duty, and her own Task Manager (PC).
-- 2. Josh's Task Manager (PD) is checked for nobody but Josh.
-- 3. has_role() is false for anyone deactivated or removed in Staff
--    Management. Every table rule that asks "is this an admin" asks this
--    function, so deactivating a person cuts their data access at once, and
--    activating them brings it back. No policy is rewritten.
--
-- The frontend and edge-function copies of the Super Admin list
-- (src/lib/superAdmins.ts, supabase/functions/_shared/superAdmins.ts) change
-- in the same commit.

-- ── 1. One Super Admin ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin_email(_email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(coalesce(_email, '')) = 'joshmercado@nolimitsboxingacademy.org';
$$;

-- The older flag the Message Board rules read: Josh only.
UPDATE public.staff_profiles
SET is_super_admin = (lower(email) = 'joshmercado@nolimitsboxingacademy.org');

-- Chrissy: Admin, with the boxes that carry what Super Admin used to give her.
INSERT INTO public.staff_permissions (user_id, permission_key, granted)
SELECT sp.user_id, k, true
FROM public.staff_profiles sp,
     unnest(ARRAY['access_admin', 'manage_website_photos', 'operations_scripture_coach_reviewer', 'task_manager_PC']) AS k
WHERE lower(sp.email) = 'chrissycasiello@nolimitsboxingacademy.org'
ON CONFLICT (user_id, permission_key) DO UPDATE SET granted = true;

-- ── 2. Josh's Task Manager is Josh's alone ────────────────────────────────
UPDATE public.staff_permissions p
SET granted = false
FROM public.staff_profiles sp
WHERE sp.user_id = p.user_id
  AND p.permission_key = 'task_manager_PD'
  AND lower(sp.email) <> 'joshmercado@nolimitsboxingacademy.org';

-- ── 3. Deactivate is real ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.user_id = _user_id
      AND (sp.status = 'inactive' OR sp.removed_at IS NOT NULL)
  );
$$;

NOTIFY pgrst, 'reload schema';

-- To check by eye: one row per person, their level and what stays manual.
SELECT sp.full_name,
       sp.status,
       CASE WHEN public.is_super_admin_email(sp.email) THEN 'Super Admin'
            WHEN EXISTS (SELECT 1 FROM public.staff_permissions p
                         WHERE p.user_id = sp.user_id AND p.permission_key = 'access_admin' AND p.granted)
              THEN 'Admin'
            ELSE 'Staff' END AS level,
       (SELECT string_agg(replace(p.permission_key, 'task_manager_', ''), ', ' ORDER BY p.permission_key)
          FROM public.staff_permissions p
         WHERE p.user_id = sp.user_id AND p.granted AND p.permission_key LIKE 'task_manager_%') AS task_managers,
       public.has_role(sp.user_id, 'admin'::public.app_role) AS can_sign_in
FROM public.staff_profiles sp
WHERE sp.removed_at IS NULL
ORDER BY 3 DESC, 1;
