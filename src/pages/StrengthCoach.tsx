import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Dumbbell, Lock, Unlock, RefreshCw, Sparkles, Wand2, CalendarDays, History, Search, Plus, Trash2, X, Pencil, ClipboardList, TrendingUp } from "lucide-react";

// Strength & Conditioning Coach — Phase 1. One screen the onsite coach opens on the
// gym board: generate the week (Mon Bench · Wed Squat · Thu Deadlift), review each
// day big and glanceable, revise any day in plain English, then lock the week.
// The AI never prescribes weights — athletes (13–18) self-select their loads.

const NLA_RED = "#bf0f3e";

type DayKey = "monday" | "wednesday" | "thursday";

interface Accessory {
  name: string; sets: string; equipment: string; targets: string;
  howTo?: string; scale?: string; rest?: string;
}
interface DayWorkout {
  focus: string;
  estMinutes?: number;
  warmup?: { name: string; detail: string }[];
  main?: { lift: string; scheme: string; guidance?: string; cues?: string[]; rest?: string };
  accessories?: Accessory[];
  finisher?: { name: string; detail: string } | null;
  coachNotes?: string;
}
interface WeekRow {
  id: string;
  week_start: string;
  status: "draft" | "locked";
  days: Partial<Record<DayKey, DayWorkout>>;
  locked_at: string | null;
}

const DAYS: { key: DayKey; label: string; lift: string; weekday: number }[] = [
  { key: "monday", label: "Monday", lift: "Bench Press", weekday: 1 },
  { key: "wednesday", label: "Wednesday", lift: "Back Squat", weekday: 3 },
  { key: "thursday", label: "Thursday", lift: "Deadlift", weekday: 4 },
];

const toMonday = (d: Date): Date => {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
};
const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const prettyRange = (mondayISO: string): string => {
  const m = new Date(mondayISO + "T00:00:00");
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${m.toLocaleDateString(undefined, opt)} – ${addDays(m, 4).toLocaleDateString(undefined, opt)}`;
};

const StrengthCoach = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const todayMonday = useMemo(() => toMonday(new Date()), []);
  const [weekMonday, setWeekMonday] = useState<Date>(todayMonday);
  const [view, setView] = useState<"week" | "history">("week");
  const weekStart = isoDate(weekMonday);
  const isCurrentWeek = weekStart === isoDate(todayMonday);

  // Board defaults to today's lift when we're on the current week, else Monday.
  const defaultDay = useMemo<DayKey>(() => {
    if (isCurrentWeek) {
      const hit = DAYS.find((d) => d.weekday === new Date().getDay());
      if (hit) return hit.key;
    }
    return "monday";
  }, [isCurrentWeek]);
  const [selectedDay, setSelectedDay] = useState<DayKey>(defaultDay);
  useEffect(() => { setSelectedDay(defaultDay); }, [defaultDay, weekStart]);

  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseText, setReviseText] = useState("");

  const { data: week, refetch, isLoading } = useQuery({
    queryKey: ["strength-week", weekStart],
    queryFn: async (): Promise<WeekRow | null> => {
      const { data, error } = await (supabase.from("strength_weeks" as never) as any)
        .select("*").eq("week_start", weekStart).maybeSingle();
      if (error) throw error;
      return (data as WeekRow) ?? null;
    },
  });

  const days = week?.days ?? {};
  const hasWeek = !!week && Object.keys(days).length > 0;
  const locked = week?.status === "locked";
  const current = days[selectedDay];
  const selectedMeta = DAYS.find((d) => d.key === selectedDay)!;
  const workoutDate = isoDate(addDays(weekMonday, selectedMeta.weekday - 1));

  const shiftWeek = (n: number) => { setReviseText(""); setWeekMonday((w) => addDays(w, n * 7)); };

  const generateWeek = async () => {
    setGenerating(true);
    try {
      // Give the AI the last few weeks so accessories vary and intensity nudges up.
      const { data: hist } = await (supabase.from("strength_weeks" as never) as any)
        .select("week_start, days").lt("week_start", weekStart)
        .order("week_start", { ascending: false }).limit(3);

      // Build the three days in parallel — far faster and each day gets its own
      // token budget, so nothing truncates.
      const results = await Promise.all(
        DAYS.map((d) =>
          supabase.functions.invoke("strength-coach", {
            body: { mode: "generate", dayKey: d.key, weekStart, history: hist ?? [] },
          })
        )
      );
      const newDays: Partial<Record<DayKey, DayWorkout>> = {};
      results.forEach((r, i) => {
        if (r.error) throw r.error;
        if (r.data?.error) throw new Error(r.data.error);
        if (!r.data?.day?.focus) throw new Error("The coach came back empty — try again.");
        newDays[DAYS[i].key] = r.data.day;
      });

      const { error: upErr } = await (supabase.from("strength_weeks" as never) as any)
        .upsert({ week_start: weekStart, status: "draft", days: newDays, locked_at: null }, { onConflict: "week_start" });
      if (upErr) throw upErr;

      await refetch();
      queryClient.invalidateQueries({ queryKey: ["strength-history"] });
      toast.success("Week generated — review and revise, then lock it in.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate the week.");
    } finally {
      setGenerating(false);
    }
  };

  const reviseDay = async () => {
    if (!week || !current || !reviseText.trim()) return;
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("strength-coach", {
        body: { mode: "revise", dayKey: selectedDay, day: current, instruction: reviseText.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newDay = data?.day;
      if (!newDay?.focus) throw new Error("The coach came back empty — try again.");

      const nextDays = { ...days, [selectedDay]: newDay };
      const { error: upErr } = await (supabase.from("strength_weeks" as never) as any)
        .update({ days: nextDays }).eq("id", week.id);
      if (upErr) throw upErr;

      setReviseText("");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["strength-history"] });
      toast.success(`${DAYS.find((d) => d.key === selectedDay)?.label} updated.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't revise that day.");
    } finally {
      setRevising(false);
    }
  };

  const setLocked = async (lock: boolean) => {
    if (!week) return;
    const { error } = await (supabase.from("strength_weeks" as never) as any)
      .update({ status: lock ? "locked" : "draft", locked_at: lock ? new Date().toISOString() : null })
      .eq("id", week.id);
    if (error) { toast.error("Couldn't update the lock."); return; }
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["strength-history"] });
    toast.success(lock ? "Week locked — it's live on the board." : "Week unlocked for edits.");
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: NLA_RED }}>
            <Dumbbell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Strength &amp; Conditioning</h1>
            <p className="text-white/50 text-sm">Bench · Squat · Deadlift — built for the crew, locked to the board.</p>
          </div>
        </div>

        {/* View toggle + jump to Intelligence */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="inline-flex rounded-xl border border-white/10 bg-neutral-900/60 p-1">
            <button onClick={() => setView("week")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === "week" ? "text-white" : "text-white/50 hover:text-white/80"}`}
              style={view === "week" ? { background: NLA_RED } : undefined}>
              <CalendarDays className="h-4 w-4" /> Week
            </button>
            <button onClick={() => setView("history")}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === "history" ? "text-white" : "text-white/50 hover:text-white/80"}`}
              style={view === "history" ? { background: NLA_RED } : undefined}>
              <History className="h-4 w-4" /> History
            </button>
          </div>
          <button onClick={() => navigate("/strength-coach/intelligence")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/15">
            <TrendingUp className="h-4 w-4" /> <span className="hidden sm:inline">S&amp;C Intelligence</span>
          </button>
        </div>

        {view === "history" ? (
          <HistoryList
            currentWeekStart={isoDate(todayMonday)}
            onOpen={(ws) => { setWeekMonday(new Date(ws + "T00:00:00")); setReviseText(""); setView("week"); }}
          />
        ) : (
        <>
        {/* Week nav + status */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftWeek(-1)} className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center min-w-[9rem]">
              <div className="font-semibold">{prettyRange(weekStart)}</div>
              <div className="text-[11px] text-white/40">{isCurrentWeek ? "This week" : "Week of " + weekStart}</div>
            </div>
            <button onClick={() => shiftWeek(1)} className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          {hasWeek && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${locked ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" : "bg-amber-500/15 border-amber-400/30 text-amber-300"}`}>
              {locked ? "🔒 Locked" : "✏️ Draft"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-white/40 py-20 text-center">Loading…</div>
        ) : !hasWeek ? (
          /* Empty state — generate the week */
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-10 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-4 text-white/30" />
            <h2 className="text-xl font-bold mb-1">No workout for this week yet</h2>
            <p className="text-white/50 mb-6 max-w-md mx-auto">
              Generate all three days at once — Monday bench, Wednesday squat, Thursday deadlift — with warm-ups, extra work and built-in scaling.
            </p>
            <button onClick={generateWeek} disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: NLA_RED }}>
              {generating ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
              {generating ? "Building the week…" : "Generate this week"}
            </button>
          </div>
        ) : (
          <>
            {/* Day tabs */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {DAYS.map((d) => {
                const active = d.key === selectedDay;
                const isToday = isCurrentWeek && d.weekday === new Date().getDay();
                return (
                  <button key={d.key} onClick={() => { setSelectedDay(d.key); setReviseText(""); }}
                    className={`rounded-xl px-3 py-2.5 text-left border transition-colors ${active ? "border-white/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
                    style={active ? { background: NLA_RED } : undefined}>
                    <div className="text-[11px] uppercase tracking-wide opacity-70 flex items-center gap-1">
                      {d.label}{isToday && <span className="text-[9px] font-bold px-1 rounded bg-white/25">TODAY</span>}
                    </div>
                    <div className="font-bold leading-tight">{d.lift}</div>
                  </button>
                );
              })}
            </div>

            {/* Big board — selected day */}
            {current ? <BoardDay day={current} /> : (
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center text-white/40">
                Nothing for this day.
              </div>
            )}

            {/* Controls */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {locked ? (
                <button onClick={() => setLocked(false)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/15">
                  <Unlock className="h-4 w-4" /> Unlock to edit
                </button>
              ) : (
                <button onClick={() => setLocked(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white" style={{ background: NLA_RED }}>
                  <Lock className="h-4 w-4" /> Lock the week
                </button>
              )}
              <button onClick={generateWeek} disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/15 disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} /> {generating ? "Regenerating…" : "Regenerate week"}
              </button>
            </div>

            {/* Revise this day — only while unlocked */}
            {!locked && (
              <div className="mt-4 rounded-xl border border-white/10 bg-neutral-900/50 p-4">
                <label className="text-sm font-semibold text-white/80 flex items-center gap-2 mb-2">
                  <Wand2 className="h-4 w-4" /> Revise {DAYS.find((d) => d.key === selectedDay)?.label}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={reviseText} onChange={(e) => setReviseText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") reviseDay(); }}
                    placeholder="e.g. keep it under 15 min · swap in kettlebells · go easier on shoulders"
                    className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30" />
                  <button onClick={reviseDay} disabled={revising || !reviseText.trim()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: NLA_RED }}>
                    {revising ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Revise
                  </button>
                </div>
              </div>
            )}

            {/* Working-set logging — scroll down; main lift only, per athlete */}
            {current && (
              <WorkingSetLog
                weekStart={weekStart}
                dayKey={selectedDay}
                workoutDate={workoutDate}
                lift={current.main?.lift || current.focus}
              />
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
};

// The glanceable board view of a single day.
const BoardDay = ({ day }: { day: DayWorkout }) => (
  <div className="rounded-2xl border border-white/10 bg-neutral-900/60 overflow-hidden">
    <div className="px-5 sm:px-7 py-5 border-b border-white/10 flex items-end justify-between gap-3" style={{ background: "linear-gradient(90deg, rgba(191,15,62,0.25), transparent)" }}>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-white/40">Main lift</div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{day.focus}</h2>
      </div>
      {day.estMinutes ? <div className="text-right text-white/50 text-sm">~{day.estMinutes} min</div> : null}
    </div>

    <div className="p-5 sm:p-7 space-y-6">
      {/* Warm-up */}
      {day.warmup?.length ? (
        <Section label="Warm-up ramp">
          <ul className="space-y-1.5">
            {day.warmup.map((w, i) => (
              <li key={i} className="flex gap-2 text-white/80"><span className="text-white/30">→</span>
                <span><span className="font-semibold text-white">{w.name}</span> — {w.detail}</span></li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Main lift */}
      {day.main ? (
        <Section label="Working sets">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="text-2xl sm:text-3xl font-extrabold">{day.main.lift}</div>
              <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: NLA_RED }}>{day.main.scheme}</div>
            </div>
            {day.main.guidance ? <p className="text-white/70 mt-2 text-sm">{day.main.guidance}</p> : null}
            {day.main.cues?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {day.main.cues.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-md bg-white/10 text-white/80">{c}</span>
                ))}
              </div>
            ) : null}
            {day.main.rest ? <div className="text-[11px] text-white/40 mt-2">Rest {day.main.rest}</div> : null}
          </div>
        </Section>
      ) : null}

      {/* Extra Work */}
      {day.accessories?.length ? (
        <Section label="Extra Work">
          <div className="grid gap-3 sm:grid-cols-2">
            {day.accessories.map((a, i) => (
              <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-bold text-lg">{a.name}</div>
                  <div className="font-bold" style={{ color: NLA_RED }}>{a.sets}</div>
                </div>
                <div className="text-[11px] text-white/40 mt-0.5">{a.equipment}{a.targets ? ` · ${a.targets}` : ""}</div>
                {a.howTo ? <p className="text-sm text-white/70 mt-2">{a.howTo}</p> : null}
                {a.scale ? <p className="text-xs text-amber-200/80 mt-2">⚖ {a.scale}</p> : null}
                {a.rest ? <div className="text-[11px] text-white/40 mt-1">Rest {a.rest}</div> : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Finisher */}
      {day.finisher ? (
        <Section label="Finisher">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <span className="font-semibold">{day.finisher.name}</span> — <span className="text-white/70">{day.finisher.detail}</span>
          </div>
        </Section>
      ) : null}

      {day.coachNotes ? (
        <div className="text-sm text-white/50 border-t border-white/10 pt-4">
          <span className="font-semibold text-white/70">Coach note:</span> {day.coachNotes}
        </div>
      ) : null}
    </div>
  </div>
);

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">{label}</div>
    {children}
  </div>
);

// ── Per-athlete working-set logging ────────────────────────────────────────────
// Lives at the bottom of the day. Kids find their name, punch in weight + reps for
// each working set of the MAIN lift (accessories are not logged). One log per
// athlete per session, editable. Feeds future S&C intelligence.
interface SetEntry { weight: string; reps: string }
interface LogRow { id: string; youth_id: string; athlete_name: string; sets: { set: number; weight: number | null; reps: number | null }[] }
const emptySets = (): SetEntry[] => Array.from({ length: 5 }, () => ({ weight: "", reps: "5" }));

const WorkingSetLog = ({ weekStart, dayKey, workoutDate, lift }:
  { weekStart: string; dayKey: DayKey; workoutDate: string; lift: string }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [athlete, setAthlete] = useState<{ id: string; name: string } | null>(null);
  const [sets, setSets] = useState<SetEntry[]>(emptySets());
  const [saving, setSaving] = useState(false);
  const [lastTime, setLastTime] = useState<string | null>(null);

  const { data: logs = [], refetch } = useQuery({
    queryKey: ["strength-logs", workoutDate],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await (supabase.from("strength_set_logs" as never) as any)
        .select("id, youth_id, athlete_name, sets").eq("workout_date", workoutDate).order("created_at", { ascending: true });
      if (error) throw error;
      return (data as LogRow[]) ?? [];
    },
  });

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.rpc("search_kiosk_youth", { _search: q.trim() });
      setResults((data as any[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const setsFromRow = (row?: { sets?: LogRow["sets"] }): SetEntry[] =>
    emptySets().map((s, i) => {
      const f = row?.sets?.[i];
      return f ? { weight: f.weight != null ? String(f.weight) : "", reps: f.reps != null ? String(f.reps) : "" } : s;
    });

  const pickAthlete = async (a: any) => {
    const name = `${a.child_first_name} ${a.child_last_name}`.trim();
    setAthlete({ id: a.id, name });
    setQ(""); setResults([]);
    const existing = logs.find((l) => l.youth_id === a.id);
    setSets(setsFromRow(existing));
    // Their last session on this lift — a little "beat last week" nudge.
    const { data: prev } = await (supabase.from("strength_set_logs" as never) as any)
      .select("sets").eq("youth_id", a.id).eq("lift", lift).lt("workout_date", workoutDate)
      .order("workout_date", { ascending: false }).limit(1);
    const p = (prev as any[])?.[0];
    const top = p?.sets?.length ? Math.max(...p.sets.map((s: any) => Number(s.weight) || 0)) : 0;
    setLastTime(top > 0 ? `Last ${lift}: top set ${top} lb — beat it.` : null);
  };

  const editLog = (l: LogRow) => { setAthlete({ id: l.youth_id, name: l.athlete_name }); setSets(setsFromRow(l)); setLastTime(null); };
  const cancel = () => { setAthlete(null); setSets(emptySets()); setLastTime(null); setQ(""); setResults([]); };

  const save = async () => {
    if (!athlete) return;
    setSaving(true);
    const cleanSets = sets.map((s, i) => ({
      set: i + 1,
      weight: s.weight.trim() === "" ? null : Number(s.weight),
      reps: s.reps.trim() === "" ? null : Number(s.reps),
    }));
    const { error } = await (supabase.from("strength_set_logs" as never) as any).upsert(
      { workout_date: workoutDate, week_start: weekStart, day_key: dayKey, youth_id: athlete.id, athlete_name: athlete.name, lift, sets: cleanSets },
      { onConflict: "workout_date,youth_id" }
    );
    setSaving(false);
    if (error) { toast.error("Couldn't save the log."); return; }
    cancel();
    await refetch();
    toast.success("Logged ✓");
  };

  const del = async (id: string) => {
    const { error } = await (supabase.from("strength_set_logs" as never) as any).delete().eq("id", id);
    if (error) { toast.error("Couldn't delete."); return; }
    if (athlete) cancel();
    await refetch();
  };

  const summarize = (l: LogRow): string =>
    (l.sets ?? []).filter((s) => s.weight != null || s.reps != null)
      .map((s) => `${s.weight ?? "—"}×${s.reps ?? "—"}`).join("  ·  ") || "No sets recorded";

  const setField = (i: number, key: keyof SetEntry, val: string) =>
    setSets((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: val.replace(/[^\d.]/g, "") } : s)));

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-neutral-900/50 p-5">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-5 w-5 text-white/60" />
        <h3 className="text-lg font-bold">Log working sets</h3>
        <span className="text-sm text-white/40">— {lift}</span>
      </div>
      <p className="text-xs text-white/40 mb-4">Find your name, then punch in the weight and reps you hit on each set. (Main lift only.)</p>

      {/* Who's logged so far — alphabetical */}
      {logs.length > 0 && (
        <div className="space-y-2 mb-4">
          {[...logs].sort((a, b) => a.athlete_name.localeCompare(b.athlete_name)).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{l.athlete_name}</div>
                <div className="text-[11px] text-white/50 truncate">{summarize(l)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => navigate(`/strength-coach/intelligence?athlete=${l.youth_id}`)}
                  className="h-8 w-8 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 border border-white/10" title="View progress">
                  <TrendingUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => editLog(l)} className="h-8 w-8 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 border border-white/10" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(l.id)} className="h-8 w-8 grid place-items-center rounded-md bg-white/5 hover:bg-red-500/20 border border-white/10" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entry form */}
      {athlete ? (
        <div className="rounded-xl border border-white/15 bg-black/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold">{athlete.name}</div>
            <button onClick={cancel} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          {lastTime && <p className="text-xs text-emerald-300/80 mb-3">💪 {lastTime}</p>}
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-12 text-xs text-white/40 shrink-0">Set {i + 1}</div>
                <input inputMode="decimal" value={s.weight} onChange={(e) => setField(i, "weight", e.target.value)}
                  placeholder="lb" className="w-24 rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm text-center focus:outline-none focus:border-white/30" />
                <span className="text-white/30">×</span>
                <input inputMode="numeric" value={s.reps} onChange={(e) => setField(i, "reps", e.target.value)}
                  placeholder="reps" className="w-20 rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm text-center focus:outline-none focus:border-white/30" />
                <span className="text-xs text-white/30">reps</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white disabled:opacity-60" style={{ background: NLA_RED }}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save log
            </button>
            <button onClick={cancel} className="px-4 py-2.5 rounded-lg font-semibold bg-white/5 hover:bg-white/10 border border-white/15">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/15 px-3">
            <Search className="h-4 w-4 text-white/30 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name to log…"
              className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-white/30 focus:outline-none" />
            {searching && <RefreshCw className="h-4 w-4 animate-spin text-white/30" />}
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/15 bg-neutral-900 shadow-xl max-h-64 overflow-auto">
              {results.map((a) => (
                <button key={a.id} onClick={() => pickAthlete(a)}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/10 text-sm border-b border-white/5 last:border-0">
                  {a.child_first_name} {a.child_last_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// The training log — every saved week, newest first, tap one to open its board.
const HistoryList = ({ currentWeekStart, onOpen }: { currentWeekStart: string; onOpen: (weekStart: string) => void }) => {
  const { data: weeks = [], isLoading } = useQuery({
    queryKey: ["strength-history"],
    queryFn: async (): Promise<WeekRow[]> => {
      const { data, error } = await (supabase.from("strength_weeks" as never) as any)
        .select("id, week_start, status, days, locked_at").order("week_start", { ascending: false });
      if (error) throw error;
      return (data as WeekRow[]) ?? [];
    },
  });

  if (isLoading) return <div className="text-white/40 py-20 text-center">Loading history…</div>;
  if (!weeks.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-10 text-center text-white/50">
        No weeks saved yet. Generate a week and it'll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {weeks.map((w) => {
        const isThis = w.week_start === currentWeekStart;
        const locked = w.status === "locked";
        return (
          <button key={w.id} onClick={() => onOpen(w.week_start)}
            className="w-full text-left rounded-xl border border-white/10 bg-neutral-900/60 hover:bg-neutral-800/60 hover:border-white/20 transition-colors p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold">{prettyRange(w.week_start)}</span>
                {isThis && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/15">THIS WEEK</span>}
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${locked ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" : "bg-amber-500/15 border-amber-400/30 text-amber-300"}`}>
                {locked ? "🔒 Locked" : "✏️ Draft"}
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {DAYS.map((d) => {
                const day = w.days?.[d.key];
                return (
                  <div key={d.key} className="rounded-lg bg-white/5 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-white/40">{d.label}</div>
                    <div className="text-sm font-semibold truncate">{day?.focus ?? d.lift}</div>
                    <div className="text-[11px] text-white/50 truncate">
                      {day?.accessories?.[0]?.name ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StrengthCoach;
