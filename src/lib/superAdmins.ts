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
export const SUPER_ADMIN_EMAILS = [
  "joshmercado@nolimitsboxingacademy.org",
  "chrissycasiello@nolimitsboxingacademy.org",
] as const;

export const isSuperAdminEmail = (email: string | null | undefined) =>
  !!email && (SUPER_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
