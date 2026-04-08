import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import nlaLogo from "@/assets/nla-logo-white.png";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Loader2, ArrowUp, ArrowDown, Bus, LogOut, ArrowLeft } from "lucide-react";

interface Route {
  id: string;
  name: string;
}

export default function TransportDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [driverName, setDriverName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [youthCounts, setYouthCounts] = useState<Record<string, number>>({});
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [runType, setRunType] = useState<"pickup" | "dropoff" | null>(null);
  const [starting, setStarting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = sessionStorage.getItem("transport_driver");
    if (!session) {
      navigate("/transport", { replace: true });
      return;
    }
    const driver = JSON.parse(session);
    setDriverName(driver.name);
    setDriverId(driver.id);
    fetchData();
  }, []);

  const fetchData = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Fetch routes and youth counts via edge function
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
        setRoutes(data.routes || []);
        setYouthCounts(data.youth_counts || {});
      }
    } catch {
      console.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleStartRun = async () => {
    if (!selectedRoute || !runType || !driverId) return;
    setStarting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/start-transport-run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          driver_id: driverId,
          route_id: selectedRoute.id,
          run_type: runType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error || "Failed to start run", variant: "destructive" });
        return;
      }

      // Store run info for attendance screen
      sessionStorage.setItem(
        "transport_run",
        JSON.stringify({
          run_id: data.run_id,
          route_id: selectedRoute.id,
          route_name: selectedRoute.name,
          run_type: runType,
          started_at: data.started_at,
        })
      );

      toast({ title: "Run started!", description: `${selectedRoute.name} — ${runType}` });
      navigate("/transport/run");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("transport_driver");
    sessionStorage.removeItem("transport_run");
    navigate("/transport", { replace: true });
  };

  const getZoneIcon = (name: string) => {
    if (name === "Both") return Bus;
    return MapPin;
  };

  const getZoneColor = (name: string, selected: boolean) => {
    if (!selected) return "bg-white/5 border-white/20 text-white/70";
    switch (name) {
      case "Woodbine":
        return "bg-[#DC2626]/20 border-[#DC2626] text-white";
      case "Wildwood":
        return "bg-[#2563EB]/20 border-[#2563EB] text-white";
      case "Both":
        return "bg-purple-600/20 border-purple-500 text-white";
      default:
        return "bg-white/10 border-white/40 text-white";
    }
  };

  const getZoneAccent = (name: string) => {
    switch (name) {
      case "Woodbine": return "text-[#DC2626]";
      case "Wildwood": return "text-[#2563EB]";
      case "Both": return "text-purple-400";
      default: return "text-white/50";
    }
  };

  const getYouthCount = (routeName: string) => {
    if (routeName === "Both") {
      return (youthCounts["Woodbine"] || 0) + (youthCounts["Wildwood"] || 0);
    }
    return youthCounts[routeName] || 0;
  };

  const canStart = selectedRoute && runType && !starting;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
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

      {/* Route Selection */}
      <div className="w-full max-w-md mb-8">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">
          Select Route
        </p>
        <div className="grid grid-cols-2 gap-3">
          {routes
            .filter((r) => r.name !== "Both")
            .map((route) => {
              const Icon = getZoneIcon(route.name);
              const isSelected = selectedRoute?.id === route.id;
              const count = getYouthCount(route.name);
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRoute(isSelected ? null : route)}
                  className={`relative p-5 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex flex-col items-center gap-2 ${getZoneColor(route.name, isSelected)}`}
                >
                  <Icon className={`w-8 h-8 ${isSelected ? getZoneAccent(route.name) : "text-white/40"}`} />
                  <span className="text-lg font-bold">{route.name}</span>
                  <span className={`text-xs font-medium ${isSelected ? "text-white/70" : "text-white/40"}`}>
                    {count} youth
                  </span>
                </button>
              );
            })}
        </div>
        {/* Both zones option */}
        {routes.find((r) => r.name === "Both") && (
          <button
            onClick={() => {
              const both = routes.find((r) => r.name === "Both")!;
              setSelectedRoute(selectedRoute?.id === both.id ? null : both);
            }}
            className={`w-full mt-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex items-center justify-center gap-3 ${getZoneColor(
              "Both",
              selectedRoute?.name === "Both"
            )}`}
          >
            <Bus className={`w-6 h-6 ${selectedRoute?.name === "Both" ? "text-purple-400" : "text-white/40"}`} />
            <span className="text-base font-bold">Both Zones</span>
            <span className={`text-xs font-medium ${selectedRoute?.name === "Both" ? "text-white/70" : "text-white/40"}`}>
              {getYouthCount("Both")} youth
            </span>
          </button>
        )}
      </div>

      {/* Run Type Toggle */}
      <div className="w-full max-w-md mb-8">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">
          Run Type
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRunType(runType === "pickup" ? null : "pickup")}
            className={`p-4 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex flex-col items-center gap-2 ${
              runType === "pickup"
                ? "bg-green-600/20 border-green-500 text-white"
                : "bg-white/5 border-white/20 text-white/70"
            }`}
          >
            <ArrowUp className={`w-7 h-7 ${runType === "pickup" ? "text-green-400" : "text-white/40"}`} />
            <span className="text-base font-bold">Pickup</span>
          </button>
          <button
            onClick={() => setRunType(runType === "dropoff" ? null : "dropoff")}
            className={`p-4 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex flex-col items-center gap-2 ${
              runType === "dropoff"
                ? "bg-amber-600/20 border-amber-500 text-white"
                : "bg-white/5 border-white/20 text-white/70"
            }`}
          >
            <ArrowDown className={`w-7 h-7 ${runType === "dropoff" ? "text-amber-400" : "text-white/40"}`} />
            <span className="text-base font-bold">Dropoff</span>
          </button>
        </div>
      </div>

      {/* Start Run Button */}
      <button
        onClick={handleStartRun}
        disabled={!canStart}
        className={`w-full max-w-md py-5 rounded-2xl text-lg font-bold uppercase tracking-wider transition-all touch-manipulation ${
          canStart
            ? "bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98] shadow-lg shadow-red-500/30"
            : "bg-white/5 text-white/30 cursor-not-allowed"
        }`}
      >
        {starting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Starting...
          </span>
        ) : (
          "Start Run"
        )}
      </button>

      <p className="text-white/20 text-xs mt-8">No Limits Academy • Transportation</p>
    </div>
  );
}
