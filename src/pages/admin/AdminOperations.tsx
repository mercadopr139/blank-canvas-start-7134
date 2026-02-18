import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, BarChart3, ClipboardList, LucideIcon } from "lucide-react";

interface OperationsTile {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href: string;
  external?: boolean;
}

const tiles: OperationsTile[] = [
  {
    title: "Registration Form",
    description: "Public youth registration form",
    icon: ClipboardList,
    color: "text-[#bf0f3e]",
    href: "/register",
    external: true,
  },
  {
    title: "Registrations",
    description: "View and manage youth registrations",
    icon: Users,
    color: "text-[#bf0f3e]",
    href: "/admin/operations/registrations",
  },
  {
    title: "Registration Analytics",
    description: "Charts and insights from registrations",
    icon: BarChart3,
    color: "text-[#bf0f3e]",
    href: "/admin/operations/registration-analytics",
  },
];

const AdminOperations = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} className="text-white hover:bg-white/10 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Operations</h1>
            <p className="text-sm text-white/50">Manage registrations and schedules</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiles.map((tile) => (
            <Card
              key={tile.title}
              className="cursor-pointer hover:shadow-md transition-shadow bg-white/5 border-2 border-[#bf0f3e]/50 hover:border-[#bf0f3e]"
              onClick={() => tile.external ? window.open(tile.href, '_blank') : navigate(tile.href)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-[#bf0f3e]/10 ${tile.color}`}>
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
      </main>
    </div>
  );
};

export default AdminOperations;
