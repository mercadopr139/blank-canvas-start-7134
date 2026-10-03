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

// The Admin level: one switch in Staff Management that opens every app, so a
// full-access person is one click rather than forty checkboxes. Stored as an
// ordinary staff_permissions row, which only the access manager can write.
export const ADMIN_LEVEL_KEY = "access_admin";

// What the Admin level does NOT open. These stay a deliberate, per-person
// choice even for an Admin:
//   task_manager_*   a workbench is personal to its owner
//   settings         Staff Management belongs to the access manager alone
//   ..._reviewer     signing off Scripture Coach sessions is a named duty
export const isExplicitOnlyKey = (key: string) =>
  key.startsWith("task_manager_") ||
  key === "settings" ||
  key === "operations_scripture_coach_reviewer";

// Helper: build the task manager permission key for a given task manager.
// The dashboard's HREF_PERM_MAP and the staff management UI both use this
// so the convention stays in sync.
export const taskManagerPermKey = (key: string) => `task_manager_${key}`;
