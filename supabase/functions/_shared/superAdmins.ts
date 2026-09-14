// Who is a super-admin, for the edge functions.
//
// The same list as src/lib/superAdmins.ts and public.is_super_admin() in the
// database (migration 20260914120000). Change all three together.
export const SUPER_ADMIN_EMAILS = [
  "joshmercado@nolimitsboxingacademy.org",
  "chrissycasiello@nolimitsboxingacademy.org",
];

export const isSuperAdmin = (email: string | null | undefined) =>
  !!email && SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
