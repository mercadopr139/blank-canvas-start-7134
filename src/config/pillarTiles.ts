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
  Users, BarChart3, ClipboardList, CalendarCheck, FileBarChart, Settings2,
  Star, Bus, UserCheck, Radio, PhoneOff, AlertTriangle, FileText,
  UtensilsCrossed, HandCoins, Database, MessageSquare, Mail, Receipt,
  ScrollText, ClipboardCheck, LayoutDashboard, Archive,
} from "lucide-react";

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
  {
    title: "Registration",
    description: "Youth registration management",
    icon: ClipboardList,
    href: "/admin/operations/registration",
    permKey: "operations_registration",
    children: [
      { title: "Registration Form", href: "/register", icon: ClipboardList, external: true },
      { title: "Registrations", href: "/admin/operations/registrations", icon: Users },
      { title: "Registration Analytics", href: "/admin/operations/registration-analytics", icon: BarChart3 },
      { title: "Form Builder", href: "/admin/operations/form-builder", icon: Settings2 },
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
      { title: "Attendance Reports", href: "/admin/operations/attendance-reports", icon: FileBarChart },
      { title: "Call-Outs", href: "/admin/operations/callouts", icon: PhoneOff },
      { title: "Lil Champ's Corner", href: "/admin/operations/lil-champs-attendance", icon: Star },
    ],
  },
  {
    title: "Transportation",
    description: "Driver & Route Management",
    icon: Bus,
    href: "/admin/operations/transportation",
    permKey: "operations_transportation",
    children: [
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
      { title: "Meal Setup", href: "/admin/operations/meal-tracker", icon: UtensilsCrossed },
      { title: "Meal Reports", href: "/admin/operations/meal-reports", icon: BarChart3 },
    ],
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

// Derive `{ key, label }[]` for AdminStaffManagement's sub-checkbox groups.
// Tiles without a permKey are skipped (no checkbox to render).
export function pillarSubsFromTiles(
  tiles: PillarTile[]
): { key: string; label: string }[] {
  return tiles
    .filter((t) => !!t.permKey)
    .map((t) => ({ key: t.permKey as string, label: t.title }));
}
