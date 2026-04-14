import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import nlaLogo from "@/assets/nla-logo-white.png";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Bus,
  MapPin,
  Layers,
} from "lucide-react";

interface Route {
  id: string;
  name: string;
}

type TripType = "regular" | "overflow" | "both_zones";

const TRIP_OPTIONS: { value: TripType; label: string; icon: typeof Bus }[] = [
  { value: "regular", label: "Regular Trip", icon: MapPin },
  { value: "overflow", label: "Overflow", icon: Layers },
  { value: "both_zones", label: "Both Zones", icon: Bus },
];

export default function TransportTripDetails() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const zone = searchParams.get("zone") || "";

  const [driverId, setDriverId] = useState("");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [tripType, setTripType] = useState<TripType | null>(null);
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
    setDriverId(driver.id);

    if (!zone || !["Woodbine", "Wildwood"].includes(zone)) {
      navigate("/transport/dashboard", { replace: true });
      return;
    }

    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/get-transport-dashboard`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch {
      console.error("Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  /** Map the user's trip-type selection to the correct route_id */
  const getRouteId = (): string | null => {
    if (!tripType) return null;
    if (tripType === "regular") {
      return routes.find((r) => r.name === zone)?.id ?? null;
    }
    if (tripType === "overflow") {
      return routes.find((r) => r.name === "Overflow")?.id ?? null;
    }
    // both_zones
    return routes.find((r) => r.name === "Both")?.id ?? null;
  };

  const handleStartRun = async () => {
    const routeId = getRouteId();
    if (!routeId || !runType || !driverId) return;
    setStarting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `${supabaseUrl}/functions/v1/start-transport-run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            driver_id: driverId,
            route_id: routeId,
            run_type: runType,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: data.error || "Failed to start run",
          variant: "destructive",
        });
        return;
      }

      const routeName =
        tripType === "regular"
          ? zone
          : tripType === "overflow"
          ? "Overflow"
          : "Both";

      sessionStorage.setItem(
        "transport_run",
        JSON.stringify({
          run_id: data.run_id,
          route_id: routeId,
          route_name: routeName,
          run_type: runType,
          started_at: data.started_at,
        })
      );

      toast({
        title: "Run started!",
        description: `${zone} — ${tripType === "regular" ? "Regular" : tripType === "overflow" ? "Overflow" : "Both Zones"} — ${runType}`,
      });
      navigate("/transport/run");
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const canStart = tripType && runType && !starting;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  const zoneColor =
    zone === "Woodbine"
      ? { bg: "bg-[#D4A017]/20", border: "border-[#D4A017]", text: "text-[#D4A017]" }
      : { bg: "bg-[#800020]/20", border: "border-[#800020]", text: "text-[#C8385A]" };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-4 py-6 select-none">
      {/* Back */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => navigate("/transport/dashboard")}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors touch-manipulation"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Zone header */}
      <div className={`w-full max-w-md rounded-2xl ${zoneColor.bg} ${zoneColor.border} border-2 p-4 flex items-center justify-center gap-3 mb-6`}>
        <MapPin className={`w-6 h-6 ${zoneColor.text}`} />
        <h1 className="text-white text-2xl font-bold">{zone}</h1>
      </div>

      {/* Logo divider */}
      <img src={nlaLogo} alt="NLA" className="h-10 w-auto opacity-40 mb-6" />

      {/* Trip Type */}
      <div className="w-full max-w-md mb-8">
        <p className="text-white/50 text-xs uppercase tracking-widest mb-3 text-center">
          Trip Type
        </p>
        <div className="grid grid-cols-1 gap-3">
          {TRIP_OPTIONS.map((opt) => {
            const isSelected = tripType === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setTripType(isSelected ? null : opt.value)}
                className={`p-4 rounded-2xl border-2 transition-all active:scale-[0.97] touch-manipulation flex items-center gap-4 ${
                  isSelected
                    ? `${zoneColor.bg} ${zoneColor.border} text-white`
                    : "bg-white/5 border-white/20 text-white/70"
                }`}
              >
                <Icon
                  className={`w-7 h-7 ${isSelected ? zoneColor.text : "text-white/40"}`}
                />
                <span className="text-base font-bold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Run Type */}
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
            <ArrowUp
              className={`w-7 h-7 ${
                runType === "pickup" ? "text-green-400" : "text-white/40"
              }`}
            />
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
            <ArrowDown
              className={`w-7 h-7 ${
                runType === "dropoff" ? "text-amber-400" : "text-white/40"
              }`}
            />
            <span className="text-base font-bold">Dropoff</span>
          </button>
        </div>
      </div>

      {/* Start Run */}
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

      <p className="text-white/20 text-xs mt-8">
        No Limits Academy • Transportation
      </p>
    </div>
  );
}
