import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, BarChart3, ClipboardList, LucideIcon, CalendarCheck, FileBarChart, Settings2, Star, LogIn, Bus, UserCheck, Radio, PhoneOff, AlertTriangle, FileText, UtensilsCrossed, MapPin } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { Button } from "@/components/ui/button";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface OperationsTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  external?: boolean;
  // Permission key gating this tile's visibility. Super-admin and any
  // user granted this key in staff_permissions sees the tile; everyone
  // else has it filtered out before render.
  permKey?: string;
  children?: { title: string; href: string; icon: LucideIcon; external?: boolean }[];
}

const baseTiles: OperationsTile[] = [
  {
    title: "Registration",
    description: "Youth registration management",
    icon: ClipboardList,
    href: "/admin/operations/registration",
    permKey: "operations_registration",
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
    permKey: "operations_attendance",
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
    permKey: "operations_transportation",
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
    permKey: "operations_meal_tracker",
    children: [
      { title: "Meal Setup", href: "/admin/operations/meal-tracker", icon: UtensilsCrossed },
      { title: "Meal Reports", href: "/admin/operations/meal-reports", icon: BarChart3 },
    ],
  },
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminOperationsIndex = () => null;

const AdminOperations = () => {
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Hide sidebar tiles whose permission key the user doesn't have. While
  // permissions are loading, render everything so there's no flash of
  // empty UI; once loaded, the actual gate kicks in.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      baseTiles
        .filter((t) => permLoading || !t.permKey || hasPermission(t.permKey))
        .map((t) => ({
          title: t.title,
          description: t.description,
          href: t.href,
          icon: t.icon,
          external: t.external,
          children: t.children,
        })),
    [permLoading, hasPermission]
  );

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
      <Button
        size="sm"
        className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
        onClick={() => navigate("/excursion-check-in")}
      >
        <MapPin className="w-4 h-4 mr-1.5" />
        Excursion Check-In
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
