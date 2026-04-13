import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Target, Dumbbell, Zap, Building2, User } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";

const FOCUS_AREAS = [
  {
    key: "nla",
    title: "NLA",
    subtitle: "No Limits Academy",
    icon: Target,
    accent: "#ef4444",
    glow: "rgba(239,68,68,0.35)",
    gradient: "linear-gradient(145deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.03) 100%)",
  },
  {
    key: "usa-boxing",
    title: "USA Boxing",
    subtitle: "USA Boxing Programs",
    icon: Dumbbell,
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.30)",
    gradient: "linear-gradient(145deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.02) 100%)",
  },
  {
    key: "quikhit",
    title: "QUIKHIT",
    subtitle: "QUIKHIT Operations",
    icon: Zap,
    accent: "#e4e4e7",
    glow: "rgba(228,228,231,0.20)",
    gradient: "linear-gradient(145deg, rgba(228,228,231,0.08) 0%, rgba(228,228,231,0.02) 100%)",
  },
  {
    key: "fcusa",
    title: "FCUSA",
    subtitle: "FCUSA Programs",
    icon: Building2,
    accent: "#71717a",
    glow: "rgba(113,113,122,0.25)",
    gradient: "linear-gradient(145deg, rgba(113,113,122,0.08) 0%, rgba(113,113,122,0.02) 100%)",
  },
  {
    key: "personal",
    title: "Personal",
    subtitle: "Personal Goals & Tasks",
    icon: User,
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.30)",
    gradient: "linear-gradient(145deg, rgba(167,139,250,0.10) 0%, rgba(167,139,250,0.02) 100%)",
  },
];

const AdminPDTaskManager = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Back" className="text-zinc-400 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">PD Task Manager</h1>
              <p className="text-xs text-zinc-500 font-medium">Select a Focus Area</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <div className="flex justify-center mb-14">
          <img src={nlaLogo} alt="No Limits Academy" className="h-24 sm:h-32 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {FOCUS_AREAS.map((area) => (
            <button
              key={area.key}
              onClick={() => navigate(`/admin/signals/${area.key}`)}
              className="group relative text-left rounded-2xl transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
            >
              <div
                className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                style={{ background: area.glow }}
              />
              <div
                className="relative rounded-2xl border-2 p-7 min-h-[200px] flex flex-col justify-between transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl"
                style={{ borderColor: area.accent, background: area.gradient }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${area.accent}18`, color: area.accent }}
                >
                  <area.icon className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-white mb-1">{area.title}</h2>
                  <p className="text-xs text-zinc-500 font-medium mb-4">{area.subtitle}</p>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide group-hover:brightness-125" style={{ color: area.accent }}>
                    <span>Open</span>
                    <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminPDTaskManager;
