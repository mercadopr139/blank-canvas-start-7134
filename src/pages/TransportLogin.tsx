import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import nlaLogo from "@/assets/nla-logo-white.png";
import { Loader2, Bus, ChevronDown, AlertCircle, Delete } from "lucide-react";

interface Driver {
  id: string;
  name: string;
}

export default function TransportLogin() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [driversLoading, setDriversLoading] = useState(true);
  const [showDriverList, setShowDriverList] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      // Use edge function to fetch active drivers (no auth required for names only)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/list-active-drivers`, {
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setDrivers(data.drivers || []);
      }
    } catch (err) {
      console.error("Failed to load drivers");
    } finally {
      setDriversLoading(false);
    }
  };

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length >= 6) return;
      setPin((prev) => prev + digit);
      setError("");
    },
    [pin]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError("");
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setError("");
  }, []);

  const handleSubmit = async () => {
    if (!selectedDriver) {
      setError("Please select your name first.");
      return;
    }
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/validate-driver-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          driver_id: selectedDriver.id,
          pin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.valid) {
        setError(data.error || "Incorrect PIN. Try again.");
        setPin("");
        return;
      }

      // Store driver session in sessionStorage
      sessionStorage.setItem(
        "transport_driver",
        JSON.stringify({ id: selectedDriver.id, name: selectedDriver.name })
      );

      toast({
        title: `Welcome, ${selectedDriver.name}!`,
        description: "Ready to start your run.",
      });

      navigate("/transport/dashboard");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const pinDots = Array.from({ length: 6 }, (_, i) => i < pin.length);

  const keypadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "⌫"];

  return (
    <div className="min-h-screen bg-[#0A1628] flex flex-col items-center px-4 py-6 select-none">
      {/* Logo */}
      <img src={nlaLogo} alt="No Limits Academy" className="h-16 w-auto mb-2" />
      <div className="flex items-center gap-2 mb-8">
        <Bus className="w-5 h-5 text-[#DC2626]" />
        <h1 className="text-white text-lg font-bold tracking-wide uppercase">
          Transportation
        </h1>
      </div>

      {/* Driver Selection */}
      <div className="w-full max-w-xs mb-6">
        <button
          onClick={() => setShowDriverList(!showDriverList)}
          className="w-full flex items-center justify-between bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-left touch-manipulation"
        >
          <span className={selectedDriver ? "text-white font-medium" : "text-white/50"}>
            {driversLoading
              ? "Loading drivers..."
              : selectedDriver
              ? selectedDriver.name
              : "Select Your Name"}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-white/50 transition-transform ${showDriverList ? "rotate-180" : ""}`}
          />
        </button>

        {showDriverList && (
          <div className="mt-2 bg-white/10 border border-white/20 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
            {drivers.length === 0 ? (
              <div className="px-4 py-3 text-white/50 text-sm text-center">
                No active drivers found
              </div>
            ) : (
              drivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => {
                    setSelectedDriver(driver);
                    setShowDriverList(false);
                    setPin("");
                    setError("");
                  }}
                  className={`w-full text-left px-4 py-3 text-white font-medium hover:bg-white/10 transition-colors touch-manipulation ${
                    selectedDriver?.id === driver.id ? "bg-[#DC2626]/20 text-[#DC2626]" : ""
                  }`}
                >
                  {driver.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* PIN Display */}
      <div className="mb-2">
        <p className="text-white/60 text-xs uppercase tracking-widest text-center mb-3">
          Enter Your PIN
        </p>
        <div className="flex gap-3 justify-center">
          {pinDots.map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                filled ? "bg-[#DC2626] scale-110" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mt-3 mb-1 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 mt-6 w-full max-w-xs">
        {keypadKeys.map((key) => {
          const isAction = key === "CLR" || key === "⌫";
          return (
            <button
              key={key}
              onClick={() => {
                if (key === "CLR") handleClear();
                else if (key === "⌫") handleBackspace();
                else handleKeyPress(key);
              }}
              disabled={loading}
              className={`h-16 rounded-xl text-xl font-bold transition-all active:scale-95 touch-manipulation ${
                isAction
                  ? "bg-white/5 text-white/60 hover:bg-white/10 text-base"
                  : "bg-white/10 text-white hover:bg-white/20 active:bg-[#DC2626]/30"
              }`}
            >
              {key === "⌫" ? <Delete className="w-6 h-6 mx-auto" /> : key}
            </button>
          );
        })}
      </div>

      {/* Start Run Button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !selectedDriver || pin.length < 4}
        className={`mt-8 w-full max-w-xs py-4 rounded-xl text-lg font-bold uppercase tracking-wider transition-all touch-manipulation ${
          selectedDriver && pin.length >= 4 && !loading
            ? "bg-[#DC2626] text-white hover:bg-[#B91C1C] active:scale-[0.98] shadow-lg shadow-red-500/30"
            : "bg-white/5 text-white/30 cursor-not-allowed"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Verifying...
          </span>
        ) : (
          "Start Run"
        )}
      </button>

      <p className="text-white/30 text-xs mt-6">No Limits Academy • Transportation</p>
    </div>
  );
}
