import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { SALES_MARKETING_TILES } from "@/config/pillarTiles";

// Blank index – main panel is empty until a sidebar item is selected
export const AdminSalesMarketingIndex = () => null;

const AdminSalesMarketing = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Sidebar items respect the per-item sub-permissions in
  // staff_permissions. While perms load, show everything to avoid flash.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      SALES_MARKETING_TILES
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
