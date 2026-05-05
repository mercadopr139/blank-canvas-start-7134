import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, HandCoins, Database, MessageSquare, ClipboardList, Mail, Plus } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

const baseTiles = [
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
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminSalesMarketingIndex = () => null;

const AdminSalesMarketing = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Sidebar items respect the per-item sub-permissions in
  // staff_permissions. While perms load, show everything to avoid flash.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      baseTiles
        .filter((t) => permLoading || !t.permKey || hasPermission(t.permKey))
        .map((t) => ({
          title: t.title,
          description: t.description,
          href: t.href,
          icon: t.icon,
        })),
    [permLoading, hasPermission]
  );

  const addRevenueAction = (
    <Button
      size="sm"
      className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
      onClick={() => navigate("/admin/sales-marketing/revenue?new=1")}
    >
      <Plus className="w-4 h-4 mr-1.5" />
      Add Revenue
    </Button>
  );

  return (
    <AdminSectionLayout
      section="sales-marketing"
      title="Sales & Marketing"
      subtitle="Outreach & Retention"
      accent="green"
      accentHex="#22c55e"
      cards={sidebarCards}
      backHref="/admin/dashboard"
      storageKey="nla_sm_custom_cards"
      sidebarAction={addRevenueAction}
    />
  );
};

export default AdminSalesMarketing;
