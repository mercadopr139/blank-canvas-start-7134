// Single source of truth for the sidebar tiles inside each admin pillar
// page (Operations, Sales & Marketing, Finance). The pillar page renders
// these as its sidebar; AdminStaffManagement derives its sub-permission
// checkboxes from these too.
//
// Adding a new pillar feature:
//   1. Add a new entry to the corresponding array below with a `permKey`
//   2. That's it. The sidebar shows the tile gated on that key, and the
//      Staff Management UI automatically picks up a new checkbox under
//      the right pillar.

import type { LucideIcon } from "lucide-react";
import {
  Users, BarChart3, ClipboardList, CalendarCheck, FileBarChart, Settings2, Copy,
  Star, Bus, UserCheck, Radio, PhoneOff, AlertTriangle, FileText,
  UtensilsCrossed, HandCoins, Database, MessageSquare, Mail, Receipt,
  ScrollText, ClipboardCheck, LayoutDashboard, Archive, Gauge, MapPin, Sparkles, Dumbbell, Smile, Scale,
  BookOpenCheck, HeartHandshake, Monitor, Ticket, Flame, Bird, Layers, Brain } from "lucide-react";

export interface PillarTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
  // Permission key gating this tile's visibility in the sidebar AND the
  // checkbox label/key in Staff Management. Tiles without a permKey are
  // visible to anyone with the parent pillar permission.
  permKey?: string;
  children?: { title: string; href: string; icon: LucideIcon; external?: boolean }[];
}

export const OPERATIONS_TILES: PillarTile[] = [
  // Ordered in four clusters, top to bottom: running NLA day to day,
  // coaching tools, the partner programs, then setup. Reordered 2026-09-30;
  // nothing removed or merged.
  {
    title: "Registration",
    description: "Youth registration management",
    icon: ClipboardList,
    href: "/admin/operations/registration",
    permKey: "operations_registration",
    children: [
      { title: "Registration Intelligence", href: "/admin/operations/registration-analytics", icon: BarChart3 },
      { title: "Registrations", href: "/admin/operations/registrations", icon: Users },
      { title: "Re-Registration Readiness", href: "/admin/operations/reregistration-readiness", icon: UserCheck },
      // Re-Registration Approvals hidden from the sidebar (duplicates Registrations → New Submissions).
      // Route/page kept alive at /admin/operations/reregistration-approvals; re-add this line to restore
      // the one-click "Approve all returning" bulk button (handy during re-reg rush):
      // { title: "Re-Registration Approvals", href: "/admin/operations/reregistration-approvals", icon: ClipboardCheck },
      { title: "Duplicate Registrations", href: "/admin/operations/duplicate-registrations", icon: Copy },
      { title: "Registration Form", href: "/register", icon: ClipboardList, external: true },
      { title: "Registration Form Editor", href: "/admin/operations/form-builder", icon: Settings2 },
    ],
  },
  {
    title: "Attendance",
    description: "Attendance tracking & reports",
    icon: CalendarCheck,
    href: "/admin/operations/attendance-group",
    permKey: "operations_attendance",
    children: [
      { title: "Attendance Intelligence", href: "/admin/operations/attendance", icon: CalendarCheck },
      { title: "Youth Served (all programs)", href: "/admin/operations/youth-served", icon: Layers },
      { title: "Program Highlights", href: "/admin/operations/program-highlights", icon: Sparkles },
      { title: "Excursion Intelligence", href: "/admin/operations/excursion-intelligence", icon: MapPin },
      { title: "Events Intelligence", href: "/admin/operations/events-intelligence", icon: Sparkles },
      { title: "Attendance Reports", href: "/admin/operations/attendance-reports", icon: FileBarChart },
      { title: "Call-Outs", href: "/admin/operations/callouts", icon: PhoneOff },
      { title: "Juniors Aftercare Intelligence", href: "/admin/operations/smile-lab-attendance", icon: Smile },
    ],
  },
  {
    title: "Transportation",
    description: "Driver & Route Management",
    icon: Bus,
    href: "/admin/operations/transportation",
    permKey: "operations_transportation",
    children: [
      { title: "Transportation Intelligence", href: "/admin/operations/transportation/intelligence", icon: Gauge },
      { title: "Drivers", href: "/admin/operations/transportation/drivers", icon: UserCheck },
      { title: "Youth Profiles", href: "/admin/operations/transportation/youth", icon: Users },
      { title: "Trips & Pay", href: "/admin/operations/transportation/runs", icon: Radio },
      { title: "Incident Reports", href: "/admin/operations/transportation/incidents", icon: AlertTriangle },
      { title: "Impact Reports", href: "/admin/operations/transportation/impact-reports", icon: FileText },
    ],
  },
  {
    title: "Meal Tracker",
    description: "Meal counter, nutrition & reports",
    icon: UtensilsCrossed,
    href: "/admin/operations/meal-tracker",
    permKey: "operations_meal_tracker",
    children: [
      { title: "Meal Intelligence", href: "/admin/operations/meal-reports", icon: BarChart3 },
      { title: "Meal Setup", href: "/admin/operations/meal-tracker", icon: UtensilsCrossed },
    ],
  },
  // One place in the building: the Gym Board on the wall. Everything that
  // ends up on it is planned inside Practice Plan — the drills, the verse and
  // both teams' Workout Plans are tabs there, so they need no sidebar lines of
  // their own. Battle Team Intelligence reads what the kids actually logged,
  // which is a different job, so it stays. NBT doesn't log on the wall, so its
  // Intelligence page has no sidebar line. (Josh, 2026-10-03.)
  {
    title: "Gym Board",
    description: "The practice plan and the S&C plans behind the gym board",
    icon: Monitor,
    href: "/admin/operations/practice-plan",
    permKey: "operations_practice_plan",
    children: [
      { title: "Practice Plan", href: "/admin/operations/practice-plan", icon: ClipboardList },
      { title: "Daily Duties Intelligence", href: "/admin/operations/daily-duties", icon: Sparkles },
      { title: "Battle Team Intelligence", href: "/strength-coach/intelligence", icon: BarChart3, external: true },
      { title: "75 Hard", href: "/hard-75", icon: Flame, external: true },
    ],
  },
  {
    title: "Weight Watchers",
    description: "Weekly weigh-ins & weight tracking",
    icon: Scale,
    href: "/admin/operations/weight-watchers",
    permKey: "operations_weight_watchers",
  },
  {
    title: "Scripture Coach",
    description: "Scripture & talking points for a youth conversation",
    icon: BookOpenCheck,
    href: "/admin/operations/scripture-coach",
    permKey: "operations_scripture_coach",
    children: [
      {
        title: "Scripture Coach Intelligence",
        href: "/admin/operations/scripture-coach-intelligence",
        icon: HeartHandshake,
      },
      { title: "New Session", href: "/admin/operations/scripture-coach", icon: BookOpenCheck },
    ],
  },
  {
    // A separate programme -- Cape May Tech students, two afternoons a week --
    // in its own tables, so nothing NLA reports can pick it up by accident.
    title: "Hawk Squad",
    description: "Cape May Tech students — registration, check-in, attendance",
    icon: Bird,
    href: "/admin/operations/hawk-squad/registrations",
    permKey: "operations_hawk_squad",
    children: [
      { title: "Hawk Squad Intelligence", href: "/admin/operations/hawk-squad/intelligence", icon: BarChart3 },
      { title: "Registrations", href: "/admin/operations/hawk-squad/registrations", icon: Users },
      { title: "Form Editor", href: "/admin/operations/hawk-squad/form-builder", icon: Settings2 },
      { title: "Registration Form", href: "/hawk-squad/register", icon: ClipboardList, external: true },
    ],
  },
  {
    // BAM -- Body and Mind -- the Friday behavior incentive with Cape May
    // County Special Services. Its own tables, the same pages as Hawk Squad.
    title: "BAM",
    description: "Body and Mind — Friday behavior incentive with Special Services",
    icon: Brain,
    href: "/admin/operations/bam/registrations",
    permKey: "operations_bam",
    children: [
      { title: "BAM Intelligence", href: "/admin/operations/bam/intelligence", icon: BarChart3 },
      { title: "Registrations", href: "/admin/operations/bam/registrations", icon: Users },
      { title: "Form Editor", href: "/admin/operations/bam/form-builder", icon: Settings2 },
      { title: "Registration Form", href: "/bam/register", icon: ClipboardList, external: true },
    ],
  },
  {
    title: "Forms & Waivers",
    description: "Build standalone forms & collect responses",
    icon: FileText,
    href: "/admin/operations/forms",
    permKey: "operations_forms",
  },
];

export const SALES_MARKETING_TILES: PillarTile[] = [
  {
    title: "Revenue",
    description: "Track all incoming revenue",
    icon: HandCoins,
    href: "/admin/sales-marketing/revenue",
    permKey: "sales_marketing_revenue",
  },
  {
    title: "Master Revenue Tracker",
    description: "Monthly totals and year-to-date revenue",
    icon: BarChart3,
    href: "/admin/sales-marketing/master-revenue-tracker",
    permKey: "sales_marketing_master_revenue",
  },
  {
    title: "Supporters Database",
    description: "Hall of Fame & supporter imports",
    icon: Database,
    href: "/admin/sales-marketing/supporters-database",
    permKey: "sales_marketing_supporters",
  },
  {
    title: "Engagements",
    description: "Track supporter interactions & follow-ups",
    icon: MessageSquare,
    href: "/admin/sales-marketing/engagements",
    permKey: "sales_marketing_engagements",
  },
  {
    title: "Tasks",
    description: "Manage supporter tasks & deadlines",
    icon: ClipboardList,
    href: "/admin/sales-marketing/tasks",
    permKey: "sales_marketing_tasks",
  },
  {
    title: "Bulk Outreach",
    description: "Send targeted emails to supporters",
    icon: Mail,
    href: "/admin/sales-marketing/bulk-outreach",
    permKey: "sales_marketing_bulk_outreach",
  },
  {
    title: "Raffle",
    description: "Youth ticket sales & fundraising campaigns",
    icon: Ticket,
    href: "/admin/sales-marketing/raffle",
    permKey: "sales_marketing_raffle",
    children: [
      { title: "Raffle Intelligence Board", href: "/admin/sales-marketing/raffle-intelligence", icon: BarChart3 },
    ],
  },
  {
    title: "Invoice / Quote Generator",
    description: "One-off proposals & bills using the NLA template",
    icon: Receipt,
    href: "/admin/sales-marketing/invoice-quote-generator",
    permKey: "sales_marketing_invoice_quote_generator",
  },
];

export const FINANCE_TILES: PillarTile[] = [
  {
    title: "Billing",
    description: "Invoices & payment tracking",
    icon: Receipt,
    href: "/admin/finance/billing",
    permKey: "finance_billing",
  },
  {
    title: "CSBG Grant",
    description: "O.C.E.A.N. Inc. reimbursements",
    icon: ScrollText,
    href: "/admin/finance/csbg",
    permKey: "finance_csbg",
    children: [
      { title: "Invoice Generator", href: "/admin/finance/csbg/invoice", icon: FileText },
      { title: "Budget vs. Actual", href: "/admin/finance/csbg/budget", icon: BarChart3 },
      { title: "Document Checklist", href: "/admin/finance/csbg/checklist", icon: ClipboardCheck },
      { title: "Status Dashboard", href: "/admin/finance/csbg/dashboard", icon: LayoutDashboard },
      { title: "Submission Log", href: "/admin/finance/csbg/submissions", icon: ScrollText },
    ],
  },
  {
    title: "Document Vault",
    description: "Centralized document hub",
    icon: Archive,
    href: "/admin/finance/vault",
    permKey: "finance_vault",
  },
];

// Permissions that aren't a sidebar tile of their own. Scripture Coach
// sessions must be signed off by someone other than the mentor who ran them,
// and this key is who may do that — so adding a reviewer is a checkbox in
// Staff Management rather than a code change.
export const OPERATIONS_EXTRA_SUBS: { key: string; label: string }[] = [
  {
    key: "operations_scripture_coach_reviewer",
    label: "Spiritual Development — Reviewer (can sign off sessions)",
  },
];

// Derive `{ key, label }[]` for AdminStaffManagement's sub-checkbox groups.
// Tiles without a permKey are skipped (no checkbox to render), and tiles that
// share a permKey collapse to one checkbox rather than rendering twice.
export function pillarSubsFromTiles(
  tiles: PillarTile[]
): { key: string; label: string }[] {
  const seen = new Set<string>();
  const subs: { key: string; label: string }[] = [];
  for (const t of tiles) {
    if (!t.permKey || seen.has(t.permKey)) continue;
    seen.add(t.permKey);
    subs.push({ key: t.permKey, label: t.title });
  }
  return subs;
}
