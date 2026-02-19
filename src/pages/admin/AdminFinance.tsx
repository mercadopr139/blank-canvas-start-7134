import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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

// Index tile grid – rendered as the <Outlet> for /admin/finance
export const AdminFinanceIndex = () => {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {baseTiles.map((tile) => (
          <Card
            key={tile.title}
            className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-sky-300/50 hover:border-sky-300"
            onClick={() => navigate(tile.href)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-sky-300/10 text-sky-300">
                  <tile.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{tile.title}</h3>
                  <p className="text-sm text-white/50 mt-1">{tile.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

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
