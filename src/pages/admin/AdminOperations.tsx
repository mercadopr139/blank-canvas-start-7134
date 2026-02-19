import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BarChart3, ClipboardList, LucideIcon } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";

interface OperationsTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
}

const baseTiles: OperationsTile[] = [
  {
    title: "Registration Form",
    description: "Public youth registration form",
    icon: ClipboardList,
    href: "/register",
    external: true,
  },
  {
    title: "Registrations",
    description: "View and manage youth registrations",
    icon: Users,
    href: "/admin/operations/registrations",
  },
  {
    title: "Registration Analytics",
    description: "Charts and insights from registrations",
    icon: BarChart3,
    href: "/admin/operations/registration-analytics",
  },
];

// Index tile grid – rendered as the <Outlet> for /admin/operations
export const AdminOperationsIndex = () => {
  const navigate = useNavigate();
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {baseTiles.map((tile) => (
          <Card
            key={tile.title}
            className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-[#bf0f3e]/50 hover:border-[#bf0f3e]"
            onClick={() =>
              tile.external
                ? window.open(tile.href, "_blank")
                : navigate(tile.href)
            }
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#bf0f3e]/10 text-[#bf0f3e]">
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
  external: t.external,
}));

const AdminOperations = () => (
  <AdminSectionLayout
    section="operations"
    title="Operations"
    subtitle="Boxing & Youth Development"
    accent="red"
    accentHex="#bf0f3e"
    cards={sidebarCards}
    backHref="/admin/dashboard"
    storageKey="nla_ops_custom_cards"
  />
);

export default AdminOperations;
