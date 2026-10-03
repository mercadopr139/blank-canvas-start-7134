// The door check. Every admin-side page asks the same question before it
// renders: may this person open the app this address belongs to? A shaded
// menu line is a courtesy; this is what stops a typed address.
//
// The answer comes from the master app list (which app owns the address) and
// from src/lib/access.ts (may this person open that app).
import { useLocation } from "react-router-dom";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { ownerOfPath } from "@/config/appRegistry";

export const useDoor = () => {
  const { pathname } = useLocation();
  const { hasPermission, canManageAccess, loading } = useStaffPermissions();
  const owner = ownerOfPath(pathname);

  let allowed = true;
  let label = "";
  if (owner.kind === "app") {
    label = owner.app.label;
    // "super" apps (Staff Management) belong to the access manager alone.
    allowed = owner.app.tier === "super" ? canManageAccess : hasPermission(owner.app.key);
  } else if (owner.kind === "task-manager") {
    label = "This Task Manager";
    allowed = hasPermission(owner.permKey);
  }
  return { loading, allowed, label };
};
