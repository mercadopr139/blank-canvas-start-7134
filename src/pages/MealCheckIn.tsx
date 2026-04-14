import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Undo2, AlertTriangle, Shield, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import mealPlateIcon from "@/assets/meal-plate-icon.png";
import nlaLogo from "@/assets/nla-logo-white.png";

const MealCheckIn = () => {
  const navigate = useNavigate();
  const [eventId, setEventId] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [foodItems, setFoodItems] = useState<{ food_name: string }[]>([]);
  const [noEvent, setNoEvent] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [flash, setFlash] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const [pulse, setPulse] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Submit flow state
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadToday = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("meal_events")
      .select("id, meal_count, is_closed")
      .eq("event_date", today)
      .maybeSingle();
    if (data) {
      setEventId(data.id);
      setMealCount(data.meal_count);
      setIsClosed(data.is_closed ?? false);
      setNoEvent(false);
      const { data: items } = await supabase
        .from("meal_items")
        .select("food_name")
        .eq("meal_event_id", data.id)
        .order("sort_order");
      setFoodItems(items || []);
    } else {
      setNoEvent(true);
    }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Visibility listener for stale data
  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") loadToday(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [loadToday]);

  // Realtime subscription
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel("meal-checkins-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meal_checkins", filter: `meal_event_id=eq.${eventId}` }, () => {
        setMealCount((c) => c + 1);
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "meal_checkins", filter: `meal_event_id=eq.${eventId}` }, () => {
        setMealCount((c) => Math.max(0, c - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  const handleTap = async () => {
    if (!eventId || tapping || isClosed) return;
    setTapping(true);
    const { data, error } = await supabase.rpc("increment_meal_count", { _event_id: eventId });
    if (!error && data != null) {
      setMealCount(data);
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
      setCanUndo(true);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setCanUndo(false), 30000);
    }
    setTapping(false);
  };

  const handleUndo = async () => {
    if (!eventId) return;
    const { data, error } = await supabase.rpc("decrement_meal_count", { _event_id: eventId });
    if (!error && data != null) {
      setMealCount(data);
      setCanUndo(false);
      toast("Last meal undone");
    }
  };

  const handleSubmitMealCount = async () => {
    if (!eventId || submitting) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("meal_events")
      .update({ is_closed: true, closed_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) {
      toast.error("Failed to submit meal count");
      setSubmitting(false);
      return;
    }
    setIsClosed(true);
    setShowConfirm(false);
    setShowSuccess(true);
    setTimeout(() => {
      navigate("/admin/dashboard");
    }, 3000);
    setSubmitting(false);
  };

  const foodEmojis = ["🍗", "🧀", "🥦", "🍝", "🥗", "🍞", "🥩", "🌽"];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
      {/* Admin link */}
      <button
        onClick={() => navigate("/admin/operations/meal-tracker")}
        className="absolute top-4 right-4 text-white/20 text-xs hover:text-white/40 transition"
      >
        Admin Setup →
      </button>

      {/* Flash overlay */}
      {flash && <div className="fixed inset-0 bg-green-500/20 pointer-events-none z-50 animate-in fade-in duration-200" />}

      {/* Logo */}
      <img src={mealPlateIcon} alt="Meal" className="w-20 h-20 mb-6 opacity-60" />

      <h1 className="text-4xl font-bold text-white mb-4">Meal Check-In</h1>

      {noEvent ? (
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <p className="text-amber-400 text-lg font-medium">Tonight's meal hasn't been set up yet.</p>
          <p className="text-zinc-500">Ask an admin to add it.</p>
        </div>
      ) : (
        <>
          {/* Food items display */}
          {foodItems.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg">
              {foodItems.map((item, i) => (
                <span key={i} className="bg-zinc-900 border border-zinc-800 text-white px-3 py-1.5 rounded-full text-sm">
                  {foodEmojis[i % foodEmojis.length]} {item.food_name}
                </span>
              ))}
            </div>
          )}

          {/* Counter */}
          <div className="mb-8 text-center">
            <p className="text-zinc-400 text-lg mb-1">Meals Served Tonight</p>
            <p
              className={cn("text-8xl font-black text-green-400 transition-transform", pulse && "scale-110")}
              style={{ transition: "transform 0.3s ease" }}
            >
              {mealCount}
            </p>
          </div>

          {isClosed ? (
            /* Closed state */
            <div className="w-full max-w-md text-center">
              <div className="min-h-[120px] flex items-center justify-center bg-zinc-900 border border-green-500/30 rounded-2xl px-6">
                <p className="text-green-400 text-xl font-semibold">
                  Tonight's meal has been submitted ✓
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* TAP button */}
              <button
                onClick={handleTap}
                disabled={tapping}
                className="w-full max-w-md min-h-[120px] bg-[#bf0f3e] hover:bg-[#bf0f3e]/90 active:scale-95 text-white text-2xl font-bold rounded-2xl transition-all shadow-[0_0_40px_rgba(191,15,62,0.4)] hover:shadow-[0_0_60px_rgba(191,15,62,0.6)] animate-pulse"
                style={{ animationDuration: "3s" }}
              >
                TAP TO COUNT MEAL
              </button>

              {/* Undo */}
              <div className="mt-6">
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={cn(
                    "flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition",
                    canUndo ? "text-zinc-300 hover:text-white hover:bg-zinc-800" : "text-zinc-700 cursor-not-allowed"
                  )}
                >
                  <Undo2 className="w-4 h-4" />
                  Undo Last
                </button>
              </div>

              {/* Submit Meal Count */}
              <div className="mt-4">
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 transition"
                >
                  <Send className="w-4 h-4" />
                  Submit Meal Count
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Coach Confirmation Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-6">
          <img src={mealPlateIcon} alt="NLA" className="w-16 h-16 mb-6 opacity-80" />
          <Shield className="w-16 h-16 text-[#bf0f3e] mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">NLA Coaches Only</h2>
          <p className="text-zinc-400 text-center max-w-sm mb-8 leading-relaxed">
            Only NLA coaches are permitted to submit the meal count for the night.
            Are you an NLA coach?
          </p>
          <div className="flex gap-4 w-full max-w-sm">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 h-14 rounded-xl border border-zinc-600 text-white font-semibold text-lg hover:bg-zinc-800 transition"
            >
              No, Go Back
            </button>
            <button
              onClick={handleSubmitMealCount}
              disabled={submitting}
              className="flex-1 h-14 rounded-xl bg-[#bf0f3e] text-white font-semibold text-lg hover:bg-[#bf0f3e]/90 transition disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Yes, I'm a Coach"}
            </button>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6">
          <p className="text-6xl mb-6">🎉</p>
          <h2 className="text-3xl font-bold text-green-400 mb-4">Meal Count Submitted!</h2>
          <p className="text-7xl font-black text-white mb-4">{mealCount}</p>
          <p className="text-zinc-400 text-lg">meals served tonight</p>
        </div>
      )}
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default MealCheckIn;
