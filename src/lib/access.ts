// Can this person open this line? The one rule, used everywhere: the
// sidebars, the door check on every page, the Command Center tiles, and the
// Staff Management card itself. If they ever disagreed, a box would say one
// thing and the back end would do another.
//
// In order:
//   1. A Super Admin opens everything.
//   2. An Admin opens everything except the explicit-only lines (Task
//      Managers, the Scripture Coach reviewer duty).
//   3. Otherwise the line's own box decides, once it has been set.
//   4. A line that has never been set shows what the old one-box-per-section
//      setting granted, so nobody's access moved on the day the card changed.
import { ADMIN_LEVEL_KEY, isExplicitOnlyKey } from "@/lib/permissions";
import { ACCESS_CARD, COMMAND_CENTER_LINES, allCardLines } from "@/config/accessCard";

export interface Who {
  isSuperAdmin: boolean;
  /** permission_key → granted, as stored. A missing key means "never set". */
  permissions: Record<string, boolean>;
}

const FALLBACK = new Map<string, { legacyKey?: string; defaultOn?: boolean }>();
allCardLines().forEach((l) => FALLBACK.set(l.key, { legacyKey: l.legacyKey }));
COMMAND_CENTER_LINES.forEach((l) => FALLBACK.set(l.key, { defaultOn: l.defaultOn }));

export const canOpen = (key: string, who: Who): boolean => {
  if (who.isSuperAdmin) return true;
  if (who.permissions[ADMIN_LEVEL_KEY] === true && !isExplicitOnlyKey(key)) return true;
  const own = who.permissions[key];
  if (own !== undefined) return own;
  const fallback = FALLBACK.get(key);
  if (fallback?.legacyKey) return who.permissions[fallback.legacyKey] === true;
  return fallback?.defaultOn ?? false;
};

export type PillarId = "operations" | "sales_marketing" | "finance";

/** A pillar shows as open once the person can open at least one line inside it. */
export const canOpenPillar = (id: PillarId, who: Who): boolean =>
  (ACCESS_CARD.find((p) => p.id === id)?.sections ?? []).some((s) => s.lines.some((l) => canOpen(l.key, who)));
