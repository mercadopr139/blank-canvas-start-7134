import { useNavigate } from "react-router-dom";
import { Users, BarChart3, ClipboardList, LucideIcon, CalendarCheck, FileBarChart, Settings2, Star, LogIn, Bus, UserCheck, Radio, PhoneOff, AlertTriangle, FileText, UtensilsCrossed } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";

interface OperationsTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
  children?: { title: string; href: string; icon: LucideIcon; external?: boolean }[];
}

const baseTiles: OperationsTile[] = [
  {
    title: "Registration",
    description: "Youth registration management",
    icon: ClipboardList,
    href: "/admin/operations/registration",
    children: [
      { title: "Registration Form", href: "/register", icon: ClipboardList, external: true },
      { title: "Registrations", href: "/admin/operations/registrations", icon: Users },
      { title: "Registration Analytics", href: "/admin/operations/registration-analytics", icon: BarChart3 },
      { title: "Form Builder", href: "/admin/operations/form-builder", icon: Settings2 },
    ],
  },
  {
    title: "Attendance",
    description: "Attendance tracking & reports",
    icon: CalendarCheck,
    href: "/admin/operations/attendance-group",
    children: [
      { title: "Attendance Intelligence", href: "/admin/operations/attendance", icon: CalendarCheck },
      { title: "Attendance Reports", href: "/admin/operations/attendance-reports", icon: FileBarChart },
      { title: "Call-Outs", href: "/admin/operations/callouts", icon: PhoneOff },
      { title: "Lil Champ's Corner", href: "/admin/operations/lil-champs-attendance", icon: Star },
    ],
  },
  {
    title: "Transportation",
    description: "Driver & Route Management",
    icon: Bus,
    href: "/admin/operations/transportation",
    children: [
      { title: "Drivers", href: "/admin/operations/transportation/drivers", icon: UserCheck },
      { title: "Youth Profiles", href: "/admin/operations/transportation/youth", icon: Users },
      { title: "Trips & Pay", href: "/admin/operations/transportation/runs", icon: Radio },
      { title: "Incident Reports", href: "/admin/operations/transportation/incidents", icon: AlertTriangle },
      { title: "Impact Reports", href: "/admin/operations/transportation/impact-reports", icon: FileText },
    ],
  },
  {
    title: "Meal Tracker",
    description: "Meal counter, nutrition & reports",
    icon: UtensilsCrossed,
    href: "/admin/operations/meal-tracker",
    children: [
      { title: "Meal Setup", href: "/admin/operations/meal-tracker", icon: UtensilsCrossed },
      { title: "Meal Reports", href: "/admin/operations/meal-reports", icon: BarChart3 },
    ],
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
  children: t.children,
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
      <Button
        size="sm"
        className="w-full bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
        onClick={() => navigate("/meal-check-in")}
      >
        <UtensilsCrossed className="w-4 h-4 mr-1.5" />
        Meal Check-In
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
