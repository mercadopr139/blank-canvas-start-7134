import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

export const PERMISSION_KEYS = [
  "driver_checkin",
  "operations",
  "sales_marketing",
  "finance",
  "pd_signals",
  "pc_signals",
  "settings",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  driver_checkin: "Driver Check-In",
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
  pd_signals: "PD Signals",
  pc_signals: "PC Signals",
  settings: "Settings",
};

export function useStaffPermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<PermissionKey, boolean>>({
    driver_checkin: false,
    operations: false,
    sales_marketing: false,
    finance: false,
    pd_signals: false,
    pc_signals: false,
    settings: false,
  });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const email = user.email?.toLowerCase();
    if (email === SUPER_ADMIN_EMAIL) {
      setIsSuperAdmin(true);
      const all: Record<PermissionKey, boolean> = {} as any;
      PERMISSION_KEYS.forEach((k) => (all[k] = true));
      setPermissions(all);
      setLoading(false);
      return;
    }

    // Chrissy's permissions now come from the database (staff_permissions table)

    const fetchPerms = async () => {
      const { data } = await supabase
        .from("staff_permissions")
        .select("permission_key, granted")
        .eq("user_id", user.id);

      const perms: Record<PermissionKey, boolean> = {
        driver_checkin: false,
        operations: false,
        sales_marketing: false,
        finance: false,
        pd_signals: false,
        pc_signals: false,
        settings: false,
      };

      if (data) {
        data.forEach((row: any) => {
          if (PERMISSION_KEYS.includes(row.permission_key)) {
            perms[row.permission_key as PermissionKey] = row.granted;
          }
        });
      }

      setPermissions(perms);
      setLoading(false);
    };

    fetchPerms();
  }, [user]);

  const hasPermission = (key: PermissionKey) => isSuperAdmin || permissions[key];
  const canAccessSettings = () => isSuperAdmin || permissions.settings;

  return { permissions, loading, isSuperAdmin, hasPermission, canAccessSettings };
}
