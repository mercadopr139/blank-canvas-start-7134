import { useNavigate } from "react-router-dom";
import { Users, BarChart3, ClipboardList, LucideIcon, CalendarCheck, FileBarChart, Settings2, Star, LogIn } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";

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
  {
    title: "Attendance Intelligence",
    description: "Live dashboard, insights & calendar",
    icon: CalendarCheck,
    href: "/admin/operations/attendance",
  },
  {
    title: "Attendance Reports",
    description: "Query & export attendance by date",
    icon: FileBarChart,
    href: "/admin/operations/attendance-reports",
  },
  {
    title: "Form Builder",
    description: "Edit the registration form fields",
    icon: Settings2,
    href: "/admin/operations/form-builder",
  },
  {
    title: "Lil Champ's Corner",
    description: "Attendance for Lil Champ's Corner",
    icon: Star,
    href: "/admin/operations/lil-champs-attendance",
  },
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminOperationsIndex = () => null;

const sidebarCards: SectionCard[] = baseTiles.map((t) => ({
  title: t.title,
  description: t.description,
  href: t.href,
  icon: t.icon,
  external: t.external,
}));

const AdminOperations = () => {
  const navigate = useNavigate();

  const checkInActions = (
    <div className="flex flex-col gap-2 w-full">
      <Button
        size="sm"
        className="w-full bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white text-sm font-medium"
        onClick={() => navigate("/check-in")}
      >
        <LogIn className="w-4 h-4 mr-1.5" />
        NLA Check-In
      </Button>
      <Button
        size="sm"
        className="w-full bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium"
        onClick={() => navigate("/check-in/lil-champs-corner")}
      >
        <Star className="w-4 h-4 mr-1.5" />
        Lil Champs Check-In
      </Button>
    </div>
  );

  return (
    <AdminSectionLayout
      section="operations"
      title="Operations"
      subtitle="Boxing & Youth Development"
      accent="red"
      accentHex="#bf0f3e"
      cards={sidebarCards}
      backHref="/admin/dashboard"
      storageKey="nla_ops_custom_cards"
      sidebarAction={checkInActions}
    />
  );
};

export default AdminOperations;
