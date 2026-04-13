import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import nlaLogo from "@/assets/nla-logo-white.png";
import { MapPin, Loader2, LogOut, ArrowLeft } from "lucide-react";

export default function TransportDashboard() {
  const navigate = useNavigate();

  const [driverName, setDriverName] = useState("");
  const [youthCounts, setYouthCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = sessionStorage.getItem("transport_driver");
    if (!session) {
      navigate("/transport", { replace: true });
      return;
    }
    const driver = JSON.parse(session);
    setDriverName(driver.name);
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/get-transport-dashboard`, {
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setYouthCounts(data.youth_counts || {});
      }
    } catch {
      console.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("transport_driver");
    sessionStorage.removeItem("transport_run");
    navigate("/transport", { replace: true });
  };

  const zones = [
    { name: "Woodbine", color: "bg-[#DC2626]/20", border: "border-[#DC2626]", accent: "text-[#DC2626]" },
    { name: "Wildwood", color: "bg-[#2563EB]/20", border: "border-[#2563EB]", accent: "text-[#2563EB]" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-4 py-6 select-none">
      {/* Back Button */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => { sessionStorage.removeItem("transport_driver"); navigate("/transport"); }}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <div>
          <p className="text-white/50 text-xs uppercase tracking-widest">Welcome back</p>
          <h1 className="text-white text-2xl font-bold">{driverName}</h1>
        </div>
        <button
          onClick={handleLogout}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors touch-manipulation"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Logo divider */}
      <img src={nlaLogo} alt="NLA" className="h-10 w-auto opacity-40 mb-6" />

      {/* Zone Selection */}
      <div className="w-full max-w-md">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">
          Select Zone
        </p>
        <div className="grid grid-cols-2 gap-3">
          {zones.map((z) => (
            <button
              key={z.name}
              onClick={() => navigate(`/transport/trip-details?zone=${z.name}`)}
              className={`relative p-5 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex flex-col items-center gap-2 ${z.color} ${z.border} text-white`}
            >
              <MapPin className={`w-8 h-8 ${z.accent}`} />
              <span className="text-lg font-bold">{z.name}</span>
              <span className="text-xs font-medium text-white/70">
                {youthCounts[z.name] || 0} youth
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-white/20 text-xs mt-8">No Limits Academy • Transportation</p>
    </div>
  );
}
