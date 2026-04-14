import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download, Loader2, UtensilsCrossed, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Sparkles, Trash2, FileText, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadMealReportPdf } from "@/lib/generateMealReportPdf";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ReportRow {
  event_id: string;
  event_date: string;
  donor_name: string | null;
  meal_count: number;
  notes: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  item_count: number;
}

interface MealItemRow {
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  serving_description: string | null;
}

const AdminMealReports = () => {
  const [allTimeCount, setAllTimeCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [avgPerNight, setAvgPerNight] = useState(0);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<MealItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    const { data: all } = await supabase.from("meal_events").select("meal_count");
    if (all) {
      const total = all.reduce((s, r) => s + (r.meal_count || 0), 0);
      setAllTimeCount(total);
      setAvgPerNight(all.length > 0 ? Math.round(total / all.length) : 0);
    }
    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const weekStart = format(startOfWeek(today), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");

    const { data: mData } = await supabase.from("meal_events").select("meal_count").gte("event_date", monthStart).lte("event_date", todayStr);
    setMonthCount(mData ? mData.reduce((s, r) => s + (r.meal_count || 0), 0) : 0);

    const { data: wData } = await supabase.from("meal_events").select("meal_count").gte("event_date", weekStart).lte("event_date", todayStr);
    setWeekCount(wData ? wData.reduce((s, r) => s + (r.meal_count || 0), 0) : 0);
  };

  const enrichWithItems = async (rows: ReportRow[]) => {
    const eventIds = rows.map(r => r.event_id);
    if (eventIds.length === 0) return rows;
    const { data: items } = await supabase
      .from("meal_items")
      .select("meal_event_id, food_name, calories, protein_g, carbs_g, fat_g")
      .in("meal_event_id", eventIds)
      .order("sort_order");
    if (!items) return rows;
    const itemMap = new Map<string, typeof items>();
    items.forEach((item) => {
      const arr = itemMap.get(item.meal_event_id) || [];
      arr.push(item);
      itemMap.set(item.meal_event_id, arr);
    });
    return rows.map(r => ({
      ...r,
      items: (itemMap.get(r.event_id) || []).map(i => ({
        food_name: i.food_name,
        calories: i.calories,
        protein_g: i.protein_g,
        carbs_g: i.carbs_g,
        fat_g: i.fat_g,
      })),
    }));
  };

  const runReport = async (andPrint = false) => {
    setLoading(true);
    setEstimating(false);

    const { data, error } = await supabase.rpc("get_meal_report", {
      _start_date: format(startDate, "yyyy-MM-dd"),
      _end_date: format(endDate, "yyyy-MM-dd"),
    });
    if (error || !data) {
      setLoading(false);
      return;
    }

    let reportRows = data as ReportRow[];

    const eventIds = reportRows.filter(r => r.item_count > 0).map(r => r.event_id);
    const needsEstimation = reportRows.some(r => r.item_count > 0 && r.total_calories === 0);

    if (needsEstimation && eventIds.length > 0) {
      setEstimating(true);
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("estimate-meal-nutrition", {
          body: { event_ids: eventIds },
        });

        if (fnError) {
          console.error("Nutrition estimation error:", fnError);
          toast.error("Could not estimate nutritional values");
        } else if (result?.estimated > 0) {
          const { data: refreshed } = await supabase.rpc("get_meal_report", {
            _start_date: format(startDate, "yyyy-MM-dd"),
            _end_date: format(endDate, "yyyy-MM-dd"),
          });
          if (refreshed) {
            reportRows = refreshed as ReportRow[];
            setReportData(reportRows);
            setEstimating(false);
            setLoading(false);
            if (andPrint) {
              const enriched = await enrichWithItems(reportRows);
              await downloadMealReportPdf({ reportData: enriched, startDate, endDate });
            }
            return;
          }
        }
      } catch (err) {
        console.error("Estimation failed:", err);
        toast.error("Nutrition estimation failed");
      }
      setEstimating(false);
    }

    setReportData(reportRows);
    setLoading(false);
    if (andPrint) {
      const enriched = await enrichWithItems(reportRows);
      await downloadMealReportPdf({ reportData: enriched, startDate, endDate });
    }
  };

  useEffect(() => { runReport(); }, []);

  const toggleExpand = async (eventId: string) => {
    if (expandedRow === eventId) { setExpandedRow(null); return; }
    setExpandedRow(eventId);
    setLoadingItems(true);
    const { data } = await supabase.from("meal_items").select("food_name, calories, protein_g, carbs_g, fat_g, serving_description").eq("meal_event_id", eventId).order("sort_order");
    setExpandedItems((data as MealItemRow[]) || []);
    setLoadingItems(false);
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete meal_checkins, meal_items, then meal_event (cascade should handle but be explicit)
    await supabase.from("meal_checkins").delete().eq("meal_event_id", deleteTarget.event_id);
    await supabase.from("meal_items").delete().eq("meal_event_id", deleteTarget.event_id);
    const { error } = await supabase.from("meal_events").delete().eq("id", deleteTarget.event_id);
    if (error) {
      toast.error("Failed to delete meal event");
    } else {
      toast.success(`Deleted meal event for ${format(new Date(deleteTarget.event_date + "T12:00:00"), "MMM d, yyyy")}`);
      setReportData((prev) => prev.filter((r) => r.event_id !== deleteTarget.event_id));
      if (expandedRow === deleteTarget.event_id) setExpandedRow(null);
      loadSummary();
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const exportCSV = () => {
    const headers = "Date,Donor,Meals Served,Total Calories,Total Protein (g),Total Carbs (g),Total Fat (g),Items\n";
    const rows = reportData.map((r) =>
      `${r.event_date},"${r.donor_name || ""}",${r.meal_count},${r.total_calories},${r.total_protein},${r.total_carbs},${r.total_fat},${r.item_count}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-report-${format(startDate, "yyyy-MM-dd")}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const totalEvents = reportData.length;
  const avgProtein = totalEvents > 0 ? reportData.reduce((s, r) => s + r.total_protein, 0) / totalEvents : 0;
  const lowProteinCount = reportData.filter((r) => r.total_protein < 10).length;

  const donorMap = new Map<string, { meals: number; dates: string[]; totalProtein: number; count: number }>();
  reportData.forEach((r) => {
    const name = r.donor_name || "Unknown";
    const existing = donorMap.get(name) || { meals: 0, dates: [], totalProtein: 0, count: 0 };
    existing.meals += r.meal_count;
    existing.dates.push(r.event_date);
    existing.totalProtein += r.total_protein;
    existing.count += 1;
    donorMap.set(name, existing);
  });

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "All Time", value: allTimeCount, color: "text-green-400", icon: UtensilsCrossed },
          { label: "This Month", value: monthCount, color: "text-blue-400", icon: TrendingUp },
          { label: "This Week", value: weekCount, color: "text-amber-400", icon: TrendingUp },
          { label: "Avg/Night", value: avgPerNight, color: "text-purple-400", icon: TrendingUp },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
            <stat.icon className={cn("w-5 h-5 mx-auto mb-1", stat.color)} />
            <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-zinc-500 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        <DatePicker label="Start" date={startDate} onSelect={setStartDate} />
        <DatePicker label="End" date={endDate} onSelect={setEndDate} />
        <Button onClick={() => runReport(true)} disabled={loading || estimating} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
          {(loading || estimating) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          {estimating ? "Estimating Nutrition..." : "Print Report"}
        </Button>
        <Button variant="outline" onClick={exportCSV} className="border-zinc-700 text-zinc-300">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* AI estimation loading state */}
      {estimating && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <div>
            <p className="text-white font-medium">Generating nutritional estimates...</p>
            <p className="text-zinc-500 text-sm">AI is analyzing food items to estimate calories, protein, carbs, and fat.</p>
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead className="text-right">Meals</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Calories</TableHead>
                <TableHead className="text-right">Protein</TableHead>
                <TableHead className="text-right">Carbs</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((row) => (
                <>
                  <TableRow key={row.event_id} className="cursor-pointer hover:bg-zinc-800/50">
                    <TableCell onClick={() => toggleExpand(row.event_id)}>
                      {expandedRow === row.event_id ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                    </TableCell>
                    <TableCell className="text-white" onClick={() => toggleExpand(row.event_id)}>{format(new Date(row.event_date + "T12:00:00"), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-zinc-300" onClick={() => toggleExpand(row.event_id)}>{row.donor_name || "—"}</TableCell>
                    <TableCell className="text-right text-green-400 font-bold" onClick={() => toggleExpand(row.event_id)}>{row.meal_count}</TableCell>
                    <TableCell className="text-right text-zinc-400" onClick={() => toggleExpand(row.event_id)}>{row.item_count}</TableCell>
                    <TableCell className="text-right text-amber-400" onClick={() => toggleExpand(row.event_id)}>{Math.round(row.total_calories)}</TableCell>
                    <TableCell className="text-right text-blue-400" onClick={() => toggleExpand(row.event_id)}>{Math.round(row.total_protein)}g</TableCell>
                    <TableCell className="text-right text-green-400" onClick={() => toggleExpand(row.event_id)}>{Math.round(row.total_carbs)}g</TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                        className="p-1.5 rounded-md text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition"
                        title="Delete meal event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                  {expandedRow === row.event_id && (
                    <TableRow key={`${row.event_id}-detail`}>
                      <TableCell colSpan={9} className="bg-zinc-950 p-4">
                        {loadingItems ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                        ) : expandedItems.length === 0 ? (
                          <p className="text-zinc-500 text-sm">No food items recorded.</p>
                        ) : (
                          <div className="space-y-1">
                            {expandedItems.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 text-sm">
                                <span className="text-white">{item.food_name}</span>
                                {item.serving_description && <span className="text-zinc-600">({item.serving_description})</span>}
                                <span className="text-amber-400">{item.calories ?? "—"} cal</span>
                                <span className="text-blue-400">{item.protein_g ?? "—"}g pro</span>
                                <span className="text-green-400">{item.carbs_g ?? "—"}g carb</span>
                                <span className="text-orange-400">{item.fat_g ?? "—"}g fat</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
              {reportData.length === 0 && !loading && (
                <TableRow><TableCell colSpan={9} className="text-center text-zinc-500 py-8">No meal events in this range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* AI disclaimer */}
      {reportData.length > 0 && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <Sparkles className="w-3 h-3" />
          <span>Nutritional values are AI-estimated based on typical serving sizes.</span>
        </div>
      )}

      {/* Nutritional insights */}
      {totalEvents > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h3 className="text-white font-semibold">Nutritional Insights</h3>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">Avg protein per meal:</span>
            <span className={cn("font-bold", avgProtein >= 20 ? "text-green-400" : avgProtein >= 10 ? "text-yellow-400" : "text-red-400")}>
              {Math.round(avgProtein)}g
            </span>
          </div>
          {lowProteinCount > 0 && totalEvents >= 3 && (
            <div className="flex items-start gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{lowProteinCount} out of {totalEvents} meals were low in protein — encourage volunteers to include a lean protein source.</span>
            </div>
          )}
        </div>
      )}

      {/* Donor attribution */}
      {donorMap.size > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h3 className="text-white font-semibold">Donor Meal Attribution</h3>
          <div className="space-y-2">
            {Array.from(donorMap.entries()).sort((a, b) => b[1].meals - a[1].meals).map(([name, info]) => (
              <div key={name} className="flex items-center justify-between bg-zinc-950 rounded-lg p-3">
                <div>
                  <p className="text-white font-medium">{name}</p>
                  <p className="text-zinc-500 text-xs">{info.count} night{info.count > 1 ? "s" : ""} served</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">{info.meals} meals</p>
                  <p className="text-zinc-500 text-xs">Avg protein: {Math.round(info.totalProtein / info.count)}g</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meal Event</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete the meal event for{" "}
              <span className="text-white font-medium">
                {deleteTarget ? format(new Date(deleteTarget.event_date + "T12:00:00"), "MMM d, yyyy") : ""}
              </span>
              ? This will permanently remove the event, all food items, and all check-in records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function DatePicker({ date, onSelect }: { label?: string; date: Date; onSelect: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[180px] justify-start text-left font-normal border-zinc-700 bg-zinc-900 text-white">
          <CalendarIcon className="mr-2 h-4 w-4" />
          {format(date, "MMM d, yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={(d) => d && onSelect(d)} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default AdminMealReports;
