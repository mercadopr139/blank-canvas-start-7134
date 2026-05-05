import { useMemo } from "react";
import { Receipt, ShieldCheck, LucideIcon, FileText, BarChart3, ClipboardCheck, LayoutDashboard, ScrollText, Archive } from "lucide-react";
import AdminSectionLayout, { SectionCard } from "@/components/admin/AdminSectionLayout";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface FinanceTile {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  permKey?: string;
  children?: { title: string; href: string; icon: LucideIcon }[];
}

const baseTiles: FinanceTile[] = [
  {
    title: "Billing",
    description: "Invoices & payment tracking",
    icon: Receipt,
    href: "/admin/finance/billing",
    permKey: "finance_billing",
  },
  {
    title: "CSBG Grant",
    description: "O.C.E.A.N. Inc. reimbursements",
    icon: ScrollText,
    href: "/admin/finance/csbg",
    permKey: "finance_csbg",
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
    permKey: "finance_vault",
  },
];

// Blank index – main panel is empty until a sidebar item is selected
export const AdminFinanceIndex = () => null;

const AdminFinance = () => {
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  // Filter sidebar cards by per-item permission. Show everything during
  // load to avoid an empty flash; the actual gate kicks in once perms
  // arrive.
  const sidebarCards = useMemo<SectionCard[]>(
    () =>
      baseTiles
        .filter((t) => permLoading || !t.permKey || hasPermission(t.permKey))
        .map((t) => ({
          title: t.title,
          description: t.description,
          href: t.href,
          icon: t.icon,
          children: t.children?.map((c) => ({ title: c.title, href: c.href, icon: c.icon })),
        })),
    [permLoading, hasPermission]
  );

  return (
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
};

export default AdminFinance;
