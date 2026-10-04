// Can this person open this line? The one rule, used everywhere: the
// sidebars, the door check on every page, the Command Center tiles, and the
// Staff Management card itself. If they ever disagreed, a box would say one
// thing and the back end would do another.
//
// It mirrors what the database enforces (has_role / has_app, migration
// 20261004090000), so a screen never opens a page the database then refuses
// to fill, and never hides one it would have served.
//
//   1. A Super Admin opens everything.
//   2. An Admin (the Admin switch) opens everything except the explicit-only
//      lines: Task Managers and the Scripture Coach reviewer duty, which stay
//      a per-person box.
//   3. Anyone else is Staff. They open a line only if its box is checked AND
//      the database has been opened to Staff for that app (staffReady in the
//      master list). Everything else is locked.
import { ADMIN_LEVEL_KEY, isExplicitOnlyKey } from "@/lib/permissions";
import { ACCESS_CARD } from "@/config/accessCard";
import { isStaffReadyKey } from "@/config/appRegistry";

export interface Who {
  isSuperAdmin: boolean;
  /** permission_key → granted, as stored. A missing key means "never set". */
  permissions: Record<string, boolean>;
}

export const canOpen = (key: string, who: Who): boolean => {
  if (who.isSuperAdmin) return true;
  const isAdmin = who.permissions[ADMIN_LEVEL_KEY] === true;
  if (isAdmin && !isExplicitOnlyKey(key)) return true;
  if (!isAdmin && !isStaffReadyKey(key)) return false;
  return who.permissions[key] === true;
};

export type PillarId = "operations" | "sales_marketing" | "finance";

/** A pillar shows as open once the person can open at least one line inside it. */
export const canOpenPillar = (id: PillarId, who: Who): boolean =>
  (ACCESS_CARD.find((p) => p.id === id)?.sections ?? []).some((s) => s.lines.some((l) => canOpen(l.key, who)));
