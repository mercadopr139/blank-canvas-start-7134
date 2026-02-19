import { Navigate } from "react-router-dom";
import { BarChart3, HandCoins, Users, LucideIcon } from "lucide-react";
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
    href: "/admin/finance/master-revenue-tracker",
  },
  {
    title: "NLA Donor/Sponsor History",
    description: "Supporters & 2026 receipts",
    icon: Users,
    href: "/admin/finance/supporters",
  },
];

// Index: redirect straight to the first sub-page
export const AdminSalesMarketingIndex = () => <Navigate to="/admin/sales-marketing/revenue" replace />;

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
