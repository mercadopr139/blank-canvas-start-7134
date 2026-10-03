// Who is a super-admin, for the edge functions.
//
// The same list as src/lib/superAdmins.ts and public.is_super_admin() in the
// database (migration 20260914120000). Change all three together.
//
// One person since 2026-10-03 (Josh): Chrissy, Alex and Landon are Admins,
// which is the access_admin row in staff_permissions, not this list.
export const SUPER_ADMIN_EMAILS = [
  "joshmercado@nolimitsboxingacademy.org",
];

export const isSuperAdmin = (email: string | null | undefined) =>
  !!email && SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());

// Who may change anyone's access: invite, check or uncheck a box, make or
// remove an Admin, deactivate, remove. One person, by Josh's decision
// (2026-10-03). The same rule as src/lib/superAdmins.ts (ACCESS_MANAGER_EMAIL)
// and public.can_manage_access() in the database. Change all three together.
export const ACCESS_MANAGER_EMAIL = "joshmercado@nolimitsboxingacademy.org";

export const isAccessManager = (email: string | null | undefined) =>
  !!email && email.trim().toLowerCase() === ACCESS_MANAGER_EMAIL;
