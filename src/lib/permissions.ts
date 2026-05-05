// Permission registry — single source of truth for all the granular
// permission keys the staff management UI exposes. Top-level pillar keys
// (`operations`, `sales_marketing`, `finance`, `settings`) gate the
// dashboard tile. The "subs" lists below gate the items inside each
// pillar's sidebar so a Sales staff member can be granted "Revenue" but
// not "Bulk Outreach", etc.
//
// Task manager permission keys are NOT listed here — they're derived
// from the public.task_managers table and named `task_manager_<KEY>`
// (e.g. task_manager_PD). The Staff Management UI fetches both this
// static registry and the task_managers list and combines them.
//
// To add a new pillar sub-page: add a row to the matching SUBS list AND
// set `permKey` on the corresponding sidebar tile in
// AdminOperations/AdminSalesMarketing/AdminFinance.tsx so the gate fires.

export type PillarSub = { key: string; label: string };

export const OPERATIONS_SUBS: PillarSub[] = [
  { key: "operations_registration", label: "Registration" },
  { key: "operations_attendance", label: "Attendance" },
  { key: "operations_transportation", label: "Transportation" },
  { key: "operations_meal_tracker", label: "Meal Tracker" },
];

export const SALES_MARKETING_SUBS: PillarSub[] = [
  { key: "sales_marketing_revenue", label: "Revenue" },
  { key: "sales_marketing_master_revenue", label: "Master Revenue Tracker" },
  { key: "sales_marketing_supporters", label: "Supporters Database" },
  { key: "sales_marketing_engagements", label: "Engagements" },
  { key: "sales_marketing_tasks", label: "Tasks" },
  { key: "sales_marketing_bulk_outreach", label: "Bulk Outreach" },
];

export const FINANCE_SUBS: PillarSub[] = [
  { key: "finance_billing", label: "Billing" },
  { key: "finance_csbg", label: "CSBG Grant" },
  { key: "finance_vault", label: "Document Vault" },
];

// Convenience: every sub-permission key in one place, for migrations or
// audits.
export const ALL_PILLAR_SUB_KEYS: string[] = [
  ...OPERATIONS_SUBS.map((s) => s.key),
  ...SALES_MARKETING_SUBS.map((s) => s.key),
  ...FINANCE_SUBS.map((s) => s.key),
];

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
