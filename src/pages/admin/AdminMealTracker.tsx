import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, Loader2, Trash2, GripVertical, UtensilsCrossed, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MealItem {
  id: string;
  food_name: string;
  usda_fdc_id: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sodium_mg: number | null;
  sugar_g: number | null;
  serving_description: string | null;
  sort_order: number;
  meal_event_id?: string;
}

interface MealEvent {
  id: string;
  event_date: string;
  donor_name: string | null;
  notes: string | null;
  meal_count: number;
}

interface USDAFood {
  fdcId: number;
  description: string;
  foodNutrients: { nutrientId: number; value: number }[];
  servingSize?: number;
  servingSizeUnit?: string;
}

const NUTRIENT_IDS = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079, sodium: 1093, sugar: 2000 };

function getNutrient(food: USDAFood, id: number): number | null {
  const n = food.foodNutrients.find((fn) => fn.nutrientId === id);
  return n ? Math.round(n.value * 10) / 10 : null;
}

function SortableItem({ item, onRemove }: { item: MealItem; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3 animate-in slide-in-from-bottom-2 duration-300"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-zinc-500 hover:text-zinc-300">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{item.food_name}</p>
        {item.serving_description && <p className="text-zinc-500 text-xs">{item.serving_description}</p>}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {item.calories != null && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">{item.calories} cal</span>}
        {item.protein_g != null && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">{item.protein_g}g pro</span>}
        {item.carbs_g != null && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300">{item.carbs_g}g carb</span>}
        {item.fat_g != null && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/50 text-orange-300">{item.fat_g}g fat</span>}
      </div>
      <button onClick={() => onRemove(item.id)} className="text-red-500 hover:text-red-400 ml-1">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

const AdminMealTracker = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [event, setEvent] = useState<MealEvent | null>(null);
  const [donorName, setDonorName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<MealItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<USDAFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const undoRef = useRef<{ id: string; item: MealItem; timeout: ReturnType<typeof setTimeout> } | null>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadEvent = useCallback(async () => {
    const { data } = await supabase.from("meal_events").select("*").eq("event_date", dateStr).maybeSingle();
    if (data) {
      setEvent(data);
      setDonorName(data.donor_name || "");
      setNotes(data.notes || "");
      const { data: itemsData } = await supabase
        .from("meal_items")
        .select("*")
        .eq("meal_event_id", data.id)
        .order("sort_order");
      setItems((itemsData as MealItem[]) || []);
    } else {
      setEvent(null);
      setDonorName("");
      setNotes("");
      setItems([]);
    }
    setHasUnsavedChanges(false);
  }, [dateStr]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) { e.preventDefault(); }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // USDA search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchTerm.trim().length < 2) { setSearchResults([]); setShowDropdown(false); setSearchError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setShowDropdown(true);
      setSearchError(null);
      try {
        const apiKey = import.meta.env.VITE_USDA_API_KEY || "DEMO_KEY";
        const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&pageSize=8`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("USDA API response:", data);
        if (!res.ok) {
          setSearchError("Could not load food data. Check your API key.");
          setSearchResults([]);
        } else {
          setSearchResults(data.foods || []);
          if (!data.foods || data.foods.length === 0) {
            setSearchError(null);
          }
        }
      } catch (err) {
        console.error("USDA fetch error:", err);
        setSearchError("Could not load food data. Check your API key.");
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
  }, [searchTerm]);

  const createEvent = async () => {
    setSaving(true);
    const { data, error } = await supabase.from("meal_events").insert({ event_date: dateStr, donor_name: donorName || null, notes: notes || null }).select().single();
    if (error) { toast.error("Failed to create event"); setSaving(false); return; }
    setEvent(data);
    toast.success("Tonight's meal saved ✓");
    setSaving(false);
    setHasUnsavedChanges(false);
  };

  const saveEvent = async () => {
    if (!event) return;
    setSaving(true);
    await supabase.from("meal_events").update({ donor_name: donorName || null, notes: notes || null }).eq("id", event.id);
    // Save item sort orders
    for (let i = 0; i < items.length; i++) {
      await supabase.from("meal_items").update({ sort_order: i }).eq("id", items[i].id);
    }
    toast.success("Tonight's meal saved ✓");
    setSaving(false);
    setHasUnsavedChanges(false);
  };

  const addFoodItem = async (food: USDAFood) => {
    if (!event) return;
    const newItem: Omit<MealItem, "id"> = {
      meal_event_id: event.id,
      food_name: food.description,
      usda_fdc_id: String(food.fdcId),
      calories: getNutrient(food, NUTRIENT_IDS.calories),
      protein_g: getNutrient(food, NUTRIENT_IDS.protein),
      carbs_g: getNutrient(food, NUTRIENT_IDS.carbs),
      fat_g: getNutrient(food, NUTRIENT_IDS.fat),
      fiber_g: getNutrient(food, NUTRIENT_IDS.fiber),
      sodium_mg: getNutrient(food, NUTRIENT_IDS.sodium),
      sugar_g: getNutrient(food, NUTRIENT_IDS.sugar),
      serving_description: food.servingSize ? `${food.servingSize} ${food.servingSizeUnit || "g"}` : "1 serving",
      sort_order: items.length,
    };
    const { data, error } = await supabase.from("meal_items").insert([newItem as any]).select().single();
    if (error) { toast.error("Failed to add item"); return; }
    setItems((prev) => [...prev, data as MealItem]);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    // Undo window
    if (undoRef.current) { clearTimeout(undoRef.current.timeout); supabase.from("meal_items").delete().eq("id", undoRef.current.id).then(() => {}); }
    const timeout = setTimeout(async () => {
      await supabase.from("meal_items").delete().eq("id", id);
      undoRef.current = null;
    }, 4000);
    undoRef.current = { id, item, timeout };
    toast("Item removed", {
      action: {
        label: "Undo",
        onClick: () => {
          if (undoRef.current && undoRef.current.id === id) {
            clearTimeout(undoRef.current.timeout);
            setItems((prev) => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
            undoRef.current = null;
          }
        },
      },
      duration: 4000,
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
    setHasUnsavedChanges(true);
  };

  const totals = items.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein_g || 0),
      carbs: acc.carbs + (i.carbs_g || 0),
      fat: acc.fat + (i.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="today">
        <TabsList className="bg-zinc-900 border border-zinc-800">
          <TabsTrigger value="today">Today's Setup</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-4">
          {/* Date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal border-zinc-700 bg-zinc-900 text-white")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>

          {!event ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-zinc-700 rounded-lg">
              <UtensilsCrossed className="w-12 h-12 text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-4">No meal set up for {format(selectedDate, "MMMM d, yyyy")}</p>
              <div className="space-y-3 w-full max-w-md px-4">
                <Input placeholder="Donor / Volunteer Name (optional)" value={donorName} onChange={(e) => setDonorName(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white" />
                <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white" rows={2} />
                <Button onClick={createEvent} disabled={saving} className="w-full bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UtensilsCrossed className="w-4 h-4 mr-2" />}
                  Set Up Tonight's Meal
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Event info card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
                <Input placeholder="Donor / Volunteer Name" value={donorName} onChange={(e) => { setDonorName(e.target.value); setHasUnsavedChanges(true); }} className="bg-zinc-950 border-zinc-700 text-white" />
                <Textarea placeholder="Notes" value={notes} onChange={(e) => { setNotes(e.target.value); setHasUnsavedChanges(true); }} className="bg-zinc-950 border-zinc-700 text-white" rows={2} />
                <Button onClick={saveEvent} disabled={saving} size="sm" className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Event
                </Button>
              </div>

              {/* Food search */}
              <div className="space-y-2">
                <h3 className="text-white font-semibold text-lg">Food Items</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    placeholder="Search food item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    className="pl-10 bg-zinc-900 border-zinc-700 text-white"
                  />
                  {searchError && (
                    <p className="text-red-500 text-sm mt-1 font-medium">{searchError}</p>
                  )}
                  {showDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-72 overflow-y-auto">
                      {searching && <div className="flex items-center gap-2 p-3 text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</div>}
                      {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                        <p className="p-3 text-zinc-500 text-sm">No matches found — try a simpler term</p>
                      )}
                      {searchResults.map((food) => (
                        <button
                          key={food.fdcId}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addFoodItem(food)}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-800 text-white text-sm border-b border-zinc-800 last:border-0"
                        >
                          <span className="font-medium">{food.description}</span>
                          {food.servingSize && <span className="text-zinc-500 ml-2 text-xs">({food.servingSize} {food.servingSizeUnit || "g"})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items list */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <SortableItem key={item.id} item={item} onRemove={removeItem} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {items.length === 0 && (
                <p className="text-zinc-500 text-center py-4">No food items added yet. Search above to add items.</p>
              )}

              {/* Totals bar */}
              {items.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <h4 className="text-zinc-400 text-sm mb-3 font-medium">Tonight's Totals</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-400">{Math.round(totals.calories)}</p>
                      <p className="text-xs text-zinc-500">Calories</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">{Math.round(totals.protein)}g</p>
                      <p className="text-xs text-zinc-500">Protein</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-400">{Math.round(totals.carbs)}g</p>
                      <p className="text-xs text-zinc-500">Carbs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-400">{Math.round(totals.fat)}g</p>
                      <p className="text-xs text-zinc-500">Fat</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <MealHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function MealHistory() {
  const [events, setEvents] = useState<MealEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("meal_events").select("*").order("event_date", { ascending: false }).limit(50);
      setEvents((data as MealEvent[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;

  return (
    <div className="space-y-2">
      {events.length === 0 && <p className="text-zinc-500 text-center py-8">No meal events yet.</p>}
      {events.map((ev) => (
        <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{format(new Date(ev.event_date + "T12:00:00"), "EEEE, MMM d, yyyy")}</p>
            {ev.donor_name && <p className="text-zinc-400 text-sm">{ev.donor_name}</p>}
          </div>
          <span className="text-lg font-bold text-green-400">{ev.meal_count} meals</span>
        </div>
      ))}
    </div>
  );
}

export default AdminMealTracker;
