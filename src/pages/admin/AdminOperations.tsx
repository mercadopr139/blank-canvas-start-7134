import { Users, BarChart3, ClipboardList, LucideIcon, CalendarCheck, FileBarChart, Settings2, Star } from "lucide-react";
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
  {
    title: "Attendance",
    description: "Daily attendance & Bald Eagles",
    icon: CalendarCheck,
    href: "/admin/operations/attendance",
  },
  {
    title: "Attendance Reports",
    description: "Run & export attendance reports",
    icon: FileBarChart,
    href: "/admin/operations/attendance-reports",
  },
  {
    title: "Form Builder",
    description: "Edit the registration form fields",
    icon: Settings2,
    href: "/admin/operations/form-builder",
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
