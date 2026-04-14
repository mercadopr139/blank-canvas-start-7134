import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Undo2, Shield, Send, CheckCircle2, Plus, UtensilsCrossed, X, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

import nlaLogo from "@/assets/nla-logo-white.png";

interface FoodItem {
  id?: string;
  food_name: string;
}

const MealCheckIn = () => {
  const navigate = useNavigate();
  const [eventId, setEventId] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [noEvent, setNoEvent] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [flash, setFlash] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();
  const [pulse, setPulse] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [eventDate, setEventDate] = useState<string>("");
  const [donorName, setDonorName] = useState("");

  // Setup screen state
  const [setupDonor, setSetupDonor] = useState("");
  const [setupFoodInput, setSetupFoodInput] = useState("");
  const [setupFoodItems, setSetupFoodItems] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit sheet state
  const [editOpen, setEditOpen] = useState(false);
  const [editDonor, setEditDonor] = useState("");
  const [editFoodInput, setEditFoodInput] = useState("");

  // Submit flow state
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadToday = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("meal_events")
      .select("id, meal_count, is_closed, event_date, donor_name")
      .eq("event_date", today)
      .maybeSingle();
    if (data) {
      setEventId(data.id);
      setMealCount(data.meal_count);
      setIsClosed(data.is_closed ?? false);
      setEventDate(data.event_date);
      setDonorName(data.donor_name || "");
      setNoEvent(false);
      const { data: items } = await supabase
        .from("meal_items")
        .select("id, food_name")
        .eq("meal_event_id", data.id)
        .order("sort_order");
      setFoodItems(items || []);
    } else {
      setNoEvent(true);
    }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") loadToday(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [loadToday]);

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
    setTimeout(() => setShowSuccess(false), 3000);
    setSubmitting(false);
  };

  // ─── Setup: create meal event from kiosk ───
  const addSetupFood = () => {
    const name = setupFoodInput.trim();
    if (!name) return;
    setSetupFoodItems((prev) => [...prev, name]);
    setSetupFoodInput("");
  };

  const handleStartService = async () => {
    if (setupFoodItems.length === 0 || creating) return;
    setCreating(true);
    const today = new Date().toISOString().split("T")[0];
    const { data: ev, error } = await supabase
      .from("meal_events")
      .insert({ event_date: today, donor_name: setupDonor.trim() || null })
      .select()
      .single();
    if (error || !ev) {
      toast.error("Failed to create meal event");
      setCreating(false);
      return;
    }
    const itemRows = setupFoodItems.map((name, i) => ({
      meal_event_id: ev.id,
      food_name: name,
      sort_order: i,
    }));
    await supabase.from("meal_items").insert(itemRows);
    toast.success("Tonight's meal is ready!");
    setCreating(false);
    setSetupFoodItems([]);
    setSetupDonor("");
    await loadToday();
  };

  // ─── Edit sheet helpers ───
  const openEdit = () => {
    setEditDonor(donorName);
    setEditFoodInput("");
    setEditOpen(true);
  };

  const addEditFood = async () => {
    const name = editFoodInput.trim();
    if (!name || !eventId) return;
    const { data, error } = await supabase
      .from("meal_items")
      .insert({ meal_event_id: eventId, food_name: name, sort_order: foodItems.length })
      .select("id, food_name")
      .single();
    if (!error && data) {
      setFoodItems((prev) => [...prev, data]);
      setEditFoodInput("");
    }
  };

  const removeEditFood = async (id: string) => {
    await supabase.from("meal_items").delete().eq("id", id);
    setFoodItems((prev) => prev.filter((i) => i.id !== id));
  };

  const saveEditDonor = async () => {
    if (!eventId) return;
    await supabase.from("meal_events").update({ donor_name: editDonor.trim() || null }).eq("id", eventId);
    setDonorName(editDonor.trim());
  };

  const foodEmojis = ["🍗", "🧀", "🥦", "🍝", "🥗", "🍞", "🥩", "🌽"];

  const formattedDate = eventDate
    ? format(new Date(eventDate + "T12:00:00"), "MMMM d, yyyy")
    : "";

  // ─── Full-page closed state ───
  if (isClosed && !showSuccess) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
        <button
          onClick={() => navigate("/admin/operations/meal-tracker")}
          className="absolute top-4 right-4 text-white/20 text-xs hover:text-white/40 transition"
        >
          Admin Setup →
        </button>
        <img src={nlaLogo} alt="NLA" className="w-40 h-auto mb-8 opacity-80" />
        <CheckCircle2 className="w-24 h-24 text-green-400 mb-6" />
        <h1 className="text-4xl font-bold text-white mb-3">Meal Submitted!</h1>
        <p className="text-green-400 text-lg mb-8">
          {formattedDate}'s meal count has been officially closed.
        </p>
        <p className="text-7xl font-black text-white mb-2">{mealCount}</p>
        <p className="text-zinc-400 text-lg mb-6">Meals Served</p>
        {foodItems.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-lg">
            {foodItems.map((item, i) => (
              <span key={i} className="bg-zinc-900 border border-zinc-800 text-white px-3 py-1.5 rounded-full text-sm">
                {foodEmojis[i % foodEmojis.length]} {item.food_name}
              </span>
            ))}
          </div>
        )}
        <div className="w-full max-w-md border-t border-zinc-800 my-6" />
        <p className="text-zinc-500 text-sm mb-4">Need to log a previous night?</p>
        <button
          onClick={() => navigate("/admin/operations/meal-tracker")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-600 text-white text-sm hover:bg-zinc-800 transition"
        >
          <Plus className="w-4 h-4" />
          Add Meal for Another Date
        </button>
      </div>
    );
  }

  // ─── Setup screen (no event today) ───
  if (noEvent) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
        <button
          onClick={() => navigate("/admin/operations/meal-tracker")}
          className="absolute top-4 right-4 text-white/20 text-xs hover:text-white/40 transition"
        >
          Admin Setup →
        </button>

        <img src={nlaLogo} alt="NLA" className="w-40 h-auto mb-6 opacity-80" />
        <UtensilsCrossed className="w-16 h-16 mb-4" style={{ color: "#bf0f3e" }} />
        <h1 className="text-3xl font-bold text-white mb-2">Set Up Tonight's Meal</h1>
        <p className="text-zinc-400 mb-8">Add tonight's menu before service starts</p>

        <div className="w-full max-w-md space-y-4">
          {/* Donor */}
          <div>
            <label className="text-zinc-400 text-sm mb-1 block">Donor / Volunteer Name</label>
            <Input
              value={setupDonor}
              onChange={(e) => setSetupDonor(e.target.value)}
              placeholder="e.g. The Johnson Family"
              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-12"
            />
          </div>

          {/* Food item entry */}
          <div>
            <label className="text-zinc-400 text-sm mb-1 block">Add food item</label>
            <div className="flex gap-2">
              <Input
                value={setupFoodInput}
                onChange={(e) => setSetupFoodInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSetupFood(); } }}
                placeholder="e.g. Fried Chicken"
                className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-12 flex-1"
              />
              <button
                onClick={addSetupFood}
                disabled={!setupFoodInput.trim()}
                className="h-12 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {/* Food pills */}
          {setupFoodItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {setupFoodItems.map((name, i) => (
                <span key={i} className="bg-zinc-900 border border-zinc-700 text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                  {foodEmojis[i % foodEmojis.length]} {name}
                  <button
                    onClick={() => setSetupFoodItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Start Service */}
          <button
            onClick={handleStartService}
            disabled={setupFoodItems.length === 0 || creating}
            className="w-full h-14 rounded-xl text-white font-bold text-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#bf0f3e" }}
          >
            {creating ? "Setting up…" : "Start Service →"}
          </button>
        </div>

        <button
          onClick={() => navigate("/admin/operations/meal-tracker")}
          className="mt-8 text-white/20 text-xs hover:text-white/40 transition"
        >
          Admin Setup →
        </button>
      </div>
    );
  }

  // ─── Active kiosk screen ───
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
      <button
        onClick={() => navigate("/admin/operations/meal-tracker")}
        className="absolute top-4 right-4 text-white/20 text-xs hover:text-white/40 transition"
      >
        Admin Setup →
      </button>

      {flash && <div className="fixed inset-0 bg-green-500/20 pointer-events-none z-50 animate-in fade-in duration-200" />}

      <img src={nlaLogo} alt="NLA" className="w-48 h-auto mb-6 opacity-80" />
      <h1 className="text-4xl font-bold text-white mb-4">Meal Check-In</h1>

      {/* Food items display */}
      {foodItems.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-4 max-w-lg">
          {foodItems.map((item, i) => (
            <span key={i} className="bg-zinc-900 border border-zinc-800 text-white px-3 py-1.5 rounded-full text-sm">
              {foodEmojis[i % foodEmojis.length]} {item.food_name}
            </span>
          ))}
        </div>
      )}

      {/* Edit link */}
      <button
        onClick={openEdit}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs mb-6 transition"
      >
        <Pencil className="w-3 h-3" /> Edit Tonight's Meal
      </button>

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

      {/* TAP button */}
      <button
        onClick={handleTap}
        disabled={tapping}
        className="w-full max-w-md min-h-[120px] text-white text-2xl font-bold rounded-2xl transition-all shadow-[0_0_40px_rgba(191,15,62,0.4)] hover:shadow-[0_0_60px_rgba(191,15,62,0.6)] animate-pulse active:scale-95"
        style={{ backgroundColor: "#bf0f3e", animationDuration: "3s" }}
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

      {/* Submit */}
      <div className="mt-4">
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800/50 transition"
        >
          <Send className="w-4 h-4" />
          Submit Meal Count
        </button>
      </div>

      {/* Coach Confirmation Overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-6">
          <img src={nlaLogo} alt="NLA" className="w-16 h-16 mb-6 opacity-80" />
          <Shield className="w-16 h-16 mb-4" style={{ color: "#bf0f3e" }} />
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
              className="flex-1 h-14 rounded-xl text-white font-semibold text-lg transition disabled:opacity-50"
              style={{ backgroundColor: "#bf0f3e" }}
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

      {/* Edit Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="bg-zinc-950 border-zinc-800 rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white text-lg">Edit Tonight's Meal</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {/* Donor edit */}
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Donor / Volunteer Name</label>
              <div className="flex gap-2">
                <Input
                  value={editDonor}
                  onChange={(e) => setEditDonor(e.target.value)}
                  placeholder="e.g. The Johnson Family"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 flex-1"
                />
                <button
                  onClick={saveEditDonor}
                  className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-sm transition"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Add food */}
            <div>
              <label className="text-zinc-400 text-sm mb-1 block">Add food item</label>
              <div className="flex gap-2">
                <Input
                  value={editFoodInput}
                  onChange={(e) => setEditFoodInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEditFood(); } }}
                  placeholder="e.g. Mac & Cheese"
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 flex-1"
                />
                <button
                  onClick={addEditFood}
                  disabled={!editFoodInput.trim()}
                  className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold disabled:opacity-40 transition flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Current items */}
            <div className="space-y-2">
              {foodItems.map((item, i) => (
                <div key={item.id || i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                  <span className="text-white text-sm">
                    {foodEmojis[i % foodEmojis.length]} {item.food_name}
                  </span>
                  {item.id && (
                    <button
                      onClick={() => removeEditFood(item.id!)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {foodItems.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-2">No food items yet.</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default MealCheckIn;
