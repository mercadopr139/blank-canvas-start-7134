import { Receipt, ShieldCheck, LucideIcon, FileText, BarChart3, ClipboardCheck, LayoutDashboard, ScrollText, Archive } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";

interface FinanceTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  children?: { title: string; href: string; icon: LucideIcon }[];
}

const baseTiles: FinanceTile[] = [
  {
    title: "Billing",
    description: "Invoices & payment tracking",
    icon: Receipt,
    href: "/admin/finance/billing",
  },
  {
    title: "CSBG Grant",
    description: "O.C.E.A.N. Inc. reimbursements",
    icon: ScrollText,
    href: "/admin/finance/csbg",
    children: [
      { title: "Invoice Generator", href: "/admin/finance/csbg/invoice", icon: FileText },
      { title: "Budget vs. Actual", href: "/admin/finance/csbg/budget", icon: BarChart3 },
      { title: "Document Checklist", href: "/admin/finance/csbg/checklist", icon: ClipboardCheck },
      { title: "Status Dashboard", href: "/admin/finance/csbg/dashboard", icon: LayoutDashboard },
      { title: "Submission Log", href: "/admin/finance/csbg/submissions", icon: ScrollText },
    ],
  },
  {
    title: "Document Vault",
    description: "Centralized document hub",
    icon: Archive,
    href: "/admin/finance/vault",
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
  children: t.children?.map((c) => ({ title: c.title, href: c.href, icon: c.icon })),
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
