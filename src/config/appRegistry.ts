// The master list of back-end apps.
//
// Every page a signed-in person can open in the admin side belongs to exactly
// one app here. This list is what Staff Management shows as checkboxes, what
// the door check on each page reads, and what the menus are checked against,
// so the three cannot drift apart. (Josh, 2026-10-03: "Staff Management
// should always be reading my builds", the way Vercel reads GitHub.)
//
// ADDING A NEW APP (e.g. a Relay Race app):
//   1. Add its route in src/App.tsx as usual.
//   2. Add one entry here with that route.
// That is all. Skip step 2 and `npm run test` fails (src/test/appRegistry
// .test.ts), so an app cannot ship without appearing in Staff Management.
// New apps arrive locked: unchecked for every Staff person, open to Admins.
//
// THE ACCESS MODEL
//   Super Admin  Josh only. Everything. The only one who changes access.
//   Admin        Everything except what is marked `tier: "super"` and other
//                people's personal apps (Task Managers).
//   Staff        Only the apps checked for them. Everything else is listed
//                but locked.

export type AppTier =
  /** Can be checked for anyone. The default. */
  | "staff"
  /** Admins and the Super Admin only; no checkbox for Staff. */
  | "admin"
  /** The Super Admin only. */
  | "super";

export interface AppEntry {
  /** The permission key stored in staff_permissions. Never rename one that is in use. */
  key: string;
  /** What Staff Management calls it. */
  label: string;
  /** Where it sits in Staff Management and the menus. */
  group: AppGroup;
  /**
   * Every route this app owns, as written in App.tsx (":param" segments
   * allowed). A route may belong to one app only.
   */
  routes: string[];
  tier?: AppTier;
  /**
   * The database has rules that let a Staff person (no Admin switch) use this
   * app, limited to this app's data. Until an app is marked ready, its box is
   * for Admins only: checking it for a Staff person would open a page the
   * database then refuses to fill. Opening one more app to Staff means writing
   * its database rules (see migration 20261004090000) and setting this flag.
   */
  staffReady?: boolean;
  /** One line on what data the app opens, shown under the checkbox. */
  opens?: string;
}

export type AppGroup =
  | "Command Center"
  | "Registration"
  | "Youth Programs"
  | "Transportation"
  | "Meal Tracker"
  | "Gym Board"
  | "Weight Watchers"
  | "Scripture Coach"
  | "Hawk Squad"
  | "BAM"
  | "Forms & Waivers"
  | "Sales & Marketing"
  | "Finance";

/** The order groups appear in Staff Management. */
export const APP_GROUPS: AppGroup[] = [
  "Command Center",
  "Registration",
  "Youth Programs",
  "Transportation",
  "Meal Tracker",
  "Gym Board",
  "Weight Watchers",
  "Scripture Coach",
  "Hawk Squad",
  "BAM",
  "Forms & Waivers",
  "Sales & Marketing",
  "Finance",
];

const OPS = "/admin/operations";
const SM = "/admin/sales-marketing";
const FIN = "/admin/finance";

export const APPS: AppEntry[] = [
  // ── Command Center ────────────────────────────────────────────────────
  { key: "app_message_board", label: "Message Board", group: "Command Center", routes: ["/admin/message-board"], opens: "Staff conversations they are a member of" },
  { key: "app_agenda", label: "Agenda", group: "Command Center", routes: ["/admin/agenda"], opens: "The weekly agenda" },
  // Keeps its original key: the database rules on site photos check this one.
  { key: "manage_website_photos", label: "Website Photos", group: "Command Center", routes: ["/admin/website-photos"], opens: "Photos and the event banner on the public site" },
  { key: "app_corner_coach", label: "Corner Coach", group: "Command Center", routes: ["/admin/corner-coach"], tier: "admin" },
  { key: "app_staff_management", label: "Staff Management", group: "Command Center", routes: ["/admin/staff"], tier: "super", opens: "Who can open what" },

  // ── Operations · Registration ─────────────────────────────────────────
  { key: "app_registration_intelligence", label: "Registration Intelligence", group: "Registration", routes: [`${OPS}/registration-analytics`], opens: "Every registration, demographics" },
  { key: "app_registrations", label: "Registrations", group: "Registration", routes: [`${OPS}/registrations`], opens: "Every registration, family contact and medical details" },
  { key: "app_reregistration", label: "Re-Registration Readiness", group: "Registration", routes: [`${OPS}/reregistration-readiness`, `${OPS}/reregistration-approvals`] },
  { key: "app_duplicate_registrations", label: "Duplicate Registrations", group: "Registration", routes: [`${OPS}/duplicate-registrations`] },
  { key: "app_registration_form_editor", label: "Registration Form Editor", group: "Registration", routes: [`${OPS}/form-builder`] },

  // ── Operations · Youth Programs ───────────────────────────────────────
  { key: "app_attendance_intelligence", label: "Attendance Intelligence", group: "Youth Programs", routes: [`${OPS}/attendance`], opens: "Every youth's attendance" },
  { key: "app_youth_served", label: "Youth Served (all programs)", group: "Youth Programs", routes: [`${OPS}/youth-served`] },
  { key: "app_program_highlights", label: "Program Highlights", group: "Youth Programs", routes: [`${OPS}/program-highlights`] },
  { key: "app_excursion_intelligence", label: "Excursion Intelligence", group: "Youth Programs", routes: [`${OPS}/excursion-intelligence`, "/admin/excursion-signups/:excursionId"] },
  { key: "app_events_intelligence", label: "Events Intelligence", group: "Youth Programs", routes: [`${OPS}/events-intelligence`] },
  { key: "app_attendance_reports", label: "Attendance Reports", group: "Youth Programs", routes: [`${OPS}/attendance-reports`] },
  { key: "app_callouts", label: "Call-Outs", group: "Youth Programs", routes: [`${OPS}/callouts`] },
  { key: "app_juniors_aftercare", label: "Juniors Aftercare Intelligence", group: "Youth Programs", routes: [`${OPS}/smile-lab-attendance`, `${OPS}/lil-champs-attendance`], staffReady: true, opens: "Juniors Aftercare youth only: attendance, journal, photos, grant report" },

  // ── Operations · Transportation ───────────────────────────────────────
  { key: "app_transport_intelligence", label: "Transportation Intelligence", group: "Transportation", routes: [`${OPS}/transportation/intelligence`] },
  { key: "app_transport_drivers", label: "Drivers", group: "Transportation", routes: [`${OPS}/transportation/drivers`, "/transport/admin/drivers"] },
  { key: "app_transport_youth", label: "Youth Profiles", group: "Transportation", routes: [`${OPS}/transportation/youth`, "/transport/admin/youth"], opens: "Home addresses of youth who ride" },
  { key: "app_transport_runs", label: "Trips & Pay", group: "Transportation", routes: [`${OPS}/transportation/runs`, "/transport/admin/runs"], opens: "Driver pay" },
  { key: "app_transport_incidents", label: "Incident Reports", group: "Transportation", routes: [`${OPS}/transportation/incidents`, "/transport/admin/incidents"] },
  { key: "app_transport_impact_reports", label: "Impact Reports", group: "Transportation", routes: [`${OPS}/transportation/impact-reports`] },

  // ── Operations · Meal Tracker ─────────────────────────────────────────
  { key: "app_meal_intelligence", label: "Meal Intelligence", group: "Meal Tracker", routes: [`${OPS}/meal-reports`] },
  { key: "app_meal_setup", label: "Meal Setup", group: "Meal Tracker", routes: [`${OPS}/meal-tracker`] },

  // ── Operations · Gym Board ────────────────────────────────────────────
  // The BT and NBT Workout Plans are tabs inside Practice Plan, so the NBT
  // builder and its intelligence page ride on the same box.
  { key: "app_practice_plan", label: "Practice Plan", group: "Gym Board", routes: [`${OPS}/practice-plan`, `${OPS}/nbt-board`, `${OPS}/nbt-intelligence`], opens: "The week's plan, verse and both Workout Plans" },
  { key: "app_daily_duties", label: "Daily Duties Intelligence", group: "Gym Board", routes: [`${OPS}/daily-duties`] },

  // ── Operations · single-page sections ─────────────────────────────────
  { key: "app_weight_watchers", label: "Weight Watchers", group: "Weight Watchers", routes: [`${OPS}/weight-watchers`] },
  { key: "app_scripture_coach", label: "Scripture Coach · New Session", group: "Scripture Coach", routes: [`${OPS}/scripture-coach`] },
  { key: "app_scripture_coach_intelligence", label: "Scripture Coach Intelligence", group: "Scripture Coach", routes: [`${OPS}/scripture-coach-intelligence`] },

  // ── Operations · Hawk Squad ───────────────────────────────────────────
  { key: "app_hawk_intelligence", label: "Hawk Squad Intelligence", group: "Hawk Squad", routes: [`${OPS}/hawk-squad/intelligence`, `${OPS}/hawk-squad/attendance`], opens: "Hawk Squad students only" },
  { key: "app_hawk_registrations", label: "Hawk Squad Registrations", group: "Hawk Squad", routes: [`${OPS}/hawk-squad/registrations`], opens: "Hawk Squad students only" },
  { key: "app_hawk_form_editor", label: "Hawk Squad Form Editor", group: "Hawk Squad", routes: [`${OPS}/hawk-squad/form-builder`] },

  // ── Operations · BAM ──────────────────────────────────────────────────
  { key: "app_bam_intelligence", label: "BAM Intelligence", group: "BAM", routes: [`${OPS}/bam/intelligence`], opens: "BAM students only" },
  { key: "app_bam_registrations", label: "BAM Registrations", group: "BAM", routes: [`${OPS}/bam/registrations`], opens: "BAM students only" },
  { key: "app_bam_form_editor", label: "BAM Form Editor", group: "BAM", routes: [`${OPS}/bam/form-builder`] },

  // ── Operations · Forms & Waivers ──────────────────────────────────────
  { key: "app_forms", label: "Forms & Waivers", group: "Forms & Waivers", routes: [`${OPS}/forms`, `${OPS}/forms/:id`] },

  // ── Sales & Marketing ─────────────────────────────────────────────────
  { key: "app_revenue", label: "Revenue", group: "Sales & Marketing", routes: [`${SM}/revenue`] },
  { key: "app_master_revenue", label: "Master Revenue Tracker", group: "Sales & Marketing", routes: [`${SM}/master-revenue-tracker`, `${FIN}/master-revenue-tracker`] },
  { key: "app_supporters", label: "Supporters Database", group: "Sales & Marketing", routes: [`${SM}/supporters-database`, `${SM}/supporters/:id`], opens: "Donor names, contact details and giving" },
  { key: "app_engagements", label: "Engagements", group: "Sales & Marketing", routes: [`${SM}/engagements`] },
  { key: "app_sales_tasks", label: "Tasks", group: "Sales & Marketing", routes: [`${SM}/tasks`] },
  { key: "app_bulk_outreach", label: "Bulk Outreach", group: "Sales & Marketing", routes: [`${SM}/bulk-outreach`], opens: "Sends email to supporters" },
  { key: "app_raffle", label: "Raffle", group: "Sales & Marketing", routes: [`${SM}/raffle`] },
  { key: "app_raffle_intelligence", label: "Raffle Intelligence Board", group: "Sales & Marketing", routes: [`${SM}/raffle-intelligence`] },
  { key: "app_invoice_quote", label: "Invoice / Quote Generator", group: "Sales & Marketing", routes: [`${SM}/invoice-quote-generator`] },

  // ── Finance ───────────────────────────────────────────────────────────
  // Billing is the hub: invoices, clients, the service calendar, donations
  // and deposits are reached from it, so they ride on its box.
  {
    key: "app_billing", label: "Billing", group: "Finance",
    routes: [`${FIN}/billing`, `${FIN}/invoices`, `${FIN}/clients`, `${FIN}/service-calendar`, `${FIN}/donations`, `${FIN}/deposits`, `${FIN}/deposits/:id`],
    opens: "Invoices, clients, donations and deposits",
  },
  { key: "app_csbg_invoice", label: "CSBG · Invoice Generator", group: "Finance", routes: [`${FIN}/csbg/invoice`] },
  { key: "app_csbg_budget", label: "CSBG · Budget vs. Actual", group: "Finance", routes: [`${FIN}/csbg/budget`] },
  { key: "app_csbg_checklist", label: "CSBG · Document Checklist", group: "Finance", routes: [`${FIN}/csbg/checklist`] },
  { key: "app_csbg_dashboard", label: "CSBG · Status Dashboard", group: "Finance", routes: [`${FIN}/csbg/dashboard`] },
  { key: "app_csbg_submissions", label: "CSBG · Submission Log", group: "Finance", routes: [`${FIN}/csbg/submissions`] },
  { key: "app_document_vault", label: "Document Vault", group: "Finance", routes: [`${FIN}/vault`], opens: "Stored organisation documents" },
];

/**
 * Task Managers are apps too, but the list of them lives in the database
 * (task_managers), since a new workbench can be added from the dashboard.
 * Their routes all carry the workbench key, so one pattern set covers every
 * workbench, present and future. They are personal: an Admin gets only the
 * ones checked for her; the Super Admin sees all of them.
 */
export const TASK_MANAGER_ROUTES = [
  "/admin/task-manager/:managerType",
  "/admin/task-manager/:managerType/signals/:focusArea",
  "/admin/task-manager/:managerType/signals/:focusArea/archive",
  "/admin/task-manager/:managerType/signals/:focusArea/trash",
  // Older addresses, kept so bookmarks still work.
  "/admin/pd-task-manager",
  "/admin/pc-task-manager",
  "/admin/pc-signals/:focusArea",
  "/admin/pc-signals/:focusArea/archive",
  "/admin/pc-signals/:focusArea/trash",
  "/admin/signals/:focusArea",
  "/admin/signals/:focusArea/archive",
  "/admin/signals/:focusArea/trash",
];

/**
 * Admin-side routes that are not apps: the way in, and the shells the apps
 * sit inside. Anyone signed in may reach these; what they find inside is
 * decided app by app.
 */
export const NOT_APPS = [
  "/admin",
  "/admin/login",
  "/admin/reset-password",
  "/admin/dashboard",
  "/admin/operations",
  "/admin/sales-marketing",
  "/admin/finance",
  "/transport/admin",
];

/**
 * Tools that run on a shared coach password or a PIN rather than a personal
 * login: the wall boards, the kiosks, the driver app. No checkbox controls
 * them; they are listed in Staff Management so the blueprint is complete.
 */
export const SHARED_PASSWORD_TOOLS: { label: string; route: string; how: string }[] = [
  { label: "Gym Board (the wall)", route: "/practice-board", how: "Open on the wall screen" },
  { label: "Battle Team Workout Plan", route: "/strength-coach", how: "Coach password" },
  { label: "Battle Team Intelligence", route: "/strength-coach/intelligence", how: "Coach password" },
  { label: "Battle Team wall", route: "/strength-board", how: "Open on the wall screen" },
  { label: "NBT wall", route: "/nbt-board", how: "Open on the wall screen" },
  { label: "Juniors Aftercare Board", route: "/smile-lab", how: "Open on the room screen" },
  { label: "NLA Check-In kiosk", route: "/check-in", how: "Kiosk" },
  { label: "Juniors Aftercare Check-In kiosk", route: "/check-in/aftercare", how: "Kiosk" },
  { label: "Hawk Squad Check-In kiosk", route: "/check-in/hawk-squad", how: "Kiosk" },
  { label: "BAM Check-In kiosk", route: "/check-in/bam", how: "Kiosk" },
  { label: "Meal Check-In kiosk", route: "/meal-check-in", how: "Kiosk" },
  { label: "Weigh-In kiosk", route: "/weigh-in", how: "Kiosk" },
  { label: "Excursion Check-In", route: "/excursion-check-in", how: "Kiosk" },
  { label: "Excursion Coach", route: "/excursion-coach", how: "Coach password" },
  { label: "Driver app", route: "/transport", how: "Driver PIN" },
  { label: "75 Hard", route: "/hard-75", how: "Personal login; each run is private to its owner" },
];

/**
 * Sidebar lines that open a page outside the admin side: a public form, or a
 * tool with its own password. They are lines a person can click, so they get
 * a checkbox like every other line; the box decides whether the line shows.
 */
export const MENU_LINKS: { key: string; label: string; href: string }[] = [
  { key: "link_registration_form", label: "Registration Form", href: "/register" },
  { key: "link_hawk_registration_form", label: "Hawk Squad Registration Form", href: "/hawk-squad/register" },
  { key: "link_bam_registration_form", label: "BAM Registration Form", href: "/bam/register" },
  { key: "link_battle_team_intelligence", label: "Battle Team Intelligence", href: "/strength-coach/intelligence" },
  { key: "link_hard_75", label: "75 Hard", href: "/hard-75" },
];

// ── Lookups ───────────────────────────────────────────────────────────────

/** Turn "/admin/x/:id" into a matcher for real addresses. */
const toMatcher = (pattern: string) =>
  new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:[A-Za-z]+/g, "[^/]+") + "/?$");

const APP_MATCHERS = APPS.flatMap((app) => app.routes.map((r) => ({ app, test: toMatcher(r) })));
const TASK_MANAGER_MATCHERS = TASK_MANAGER_ROUTES.map(toMatcher);
const NOT_APP_MATCHERS = NOT_APPS.map(toMatcher);

/** The permission key for a workbench, e.g. PD → task_manager_PD. */
export const taskManagerAppKey = (managerKey: string) => `task_manager_${managerKey}`;

/** Which workbench an address belongs to, or null. Older addresses map to PD and PC. */
export const taskManagerForPath = (pathname: string): string | null => {
  const m = pathname.match(/^\/admin\/task-manager\/([^/]+)/);
  if (m) return m[1];
  if (/^\/admin\/(pd-task-manager|signals\/)/.test(pathname)) return "PD";
  if (/^\/admin\/(pc-task-manager|pc-signals\/)/.test(pathname)) return "PC";
  return null;
};

export type PathOwner =
  | { kind: "app"; app: AppEntry }
  | { kind: "task-manager"; managerKey: string; permKey: string }
  | { kind: "not-app" }
  | { kind: "unknown" };

/** What an address belongs to. "unknown" is a bug: an admin page nobody registered. */
export const ownerOfPath = (pathname: string): PathOwner => {
  const path = pathname.split(/[?#]/)[0];
  const hit = APP_MATCHERS.find((m) => m.test.test(path));
  if (hit) return { kind: "app", app: hit.app };
  if (TASK_MANAGER_MATCHERS.some((t) => t.test(path))) {
    const managerKey = taskManagerForPath(path) ?? "";
    return { kind: "task-manager", managerKey, permKey: taskManagerAppKey(managerKey) };
  }
  if (NOT_APP_MATCHERS.some((t) => t.test(path))) return { kind: "not-app" };
  return { kind: "unknown" };
};

export const appByKey = (key: string) => APPS.find((a) => a.key === key);

const STAFF_READY = new Set<string>([
  ...APPS.filter((a) => a.staffReady).map((a) => a.key),
  // Menu links open pages outside the admin side, which carry their own
  // password or are public, so there is no admin data behind them to guard.
  ...MENU_LINKS.map((l) => l.key),
]);

/** Can this box be given to a Staff person, or is it for Admins only for now? */
export const isStaffReadyKey = (key: string) => STAFF_READY.has(key);

/**
 * The checkbox key behind a sidebar line, whatever it opens: the app that
 * owns the page, or the menu link. Null means nobody registered the line.
 */
export const keyForMenuHref = (href: string): string | null => {
  const owner = ownerOfPath(href);
  if (owner.kind === "app") return owner.app.key;
  const path = href.split(/[?#]/)[0];
  return MENU_LINKS.find((l) => l.href === path)?.key ?? null;
};

/** The apps of one group, in list order. */
export const appsInGroup = (group: AppGroup) => APPS.filter((a) => a.group === group);
