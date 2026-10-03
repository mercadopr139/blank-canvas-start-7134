import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { isSuperAdminEmail, isAccessManagerEmail } from "@/lib/superAdmins";
import { ADMIN_LEVEL_KEY } from "@/lib/permissions";
import { canOpen, canOpenPillar, type PillarId } from "@/lib/access";
import { useViewAs } from "@/lib/viewAs";

// Permission keys are plain strings. They come from:
//   1. The master app list (src/config/appRegistry.ts): one key per sidebar
//      line and Command Center tile.
//   2. Task manager keys (task_manager_<KEY>) from public.task_managers.
//   3. The Admin level (access_admin) and a few named duties.
// What a key means for a person is decided in one place: src/lib/access.ts.
export type PermissionKey = string;

// Backward-compat re-exports for older callers.
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
  // "View as": the access manager looking at the back end as someone else.
  // Honoured for the access manager only; ignored for everyone else.
  const viewAs = useViewAs();
  const previewing = isAccessManagerEmail(user?.email) && !!viewAs;
  const subjectId = previewing ? viewAs!.user_id : user?.id;
  const isSuperAdmin = isSuperAdminEmail((previewing ? viewAs!.email : user?.email)?.toLowerCase());

  // One shared, cached read of the person's own boxes. Every sidebar, door
  // check and tile asks this hook, so they all see the same answer and moving
  // between pages does not wait on a fresh fetch each time. A change made in
  // Staff Management reaches the person within half a minute, or on reload.
  const { data, isLoading } = useQuery({
    queryKey: ["staff-permissions", subjectId],
    // A Super Admin passes every check, so there is nothing to load.
    enabled: !!user && !!subjectId && !isSuperAdmin,
    // A preview always shows the boxes as they stand right now.
    staleTime: previewing ? 0 : 30_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("staff_permissions")
        .select("permission_key, granted")
        .eq("user_id", subjectId!);
      if (error) throw error;
      const perms: Record<string, boolean> = {};
      (rows || []).forEach((row: { permission_key: string; granted: boolean }) => {
        perms[row.permission_key] = row.granted;
      });
      return perms;
    },
  });

  const permissions = useMemo(() => data ?? {}, [data]);
  const loading = !!user && !isSuperAdmin && isLoading;

  /** Admin level: every app is open, apart from the explicit-only keys. */
  const isAdminLevel = permissions[ADMIN_LEVEL_KEY] === true;
  const hasPermission = useCallback(
    (key: string) => canOpen(key, { isSuperAdmin, permissions }),
    [isSuperAdmin, permissions],
  );
  /** Operations / Sales & Marketing / Finance: open once any line inside is. */
  const hasPillar = useCallback(
    (id: PillarId) => canOpenPillar(id, { isSuperAdmin, permissions }),
    [isSuperAdmin, permissions],
  );
  const canAccessSettings = () => isSuperAdmin || permissions["settings"] === true;
  /** May this person change anyone's access? The database refuses everyone else. */
  // Off during a preview, so Staff Management looks locked the way the
  // previewed person would find it. The banner's Exit brings it back.
  const canManageAccess = isAccessManagerEmail(user?.email) && !previewing;

  return { permissions, loading, isSuperAdmin, isAdminLevel, hasPermission, hasPillar, canAccessSettings, canManageAccess, previewing };
}
