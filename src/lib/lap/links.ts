// A checklist line can open the page it is about (docs/LAP_PLAN.md). The
// link is an app key from the registry, resolved to that app's first plain
// route, so routes can move without the checklist breaking. Leaving the Lap
// this way sets a flag; the section header's back arrow then returns to the
// Lap instead of the section home, until the Lap is opened again.
import { APPS, APP_GROUPS, type AppEntry } from "@/config/appRegistry";

export const LAP_RETURN_KEY = "nla-lap-return";

export const linkTarget = (appKey: string | null | undefined): { label: string; path: string } | null => {
  if (!appKey) return null;
  const app = APPS.find((a) => a.key === appKey);
  const path = app?.routes.find((r) => !r.includes(":"));
  return app && path ? { label: app.label, path } : null;
};

/** The apps a line may open, in the registry's group order. */
export const linkChoices = (): { group: string; apps: AppEntry[] }[] =>
  APP_GROUPS.map((group) => ({ group, apps: APPS.filter((a) => a.group === group) })).filter((g) => g.apps.length > 0);

export const markLeavingLap = () => { try { sessionStorage.setItem(LAP_RETURN_KEY, "1"); } catch { /* storage blocked */ } };
export const clearLapReturn = () => { try { sessionStorage.removeItem(LAP_RETURN_KEY); } catch { /* storage blocked */ } };
export const hasLapReturn = () => { try { return sessionStorage.getItem(LAP_RETURN_KEY) === "1"; } catch { return false; } };
