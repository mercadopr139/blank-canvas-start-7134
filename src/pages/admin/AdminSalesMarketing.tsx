import { BarChart3, HandCoins, Users, Database, MessageSquare, ClipboardList, LucideIcon } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";

interface SMTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

const baseTiles: SMTile[] = [
  {
    title: "Revenue",
    description: "Track all incoming revenue",
    icon: HandCoins,
    href: "/admin/sales-marketing/revenue",
  },
  {
    title: "Master Revenue Tracker",
    description: "Monthly totals and year-to-date revenue",
    icon: BarChart3,
    href: "/admin/sales-marketing/master-revenue-tracker",
  },
  {
    title: "NLA Donor/Sponsor History",
    description: "Supporters & 2026 receipts",
    icon: Users,
    href: "/admin/sales-marketing/supporters",
  },
  {
    title: "Supporters Database",
    description: "Hall of Fame & supporter imports",
    icon: Database,
    href: "/admin/sales-marketing/supporters-database",
  },
  {
    title: "Engagements",
    description: "Track supporter interactions & follow-ups",
    icon: MessageSquare,
    href: "/admin/sales-marketing/engagements",
  },
  {
    title: "Tasks",
    description: "Manage supporter tasks & deadlines",
    icon: ClipboardList,
    href: "/admin/sales-marketing/tasks",
  },
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminSalesMarketingIndex = () => null;

const sidebarCards: SectionCard[] = baseTiles.map((t) => ({
  title: t.title,
  description: t.description,
  href: t.href,
  icon: t.icon,
}));

const AdminSalesMarketing = () => (
  <AdminSectionLayout
    section="sales-marketing"
    title="Sales & Marketing"
    subtitle="Outreach & Retention"
    accent="green"
    accentHex="#22c55e"
    cards={sidebarCards}
    backHref="/admin/dashboard"
    storageKey="nla_sm_custom_cards"
  />
);

export default AdminSalesMarketing;
