import { useNavigate } from "react-router-dom";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { LogOut, Briefcase, TrendingUp, DollarSign, ArrowLeft, Signal, Lock, Bus, Settings, Calendar } from "lucide-react";
import UpcomingEventsWidget from "@/components/admin/UpcomingEventsWidget";
import InviteAdminModal from "@/components/admin/InviteAdminModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/* ─── Pillar card config ─── */
const pillars = [
  {
    title: "Operations",
    subtitle: "Boxing & Youth Development",
    icon: Briefcase,
    href: "/admin/operations",
    permKey: "operations" as const,
    accent: "#bf0f3e",
    glow: "rgba(191,15,62,0.35)",
    gradient: "linear-gradient(145deg, rgba(191,15,62,0.12) 0%, rgba(191,15,62,0.03) 100%)",
  },
  {
    title: "Sales & Marketing",
    subtitle: "Outreach & Retention",
    icon: TrendingUp,
    href: "/admin/sales-marketing",
    permKey: "sales_marketing" as const,
    accent: "#22c55e",
    glow: "rgba(34,197,94,0.30)",
    gradient: "linear-gradient(145deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)",
  },
  {
    title: "Finance",
    subtitle: "Financial Systems & Personnel",
    icon: DollarSign,
    href: "/admin/finance",
    permKey: "finance" as const,
    accent: "#38bdf8",
    glow: "rgba(56,189,248,0.30)",
    gradient: "linear-gradient(145deg, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0.02) 100%)",
  },
];

/* ─── Secondary tile config ─── */
const secondaryTiles = [
  {
    title: "Driver Check-In",
    subtitle: "Transportation PIN login",
    icon: Bus,
    href: "/transport",
    permKey: "driver_checkin" as const,
    accent: "#60a5fa",
  },
  {
    title: "PD – Signals",
    subtitle: "Executive Focus & Daily Signals",
    icon: Signal,
    href: "/admin/signals",
    permKey: "pd_signals" as const,
    accent: "#a1a1aa",
  },
  {
    title: "Settings",
    subtitle: "Staff Management",
    icon: Settings,
    href: "/admin/staff",
    permKey: "settings" as const,
    accent: "#a1a1aa",
  },
];

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useStaffPermissions();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to site" className="text-zinc-400 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Command Center</h1>
              <p className="text-xs text-zinc-500 font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InviteAdminModal />
            <Button variant="outline" onClick={handleLogout} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
        {/* Logo */}
        <div className="flex justify-center mb-14 sm:mb-20">
          <img
            src={nlaLogoWhite}
            alt="No Limits Academy"
            className="h-36 sm:h-52 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]"
          />
        </div>

        {/* ── Hero pillar cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16 sm:mb-20">
          {pillars.map((p) => {
            const allowed = permLoading || hasPermission(p.permKey);
            return (
              <Tooltip key={p.title}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => allowed && navigate(p.href)}
                    disabled={!allowed}
                    className="group relative text-left rounded-2xl transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    style={{ cursor: allowed ? "pointer" : "not-allowed" }}
                  >
                    {/* Glow layer */}
                    <div
                      className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                      style={{ background: p.glow }}
                    />

                    {/* Card body */}
                    <div
                      className={`relative rounded-2xl border-2 p-8 sm:p-10 min-h-[280px] sm:min-h-[320px] flex flex-col justify-between transition-all duration-300 ${
                        allowed
                          ? "group-hover:-translate-y-1 group-hover:shadow-2xl"
                          : "opacity-40"
                      }`}
                      style={{
                        borderColor: allowed ? p.accent : "rgba(255,255,255,0.08)",
                        background: allowed ? p.gradient : "rgba(255,255,255,0.02)",
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center mb-6"
                        style={{
                          background: `${p.accent}18`,
                          color: p.accent,
                        }}
                      >
                        <p.icon className="w-8 h-8" strokeWidth={1.8} />
                        {!allowed && (
                          <Lock className="w-4 h-4 absolute top-6 right-6 text-zinc-500" />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 flex flex-col justify-end">
                        <h2 className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-white mb-1.5">
                          {p.title}
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium mb-6">
                          {p.subtitle}
                        </p>

                        {/* Open button */}
                        <div
                          className={`inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-colors duration-200 ${
                            allowed ? "group-hover:brightness-125" : ""
                          }`}
                          style={{ color: allowed ? p.accent : "rgba(255,255,255,0.2)" }}
                        >
                          {allowed ? (
                            <>
                              <span>Open</span>
                              <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1">→</span>
                            </>
                          ) : (
                            <span>🔒 Locked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                {!allowed && (
                  <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
                    Admin access required
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-white/[0.04] mb-10" />

        {/* ── Secondary tier ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {/* Upcoming Events gets its own slot */}
          <div className="sm:col-span-1">
            <UpcomingEventsWidget />
          </div>

          {secondaryTiles.map((t) => {
            const allowed = permLoading || hasPermission(t.permKey);
            return (
              <Tooltip key={t.title}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => allowed && navigate(t.href)}
                    disabled={!allowed}
                    className={`group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                      allowed
                        ? "hover:bg-white/[0.04] hover:border-white/[0.12] cursor-pointer"
                        : "opacity-30 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                      style={{
                        background: `${t.accent}12`,
                        color: t.accent,
                      }}
                    >
                      <t.icon className="w-4.5 h-4.5" strokeWidth={1.8} />
                      {!allowed && (
                        <Lock className="w-3 h-3 absolute top-4 right-4 text-zinc-600" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200 mb-0.5">{t.title}</h3>
                    <p className="text-[11px] text-zinc-600">{t.subtitle}</p>
                  </button>
                </TooltipTrigger>
                {!allowed && (
                  <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
                    Admin access required
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
