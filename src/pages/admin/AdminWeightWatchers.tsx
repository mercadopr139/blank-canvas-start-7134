import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Scale, ChevronLeft, ChevronRight, Target, ExternalLink, ArrowUpDown, Trash2, Swords, UserPlus, Search, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { startOfWeek, addWeeks, format, parseISO, isSameWeek } from "date-fns";

interface Reg {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string | null;
  program_year: string | null;
  archived_at: string | null;
}
interface WeighIn { registration_id: string; weigh_date: string; weight_lb: number; }
interface Goal { registration_id: string; target_weight: number | null; kiosk_message: string | null; }

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number(n).toFixed(1);

// Monday-based key for a sortable "column": "mon".."fri" or "name"/"latest".
type SortKey = "name" | "latest" | 0 | 1 | 2 | 3 | 4;

export default function AdminWeightWatchers() {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week
  const [sortKey, setSortKey] = useState<SortKey>("latest");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [goalFor, setGoalFor] = useState<Reg | null>(null);
  const [goalWeight, setGoalWeight] = useState("");
  const [goalMessage, setGoalMessage] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  // Editing/deleting a single day's weigh-in.
  const [editCell, setEditCell] = useState<{ reg: Reg; date: string; current: number | null } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  // Training camp (team fight date).
  const [campOpen, setCampOpen] = useState(false);
  const [campName, setCampName] = useState("");
  const [campDate, setCampDate] = useState("");
  const [savingCamp, setSavingCamp] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  // Add a boxer to the camp list (to preset a goal before they weigh in).
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");

  // Mon–Fri of the selected week.
  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return format(d, "yyyy-MM-dd");
    }),
    [weekStart]
  );
  const rangeFrom = weekDays[0];
  const rangeTo = weekDays[4];
  const isThisWeek = isSameWeek(weekStart, new Date(), { weekStartsOn: 1 });

  /* ── Data ── */
  const { data: regs = [] } = useQuery({
    queryKey: ["ww-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_boxing_program, program_year, archived_at")
        .eq("approved_for_attendance", true)
        .is("archived_at", null)
        .order("child_last_name")
        .limit(3000);
      if (error) throw error;
      return (data || []) as Reg[];
    },
  });

  const { data: weighIns = [] } = useQuery({
    queryKey: ["ww-weighins", rangeFrom, rangeTo],
    queryFn: async () => {
      const { data, error } = await (supabase.from("weigh_ins" as never) as any)
        .select("registration_id, weigh_date, weight_lb")
        .gte("weigh_date", rangeFrom)
        .lte("weigh_date", rangeTo);
      if (error) throw error;
      return (data || []) as WeighIn[];
    },
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["ww-goals"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("weight_goals" as never) as any)
        .select("registration_id, target_weight, kiosk_message");
      if (error) throw error;
      return (data || []) as Goal[];
    },
  });

  const { data: camp = null } = useQuery({
    queryKey: ["ww-camp"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("weight_camp" as never) as any)
        .select("camp_name, fight_date")
        .maybeSingle();
      if (error) throw error;
      return (data || null) as { camp_name: string | null; fight_date: string | null } | null;
    },
  });

  const daysToFight = useMemo(() => {
    if (!camp?.fight_date) return null;
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    return Math.round(
      (Date.parse(camp.fight_date + "T00:00:00") - Date.parse(todayStr + "T00:00:00")) / 86400000
    );
  }, [camp]);

  // Fast lookup of registration details by id.
  const regById = useMemo(() => {
    const m: Record<string, Reg> = {};
    regs.forEach((r) => (m[r.id] = r));
    return m;
  }, [regs]);

  const goalMap = useMemo(() => {
    const m: Record<string, Goal> = {};
    goals.forEach((g) => (m[g.registration_id] = g));
    return m;
  }, [goals]);

  // regId -> { 'yyyy-mm-dd': weight }
  const weighMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    weighIns.forEach((w) => {
      (m[w.registration_id] ||= {})[w.weigh_date] = Number(w.weight_lb);
    });
    return m;
  }, [weighIns]);

  interface Row {
    reg: Reg;
    days: (number | null)[]; // Mon..Fri
    latest: number | null;
    goal: number | null;
    vsGoal: number | null;
  }

  const rows = useMemo<Row[]>(() => {
    // Boxers who weighed in this week OR who have a goal set (the camp roster
    // the coach opted in) — so goals can be preset before a first weigh-in.
    const ids = Array.from(new Set([...Object.keys(weighMap), ...Object.keys(goalMap)]));
    return ids
      .map((id) => {
        const reg = regById[id];
        if (!reg) return null; // a weigh-in with no matching approved boxer — skip
        const byDate = weighMap[id] || {}; // goal-only boxers have no weigh-ins yet
        const days = weekDays.map((d) => (d in byDate ? byDate[d] : null));
        // Latest = most recent day this week that has a value (Fri → Mon).
        let latest: number | null = null;
        for (let i = days.length - 1; i >= 0; i--) {
          if (days[i] !== null) { latest = days[i]; break; }
        }
        const goal = goalMap[id]?.target_weight ?? null;
        const vsGoal = latest !== null && goal !== null ? Math.round((latest - goal) * 10) / 10 : null;
        return { reg, days, latest, goal, vsGoal };
      })
      .filter((r): r is Row => r !== null);
  }, [weighMap, regById, weekDays, goalMap]);

  const sortedRows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: Row): number | string | null => {
      if (sortKey === "name") return `${r.reg.child_last_name} ${r.reg.child_first_name}`.toLowerCase();
      if (sortKey === "latest") return r.latest;
      return r.days[sortKey as number];
    };
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * (sortKey === "name" ? dir : 1);
      }
      // Numbers: blanks always sink to the bottom regardless of direction.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const weighedToday = useMemo(() => {
    if (!isThisWeek) return null;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    return rows.filter((r) => {
      const idx = weekDays.indexOf(today);
      return idx >= 0 && r.days[idx] !== null;
    }).length;
  }, [rows, weekDays, isThisWeek]);

  const weighedThisWeek = useMemo(
    () => rows.filter((r) => r.days.some((d) => d !== null)).length,
    [rows]
  );

  const addResults = useMemo(() => {
    const s = addSearch.trim().toLowerCase();
    if (s.length < 2) return [];
    return regs
      .filter((r) => `${r.child_first_name} ${r.child_last_name}`.toLowerCase().includes(s))
      .slice(0, 8);
  }, [addSearch, regs]);

  /* ── Goal editing ── */
  const openGoal = (reg: Reg) => {
    const g = goalMap[reg.id];
    setGoalFor(reg);
    setGoalWeight(g?.target_weight != null ? String(g.target_weight) : "");
    setGoalMessage(g?.kiosk_message || "");
  };

  const saveGoal = async () => {
    if (!goalFor) return;
    const w = goalWeight.trim() === "" ? null : parseFloat(goalWeight);
    if (w !== null && (isNaN(w) || w <= 0 || w >= 1000)) {
      toast.error("Enter a valid goal weight, like 100.0");
      return;
    }
    setSavingGoal(true);
    const { error } = await (supabase.from("weight_goals" as never) as any).upsert({
      registration_id: goalFor.id,
      target_weight: w,
      kiosk_message: goalMessage.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setSavingGoal(false);
    if (error) { toast.error(error.message || "Couldn't save goal"); return; }
    toast.success(`Goal saved for ${goalFor.child_first_name}`);
    setGoalFor(null);
    qc.invalidateQueries({ queryKey: ["ww-goals"] });
  };

  // Take a boxer off the camp list (deletes their goal row). Their weigh-ins,
  // if any, are untouched — so they'll still appear in any week they weighed in.
  const removeGoal = async () => {
    if (!goalFor) return;
    setSavingGoal(true);
    const { error } = await (supabase.from("weight_goals" as never) as any)
      .delete()
      .eq("registration_id", goalFor.id);
    setSavingGoal(false);
    if (error) { toast.error(error.message || "Couldn't remove"); return; }
    toast.success(`Removed ${goalFor.child_first_name} from the list`);
    setGoalFor(null);
    qc.invalidateQueries({ queryKey: ["ww-goals"] });
  };

  /* ── Edit / delete a single weigh-in ── */
  const openCell = (reg: Reg, date: string, current: number | null) => {
    setEditCell({ reg, date, current });
    setEditVal(current !== null ? String(current) : "");
  };

  const saveCell = async () => {
    if (!editCell) return;
    const w = parseFloat(editVal);
    if (isNaN(w) || w <= 0 || w >= 1000) { toast.error("Enter a valid weight, like 105.6"); return; }
    setSavingCell(true);
    const { error } = await (supabase.from("weigh_ins" as never) as any).upsert(
      { registration_id: editCell.reg.id, weigh_date: editCell.date, weight_lb: w, updated_at: new Date().toISOString() },
      { onConflict: "registration_id,weigh_date" }
    );
    setSavingCell(false);
    if (error) { toast.error(error.message || "Couldn't save weight"); return; }
    toast.success(`Saved ${editCell.reg.child_first_name}'s weight`);
    setEditCell(null);
    qc.invalidateQueries({ queryKey: ["ww-weighins"] });
  };

  const deleteCell = async () => {
    if (!editCell) return;
    setSavingCell(true);
    const { error } = await (supabase.from("weigh_ins" as never) as any)
      .delete()
      .eq("registration_id", editCell.reg.id)
      .eq("weigh_date", editCell.date);
    setSavingCell(false);
    if (error) { toast.error(error.message || "Couldn't delete weight"); return; }
    toast.success(`Removed ${editCell.reg.child_first_name}'s weigh-in`);
    setEditCell(null);
    qc.invalidateQueries({ queryKey: ["ww-weighins"] });
  };

  /* ── Training camp ── */
  const openCamp = () => {
    setCampName(camp?.camp_name || "");
    setCampDate(camp?.fight_date || "");
    setCampOpen(true);
  };

  const saveCamp = async () => {
    setSavingCamp(true);
    const { error } = await (supabase.from("weight_camp" as never) as any).upsert({
      id: true,
      camp_name: campName.trim() || null,
      fight_date: campDate || null,
      updated_at: new Date().toISOString(),
    });
    setSavingCamp(false);
    if (error) { toast.error(error.message || "Couldn't save camp"); return; }
    toast.success("Camp saved");
    setCampOpen(false);
    qc.invalidateQueries({ queryKey: ["ww-camp"] });
  };

  // Start a fresh camp: clear the camp + everyone's goals (roster). Weigh-in
  // history is intentionally kept — it's dated and still viewable by week.
  const resetCamp = async () => {
    setResetting(true);
    const { error: e1 } = await (supabase.from("weight_camp" as never) as any).upsert({
      id: true, camp_name: null, fight_date: null, updated_at: new Date().toISOString(),
    });
    const { error: e2 } = await (supabase.from("weight_goals" as never) as any)
      .delete().not("registration_id", "is", null);
    setResetting(false);
    if (e1 || e2) { toast.error((e1 || e2)?.message || "Couldn't reset camp"); return; }
    toast.success("Camp reset — ready for a new one");
    setResetOpen(false);
    qc.invalidateQueries({ queryKey: ["ww-camp"] });
    qc.invalidateQueries({ queryKey: ["ww-goals"] });
  };

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const SortIcon = ({ active }: { active: boolean }) => (
    <ArrowUpDown className={`inline w-3 h-3 ml-1 ${active ? "text-white" : "text-white/25"}`} />
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-green-400" /> Weight Watchers
          </h1>
          <p className="text-white/50 text-sm mt-0.5">
            Weekly weigh-ins (Mon–Fri). Sort by weight, and set each boxer's goal.
          </p>
          <p className="text-white/35 text-xs mt-0.5">
            Tip: click any weight in the table to edit or delete it.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/weigh-in", "_blank")}
          className="border-white/15 text-white/80 bg-transparent hover:bg-white/10 gap-1.5"
        >
          <ExternalLink className="w-4 h-4" /> Open Weigh-In Kiosk
        </Button>
      </div>

      {/* Camp banner */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Swords className="w-5 h-5 text-red-400 shrink-0" />
          {camp?.fight_date ? (
            <div className="min-w-0">
              <div className="text-white font-semibold truncate">{camp.camp_name?.trim() || "Fight Camp"}</div>
              <div className="text-white/50 text-xs">
                Fight: {format(parseISO(camp.fight_date), "EEE, MMM d, yyyy")}
                {daysToFight !== null && daysToFight > 0 && (
                  <span className="text-red-300 font-medium"> · {daysToFight} days out</span>
                )}
                {daysToFight === 0 && <span className="text-red-300 font-bold"> · FIGHT DAY 🥊</span>}
                {daysToFight !== null && daysToFight < 0 && <span className="text-white/30"> · past</span>}
              </div>
            </div>
          ) : (
            <div className="text-white/50 text-sm">No camp set — add a fight date to start the countdown.</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={openCamp}
            className="border-white/15 text-white/80 bg-transparent hover:bg-white/10"
          >
            {camp?.fight_date ? "Edit camp" : "Set camp"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetOpen(true)}
            className="border-red-500/30 text-red-300 bg-transparent hover:bg-red-500/10 gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Reset Fight Camp
          </Button>
        </div>
      </div>

      {/* Week nav + stats */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}
            className="border-white/15 text-white/80 bg-transparent hover:bg-white/10"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="text-white text-sm font-medium min-w-[190px] text-center">
            {format(parseISO(rangeFrom), "MMM d")} – {format(parseISO(rangeTo), "MMM d, yyyy")}
            {isThisWeek && <span className="ml-2 text-green-400 text-xs">This week</span>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}
            className="border-white/15 text-white/80 bg-transparent hover:bg-white/10"><ChevronRight className="w-4 h-4" /></Button>
          {!isThisWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)} className="text-white/50 hover:text-white text-xs">Today</Button>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Button
            size="sm"
            onClick={() => { setAddSearch(""); setAddOpen(true); }}
            className="bg-green-600 hover:bg-green-500 text-white gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Add boxer
          </Button>
          <div className="text-white/60">In table: <span className="text-white font-bold">{rows.length}</span></div>
          <div className="text-white/60">Weighed in this week: <span className="text-white font-bold">{weighedThisWeek}</span></div>
          {weighedToday !== null && (
            <div className="text-white/60">Weighed in today: <span className="text-green-400 font-bold">{weighedToday}</span></div>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="bg-white/[0.03] border-white/10 text-white">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 z-10">
                <tr className="border-b border-white/10 text-white/60">
                  <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    Boxer <SortIcon active={sortKey === "name"} />
                  </th>
                  <th className="text-center px-3 py-3">🎯 Goal</th>
                  {dayLabels.map((lbl, i) => (
                    <th key={lbl} className="text-center px-3 py-3 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort(i as SortKey)}>
                      {lbl} <span className="text-white/30 text-xs">{format(parseISO(weekDays[i]), "M/d")}</span>
                      <SortIcon active={sortKey === i} />
                    </th>
                  ))}
                  <th className="text-center px-3 py-3 cursor-pointer select-none" onClick={() => toggleSort("latest")}>
                    Latest <SortIcon active={sortKey === "latest"} />
                  </th>
                  <th className="text-center px-3 py-3 whitespace-nowrap">vs Goal</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-white/30 py-10">No weigh-ins this week yet.</td></tr>
                ) : (
                  sortedRows.map((r) => (
                    <tr key={r.reg.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-white">{r.reg.child_first_name} {r.reg.child_last_name}</div>
                        <div className="text-white/30 text-xs">{r.reg.child_boxing_program}</div>
                      </td>
                      <td className="text-center px-3 py-2.5">
                        <button
                          onClick={() => openGoal(r.reg)}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition ${
                            r.goal !== null
                              ? "bg-green-500/10 text-green-300 hover:bg-green-500/20"
                              : "text-white/40 hover:text-white hover:bg-white/10 border border-white/10"
                          }`}
                          title="Set goal weight & kiosk message"
                        >
                          <Target className="w-3 h-3" />
                          {r.goal !== null ? `${fmt(r.goal)}` : "Set"}
                        </button>
                      </td>
                      {r.days.map((d, i) => (
                        <td key={i} className="text-center px-1 py-1.5">
                          <button
                            onClick={() => openCell(r.reg, weekDays[i], d)}
                            className={`w-full rounded-md px-2 py-1 tabular-nums cursor-pointer transition hover:ring-1 hover:ring-white/20 ${
                              d !== null
                                ? "text-white/90 hover:bg-white/10"
                                : "text-white/15 hover:bg-white/5 hover:text-white/40"
                            }`}
                            title={d !== null ? "Edit or delete this weigh-in" : "Add a weigh-in for this day"}
                          >
                            {d !== null ? fmt(d) : "—"}
                          </button>
                        </td>
                      ))}
                      <td className="text-center px-3 py-2.5 tabular-nums font-bold text-white">
                        {r.latest !== null ? fmt(r.latest) : <span className="text-white/15 font-normal">—</span>}
                      </td>
                      <td className="text-center px-3 py-2.5 tabular-nums">
                        {r.vsGoal === null ? (
                          <span className="text-white/15">—</span>
                        ) : r.vsGoal > 0 ? (
                          <span className="text-yellow-300">+{fmt(r.vsGoal)}</span>
                        ) : (
                          <span className="text-green-300">✓ {fmt(r.vsGoal)}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Goal editor */}
      <Dialog open={!!goalFor} onOpenChange={(o) => { if (!o) setGoalFor(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-green-400" />
              {goalFor ? `${goalFor.child_first_name} ${goalFor.child_last_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Goal weight (lb)</Label>
              <Input
                value={goalWeight}
                onChange={(e) => setGoalWeight(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="100.0"
                className="mt-1 bg-white/5 border-white/20 text-white tabular-nums"
              />
              <p className="text-white/40 text-xs mt-1">Leave blank for no goal.</p>
            </div>
            <div>
              <Label className="text-white/70">Custom kiosk message (optional)</Label>
              <Textarea
                value={goalMessage}
                onChange={(e) => setGoalMessage(e.target.value)}
                placeholder='e.g. "Champions are made in the gym!"'
                maxLength={200}
                className="mt-1 bg-white/5 border-white/20 text-white"
              />
              <p className="text-white/40 text-xs mt-1">
                Shown when they weigh in. If left blank (and no goal set), they'll see
                "Eat Protein! Watch your Carbs! 💪"
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            {goalFor && goalMap[goalFor.id] ? (
              <Button variant="ghost" size="sm" className="text-red-300 hover:text-red-200 hover:bg-red-500/10 gap-1.5" onClick={removeGoal} disabled={savingGoal}>
                <Trash2 className="w-4 h-4" /> Remove from list
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent" onClick={() => setGoalFor(null)}>Cancel</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={saveGoal} disabled={savingGoal}>
                {savingGoal ? "Saving…" : "Save Goal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / delete a single weigh-in */}
      <Dialog open={!!editCell} onOpenChange={(o) => { if (!o) setEditCell(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editCell ? `${editCell.reg.child_first_name} ${editCell.reg.child_last_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editCell && (
            <p className="text-white/50 text-sm -mt-1">
              {format(parseISO(editCell.date), "EEEE, MMMM d, yyyy")}
            </p>
          )}
          <div>
            <Label className="text-white/70">Weight (lb)</Label>
            <Input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") saveCell(); }}
              inputMode="decimal"
              placeholder="105.6"
              className="mt-1 bg-white/5 border-white/20 text-white tabular-nums text-lg"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            {editCell?.current !== null ? (
              <Button variant="destructive" size="sm" onClick={deleteCell} disabled={savingCell} className="gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent" onClick={() => setEditCell(null)}>Cancel</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white" onClick={saveCell} disabled={savingCell}>
                {savingCell ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Training camp editor */}
      <Dialog open={campOpen} onOpenChange={(o) => { if (!o) setCampOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-400" /> Training Camp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Camp name</Label>
              <Input
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                placeholder="e.g. USA vs IRL"
                className="mt-1 bg-white/5 border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white/70">Fight date</Label>
              <Input
                type="date"
                value={campDate}
                onChange={(e) => setCampDate(e.target.value)}
                className="mt-1 bg-white/5 border-white/20 text-white"
              />
              <p className="text-white/40 text-xs mt-1">
                The kiosk and table count down to this date. Clear it to turn the countdown off.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent" onClick={() => setCampOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white" onClick={saveCamp} disabled={savingCamp}>
              {savingCamp ? "Saving…" : "Save Camp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add a boxer to the camp list (preset their goal before weigh-in) */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-400" /> Add a boxer
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              autoFocus
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search a boxer's name"
              className="pl-9 bg-white/5 border-white/20 text-white"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {addSearch.trim().length < 2 ? (
              <p className="text-white/40 text-sm text-center py-6">Type a name to find a boxer.</p>
            ) : addResults.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-6">No match found.</p>
            ) : (
              addResults.map((r) => {
                const already = !!goalMap[r.id];
                return (
                  <button
                    key={r.id}
                    onClick={() => { setAddOpen(false); openGoal(r); }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="truncate">
                      <span className="text-white">{r.child_first_name} {r.child_last_name}</span>
                      <span className="text-white/40 text-xs ml-2">{r.child_boxing_program}</span>
                    </span>
                    {already
                      ? <span className="text-green-300 text-xs shrink-0">In list</span>
                      : <Target className="w-4 h-4 text-white/40 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          <p className="text-white/40 text-xs">Pick a boxer to set their goal weight — they'll appear in the table right away.</p>
        </DialogContent>
      </Dialog>

      {/* Reset fight camp */}
      <Dialog open={resetOpen} onOpenChange={(o) => { if (!o) setResetOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-red-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-300 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" /> Start a new camp?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/80">
            This clears the current fight camp <span className="font-semibold">and everyone's goal weights</span>,
            giving you a clean roster to build the next camp.
          </p>
          <div className="rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-xs text-white/60">
            ✓ All past weigh-ins are kept — nothing is deleted from history.
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button variant="outline" size="sm" className="border-white/20 text-white bg-transparent" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={resetCamp} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset camp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
