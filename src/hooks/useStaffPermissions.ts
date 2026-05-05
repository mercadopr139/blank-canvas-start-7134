import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

// Permission keys are now arbitrary strings. The full list is no longer
// hardcoded — it comes from a combination of:
//   1. Top-level pillar keys (operations / sales_marketing / finance /
//      settings) defined in src/lib/permissions.ts
//   2. Pillar sub-permission keys (operations_registration, etc.) — also
//      in src/lib/permissions.ts
//   3. Task manager keys (task_manager_<KEY>) derived from the
//      public.task_managers table — see taskManagerPermKey() helper
//
// PermissionKey is kept as `string` instead of a strict union so callers
// don't need to be updated whenever a new task manager is added.
export type PermissionKey = string;

// Backward-compat re-exports — older callers (HREF_PERM_MAP, etc.) still
// import these names. Migrating them all in one shot would balloon this
// change; future renames are fine.
export const PERMISSION_KEYS: readonly string[] = [
  "operations",
  "sales_marketing",
  "finance",
  "settings",
];

export const PERMISSION_LABELS: Record<string, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
  settings: "Settings",
};

export function useStaffPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const email = user.email?.toLowerCase();
    if (email === SUPER_ADMIN_EMAIL) {
      // Super admin bypasses every permission gate; we don't bother loading
      // the staff_permissions row set, since hasPermission() short-circuits.
      setIsSuperAdmin(true);
      setPermissions({});
      setLoading(false);
      return;
    }

    const fetchPerms = async () => {
      const { data } = await supabase
        .from("staff_permissions")
        .select("permission_key, granted")
        .eq("user_id", user.id);

      const perms: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        perms[row.permission_key] = row.granted;
      });
      setPermissions(perms);
      setLoading(false);
    };

    fetchPerms();
  }, [user]);

  const hasPermission = (key: string) => isSuperAdmin || permissions[key] === true;
  const canAccessSettings = () => isSuperAdmin || permissions["settings"] === true;

  return { permissions, loading, isSuperAdmin, hasPermission, canAccessSettings };
}
