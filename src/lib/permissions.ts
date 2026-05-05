// Permission helpers. The list of sub-permissions per pillar
// (Operations / Sales & Marketing / Finance) is no longer hardcoded
// here — it's derived from the same tile configs the pillar pages
// render, in src/config/pillarTiles.ts. Adding a new pillar sub-page
// with a `permKey` automatically gives it a checkbox in Staff
// Management.
//
// Task manager permission keys (task_manager_<KEY>) come from the
// public.task_managers table — see taskManagerPermKey() below.

export type PillarSub = { key: string; label: string };

// Top-level keys that always exist regardless of how many task managers
// the org has. Settings is super-admin gated in the UI itself.
export const TOP_LEVEL_PILLAR_KEYS = [
  "operations",
  "sales_marketing",
  "finance",
  "settings",
] as const;

export type TopLevelPillarKey = (typeof TOP_LEVEL_PILLAR_KEYS)[number];

export const TOP_LEVEL_PILLAR_LABELS: Record<TopLevelPillarKey, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
  settings: "Settings",
};

// Helper: build the task manager permission key for a given task manager.
// The dashboard's HREF_PERM_MAP and the staff management UI both use this
// so the convention stays in sync.
export const taskManagerPermKey = (key: string) => `task_manager_${key}`;
