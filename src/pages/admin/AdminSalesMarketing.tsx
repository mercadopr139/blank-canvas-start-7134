import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
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
    href: "/admin/sales-marketing/master-revenue-tracker",
  },
  {
    title: "NLA Donor/Sponsor History",
    description: "Supporters & 2026 receipts",
    icon: Users,
    href: "/admin/sales-marketing/supporters",
  },
];

// Index tile grid – rendered as the <Outlet> for /admin/sales-marketing
export const AdminSalesMarketingIndex = () => {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {baseTiles.map((tile) => (
          <Card
            key={tile.title}
            className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-green-500/50 hover:border-green-500"
            onClick={() => navigate(tile.href)}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-500/10 text-green-500">
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
