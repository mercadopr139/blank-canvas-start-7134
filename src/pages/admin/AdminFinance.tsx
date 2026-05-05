import { useMemo } from "react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { FINANCE_TILES } from "@/config/pillarTiles";

// Blank index – main panel is empty until a sidebar item is selected
export const AdminFinanceIndex = () => null;

const AdminFinance = () => {
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Filter sidebar cards by per-item permission. Show everything during
  // load to avoid an empty flash; the actual gate kicks in once perms
  // arrive.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      FINANCE_TILES
        .filter((t) => permLoading || !t.permKey || hasPermission(t.permKey))
        .map((t) => ({
          title: t.title,
          description: t.description,
          href: t.href,
          icon: t.icon,
          children: t.children?.map((c) => ({ title: c.title, href: c.href, icon: c.icon })),
        })),
    [permLoading, hasPermission]
  );

  return (
    <AdminSectionLayout
      section="finance"
      title="Finance"
      subtitle="Financial Systems & Personnel"
      accent="sky"
      accentHex="#7dd3fc"
      cards={sidebarCards}
      backHref="/admin/dashboard"
      storageKey="nla_finance_custom_cards"
    />
  );
};

export default AdminFinance;
