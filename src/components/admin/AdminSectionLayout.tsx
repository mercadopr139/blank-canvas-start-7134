import { useState, type ReactNode } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Menu, X, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SectionCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

interface AdminSectionLayoutProps {
  section: "operations" | "sales-marketing" | "finance";
  title: string;
  subtitle: string;
  accent: string;
  accentHex: string;
  cards: SectionCard[];
  backHref: string;
  storageKey: string;
  /** Optional action button rendered at the top of the sidebar */
  sidebarAction?: ReactNode;
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
  sidebarAction,
}: AdminSectionLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const ac = accentClasses[accent] ?? accentClasses.sky;

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Sidebar content (shared between desktop and mobile)
  const SidebarContent = () => (
    <nav className="flex flex-col h-full">
      {/* Optional action button */}
      {sidebarAction && (
        <div className="px-3 py-3 border-b border-white/10">
          {sidebarAction}
        </div>
      )}

      {/* Card list */}
      <div className="flex-1 overflow-y-auto py-2">
        {cards.map((card) => {
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
            </div>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top header — always visible */}
      <header className="bg-black border-b border-white/10 flex-shrink-0 z-30">
        <div className="px-4 py-4 flex items-center gap-3">
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

        <main className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminSectionLayout;
