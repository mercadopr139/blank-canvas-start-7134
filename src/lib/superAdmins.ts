// Who is a super-admin.
//
// Super-admin is everything: every staff permission implied, Staff Management,
// Corner Coach, Website Photos, the workbench delete, every 75 Hard run. It
// was one hardcoded email in five screens, six edge functions and six
// database policies; adding a second person meant finding all of them.
//
// This list is the frontend's copy. The other two live in
// supabase/functions/_shared/superAdmins.ts and the database function
// public.is_super_admin() (migration 20260914120000). Change all three.
//
// One person since 2026-10-03 (Josh): Chrissy, Alex and Landon are Admins,
// which is the access_admin switch in Staff Management, not this list.
export const SUPER_ADMIN_EMAILS = [
  "joshmercado@nolimitsboxingacademy.org",
] as const;

export const isSuperAdminEmail = (email: string | null | undefined) =>
  !!email && (SUPER_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());

// Who may change anyone's access: invite, check or uncheck a box, make or
// remove an Admin, deactivate, remove, add a workbench. One person, by Josh's
// decision (2026-10-03). The database enforces the same rule in
// public.can_manage_access() (migration 20261003210000); change both together.
export const ACCESS_MANAGER_EMAIL = "joshmercado@nolimitsboxingacademy.org";

export const isAccessManagerEmail = (email: string | null | undefined) =>
  !!email && email.trim().toLowerCase() === ACCESS_MANAGER_EMAIL;
