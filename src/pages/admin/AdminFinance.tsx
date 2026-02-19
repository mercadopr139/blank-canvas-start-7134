import { Receipt, ShieldCheck, LucideIcon } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";

interface FinanceTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

const baseTiles: FinanceTile[] = [
  {
    title: "Billing",
    description: "Invoices & payment tracking",
    icon: Receipt,
    href: "/admin/finance/billing",
  },
  {
    title: "Insurance",
    description: "Policies & coverage",
    icon: ShieldCheck,
    href: "/admin/finance/insurance",
  },
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminFinanceIndex = () => null;

const sidebarCards: SectionCard[] = baseTiles.map((t) => ({
  title: t.title,
  description: t.description,
  href: t.href,
  icon: t.icon,
}));

const AdminFinance = () => (
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

export default AdminFinance;
