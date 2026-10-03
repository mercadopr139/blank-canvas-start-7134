import AdminSectionLayout from "@/components/admin/AdminSectionLayout";
import { useSidebarCards } from "@/hooks/useSidebarCards";
import { FINANCE_TILES } from "@/config/pillarTiles";

// Blank index – main panel is empty until a sidebar item is selected
export const AdminFinanceIndex = () => null;

const AdminFinance = () => {
  // Every line shows; the ones this person cannot open are shaded and locked.
  const sidebarCards = useSidebarCards(FINANCE_TILES);

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
