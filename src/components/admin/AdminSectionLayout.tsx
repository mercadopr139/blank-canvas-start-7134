import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Menu, X, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";

// All known modules that can be added as sidebar items
const KNOWN_MODULES: { label: string; href: string }[] = [
  { label: "Registrations", href: "/admin/operations/registrations" },
  { label: "Registration Analytics", href: "/admin/operations/registration-analytics" },
  { label: "Registration Form (external)", href: "/register" },
  { label: "Revenue", href: "/admin/sales-marketing/revenue" },
  { label: "Master Revenue Tracker", href: "/admin/sales-marketing/master-revenue-tracker" },
  { label: "NLA Donor/Sponsor History", href: "/admin/sales-marketing/supporters" },
  { label: "Billing / Invoices", href: "/admin/finance/billing" },
  { label: "Insurance", href: "/admin/finance/insurance" },
  { label: "Other (custom route)", href: "__other__" },
];

export interface SectionCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
  custom?: boolean;
}

interface AdminSectionLayoutProps {
  section: "operations" | "sales-marketing" | "finance";
  title: string;
  subtitle: string;
  accent: string;         // e.g. "red" | "green" | "sky"
  accentHex: string;      // e.g. "#bf0f3e"
  cards: SectionCard[];
  backHref: string;
  storageKey: string;
}

// Accent-specific Tailwind classes
const accentClasses: Record<string, {
  border: string;
  borderHover: string;
  icon: string;
  iconBg: string;
  link: string;
  activeBg: string;
  activeBorder: string;
  button: string;
  buttonText: string;
}> = {
  red: {
    border: "border-[#bf0f3e]/50",
    borderHover: "hover:border-[#bf0f3e]",
    icon: "text-[#bf0f3e]",
    iconBg: "bg-[#bf0f3e]/10",
    link: "text-[#bf0f3e]",
    activeBg: "bg-[#bf0f3e]/10",
    activeBorder: "border-l-2 border-[#bf0f3e]",
    button: "bg-[#bf0f3e] hover:bg-[#bf0f3e]/80",
    buttonText: "text-white",
  },
  green: {
    border: "border-green-500/50",
    borderHover: "hover:border-green-500",
    icon: "text-green-500",
    iconBg: "bg-green-500/10",
    link: "text-green-500",
    activeBg: "bg-green-500/10",
    activeBorder: "border-l-2 border-green-500",
    button: "bg-green-600 hover:bg-green-500",
    buttonText: "text-white",
  },
  sky: {
    border: "border-sky-300/50",
    borderHover: "hover:border-sky-300",
    icon: "text-sky-300",
    iconBg: "bg-sky-300/10",
    link: "text-sky-300",
    activeBg: "bg-sky-300/10",
    activeBorder: "border-l-2 border-sky-300",
    button: "bg-sky-500 hover:bg-sky-400",
    buttonText: "text-white",
  },
};

const AdminSectionLayout = ({
  section,
  title,
  subtitle,
  accent,
  cards,
  backHref,
  storageKey,
}: AdminSectionLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const ac = accentClasses[accent] ?? accentClasses.sky;

  // Custom cards from localStorage — icons can't survive JSON round-trip, so restore Plus as fallback
  const [customCards, setCustomCards] = useState<SectionCard[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];
      const parsed: SectionCard[] = JSON.parse(stored);
      return parsed.map((c) => ({ ...c, icon: Plus }));
    } catch {
      return [];
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [customRoute, setCustomRoute] = useState("");

  const allCards = [...cards, ...customCards];

  const isActive = (href: string) => {
    if (href === `/admin/${section}`) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleCardClick = (card: SectionCard) => {
    setSidebarOpen(false);
    if (card.external) {
      window.open(card.href, "_blank");
    } else {
      navigate(card.href);
    }
  };

  const isOther = selectedModule === "__other__";
  const resolvedHref = isOther ? customRoute.trim() : selectedModule;
  const resolvedLabel = displayName.trim() ||
    KNOWN_MODULES.find((m) => m.href === selectedModule)?.label || "";
  const canAdd = resolvedLabel && resolvedHref && resolvedHref !== "__other__";

  const handleAddItem = () => {
    if (!canAdd) return;
    const isExternal = resolvedHref.startsWith("http") || resolvedHref === "/register";
    const newCard: SectionCard = {
      title: resolvedLabel,
      description: "",
      href: resolvedHref,
      icon: Plus,
      custom: true,
      external: isExternal,
    };
    const updated = [...customCards, newCard];
    setCustomCards(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setSelectedModule("");
    setDisplayName("");
    setCustomRoute("");
    setAddModalOpen(false);
  };

  // Sidebar content (shared between desktop and mobile)
  const SidebarContent = () => (
    <nav className="flex flex-col h-full">
      {/* + Add Card button */}
      <div className="px-3 py-3 border-b border-white/10">
        <Button
          size="sm"
          className={`w-full ${ac.button} ${ac.buttonText} text-sm font-medium`}
          onClick={() => { setSidebarOpen(false); setAddModalOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          + Add Sidebar Item
        </Button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto py-2">
      {allCards.map((card) => {
          const active = isActive(card.href);
          return (
            <div
              key={card.href + card.title}
              className={`group relative flex items-center transition-colors
                ${active
                  ? `${ac.activeBg} ${ac.activeBorder}`
                  : "hover:bg-white/5"
                }`}
            >
              <button
                onClick={() => handleCardClick(card)}
                className={`flex-1 text-left px-4 py-2.5 flex items-center gap-3 min-w-0
                  ${active ? `${ac.link} font-medium` : "text-white/70 hover:text-white"}`}
              >
                <card.icon className={`w-4 h-4 flex-shrink-0 ${active ? ac.icon : ""}`} />
                <span className="text-sm leading-tight truncate">{card.title}</span>
                {card.external && <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0 opacity-50" />}
              </button>
              {card.custom && (
                <button
                  onClick={() => {
                    const updated = customCards.filter((c) => !(c.href === card.href && c.title === card.title));
                    setCustomCards(updated);
                    localStorage.setItem(storageKey, JSON.stringify(updated));
                  }}
                  className="hidden group-hover:flex items-center justify-center w-6 h-6 mr-2 flex-shrink-0 text-white/40 hover:text-red-400 transition-colors"
                  title="Remove item"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );

  // Detect if we're on a sub-page (not the section root)
  const sectionRoot = `/admin/${section}`;
  const isOnSubPage = location.pathname !== sectionRoot && location.pathname.startsWith(sectionRoot);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top header — always visible */}
      <header className="bg-black border-b border-white/10 flex-shrink-0 z-30">
        <div className="px-4 py-4 flex items-center gap-3">
          {/* Back to dashboard */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backHref)}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-sm text-white/50">{subtitle}</p>
          </div>
          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white hover:bg-white/10 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-white/10 bg-black flex-col">
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50 w-64 bg-black border-r border-white/10 flex flex-col">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-auto">
          {isOnSubPage ? (
            // Sub-page: render Outlet (strips the full-page wrapper from sub-pages)
            <Outlet />
          ) : (
            // Section home: render Outlet (which is the index route = tile grid)
            <Outlet />
          )}
        </main>
      </div>

      {/* Add Sidebar Item Modal */}
      <Dialog open={addModalOpen} onOpenChange={(open) => {
        if (!open) { setSelectedModule(""); setDisplayName(""); setCustomRoute(""); }
        setAddModalOpen(open);
      }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add Sidebar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Item Type */}
            <div className="space-y-1.5">
              <Label className="text-white/80">Item Type <span className="text-red-400">*</span></Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select a module…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {KNOWN_MODULES.map((m) => (
                    <SelectItem key={m.href} value={m.href} className="hover:bg-white/10 focus:bg-white/10">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label className="text-white/80">Display Name <span className="text-white/40 font-normal">(optional override)</span></Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={KNOWN_MODULES.find((m) => m.href === selectedModule)?.label || "Label shown in sidebar"}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Custom route — only when "Other" selected */}
            {isOther && (
              <div className="space-y-1.5">
                <Label className="text-white/80">Custom Route <span className="text-red-400">*</span></Label>
                <Input
                  value={customRoute}
                  onChange={(e) => setCustomRoute(e.target.value)}
                  placeholder="/admin/custom-page or https://…"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddModalOpen(false)}
              className="text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              disabled={!canAdd}
              onClick={handleAddItem}
              className={`${ac.button} ${ac.buttonText}`}
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSectionLayout;

