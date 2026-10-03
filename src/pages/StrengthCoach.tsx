import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Dumbbell, Lock, Unlock, RefreshCw, Sparkles, Wand2, CalendarDays, History, Search, Plus, Trash2, X, Pencil, ClipboardList, TrendingUp, Monitor } from "lucide-react";

// Battle Team Workout Plan — the coach's page. Build the week (Mon Bench · Wed
// Squat · Fri Deadlift), review every day on one card the way the NBT page
// does, revise any day in plain English, then lock the week to the wall.
// The AI never prescribes weights — athletes (13–18) self-select their loads.
// Strength only: there is no conditioning on this page, by design.

const NLA_RED = "#bf0f3e";

// The week's shape and the date helpers live in src/lib/strength.ts now, shared
// with the gym screen at /strength-board so the two can never disagree.
import {
  DAYS, type DayKey, type DayWorkout, type WeekRow, toMonday, isoDate, addDays, prettyRange,
} from "@/lib/strength";
import ExerciseVideo from "@/components/strength/ExerciseVideo";
import { LiveSwitch } from "@/components/practice/LiveSwitch";

/**
 * The Battle Team week builder. Runs in two places with one set of rules:
 * on its own page (the sidebar's Battle Team Workout Plan, with header,
 * History and its own week arrows) and inside the Practice Plan's BT tab
 * (`embedded`, where the page's week picker owns the week). (Josh, 2026-10-03.)
 */
export const BattleTeamWeek = ({
  weekStart: controlledWeek, onWeekChange, embedded = false,
}: {
  weekStart?: string;
  onWeekChange?: (weekStart: string) => void;
  embedded?: boolean;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // Opened from the Practice Plan: the back button goes home there, on the
  // same week. (Josh, 2026-10-03.)
  const [params] = useSearchParams();
  const fromPlan = params.get("from") === "practice-plan";
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : null;
  const todayMonday = useMemo(() => toMonday(new Date()), []);
  const [ownWeekMonday, setOwnWeekMonday] = useState<Date>(() => (linkedWeek ? toMonday(new Date(linkedWeek + "T12:00:00")) : todayMonday));
  // The Practice Plan's week wins when it gives one; otherwise this page keeps its own.
  const weekMonday = controlledWeek ? toMonday(new Date(controlledWeek + "T12:00:00")) : ownWeekMonday;
  const setWeekMonday = (next: Date | ((w: Date) => Date)) => {
    const d = typeof next === "function" ? next(weekMonday) : next;
    if (onWeekChange) onWeekChange(isoDate(toMonday(d)));
    else setOwnWeekMonday(toMonday(d));
  };
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
  const [reviseTexts, setReviseTexts] = useState<Partial<Record<DayKey, string>>>({});

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

  const shiftWeek = (n: number) => { setReviseTexts({}); setWeekMonday((w) => addDays(w, n * 7)); };

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

  // Rewrite ONE day and leave the other two exactly as they are.
  const [regeneratingDay, setRegeneratingDay] = useState<DayKey | null>(null);
  const regenerateDay = async (dayKey: DayKey) => {
    if (!week) return;
    setRegeneratingDay(dayKey);
    try {
      const { data: hist } = await (supabase.from("strength_weeks" as never) as any)
        .select("week_start, days").lt("week_start", weekStart)
        .order("week_start", { ascending: false }).limit(3);
      const { data, error } = await supabase.functions.invoke("strength-coach", {
        body: { mode: "generate", dayKey, weekStart, history: hist ?? [] },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.day?.focus) throw new Error("The coach came back empty — try again.");

      const nextDays = { ...days, [dayKey]: data.day };
      const { error: upErr } = await (supabase.from("strength_weeks" as never) as any)
        .update({ days: nextDays }).eq("id", week.id);
      if (upErr) throw upErr;

      setReviseTexts((t) => ({ ...t, [dayKey]: "" }));
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["strength-history"] });
      toast.success(`${DAYS.find((d) => d.key === dayKey)?.label} rewritten — the other days untouched.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't rewrite that day.");
    } finally {
      setRegeneratingDay(null);
    }
  };

  // Revise ONE day with a plain-English note.
  const [revisingDay, setRevisingDay] = useState<DayKey | null>(null);
  const reviseDay = async (dayKey: DayKey) => {
    const target = days[dayKey];
    const text = (reviseTexts[dayKey] ?? "").trim();
    if (!week || !target || !text) return;
    setRevisingDay(dayKey);
    try {
      const { data, error } = await supabase.functions.invoke("strength-coach", {
        body: { mode: "revise", dayKey, day: target, instruction: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newDay = data?.day;
      if (!newDay?.focus) throw new Error("The coach came back empty — try again.");

      const nextDays = { ...days, [dayKey]: newDay };
      const { error: upErr } = await (supabase.from("strength_weeks" as never) as any)
        .update({ days: nextDays }).eq("id", week.id);
      if (upErr) throw upErr;

      setReviseTexts((t) => ({ ...t, [dayKey]: "" }));
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["strength-history"] });
      toast.success(`${DAYS.find((d) => d.key === dayKey)?.label} updated.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't revise that day.");
    } finally {
      setRevisingDay(null);
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
    toast.success(lock ? "Live on the Gym Board." : "Off the Gym Board — edit away.");
  };

  return (
    <div className={embedded ? "text-white" : "min-h-screen bg-black text-white"}>
      <div className={embedded ? "" : "max-w-5xl mx-auto px-4 py-6 sm:py-8"}>
        {!embedded && (
          <>
            {/* Back to admin — or to the Practice Plan when that's where we came from */}
            <button onClick={() => navigate(fromPlan ? `/admin/operations/practice-plan?week=${weekStart}&tab=bt` : "/admin/operations")}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-4">
              <ChevronLeft className="h-4 w-4" /> {fromPlan ? "Practice Plan" : "Operations"}
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: NLA_RED }}>
                <Dumbbell className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Battle Team Workout Plan</h1>
                <p className="text-white/50 text-sm">Bench · Squat · Deadlift — built one week at a time, locked to the gym board.</p>
              </div>
            </div>
          </>
        )}

        {/* View toggle (standalone) + the wall and Intelligence */}
        <div className="flex items-center justify-between gap-3 mb-5">
          {embedded ? (
            <p className="text-sm text-white/50">
              <span className="font-bold text-white">Battle Team Workout Plan</span> · Bench · Squat · Deadlift
            </p>
          ) : (
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
          )}
          <div className="flex items-center gap-2">
            {/* The wall view. This page is the coach's desk; that one is what
                the crew reads from across the gym. */}
            {/* Green once the week is locked: that's the signal it's on the
                wall for everyone. Grey while it's still a draft. */}
            <button onClick={() => navigate("/strength-board")}
              title={locked ? "Live on the gym board" : "Draft — lock the week to put it on the board"}
              className={locked
                ? "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white"
                : "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/15"}>
              <Monitor className="h-4 w-4" /> <span className="hidden sm:inline">Open gym board</span>
            </button>
            <button onClick={() => navigate("/strength-coach/intelligence")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/15">
              <TrendingUp className="h-4 w-4" /> <span className="hidden sm:inline">Intelligence</span>
            </button>
          </div>
        </div>

        {view === "history" ? (
          <HistoryList
            currentWeekStart={isoDate(todayMonday)}
            onOpen={(ws) => { setWeekMonday(new Date(ws + "T00:00:00")); setReviseTexts({}); setView("week"); }}
          />
        ) : (
        <>
        {/* The week as one card, three days across — the same bones as the
            NBT Workout Plan page, so a coach reads both the same way. */}
        <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              {!embedded && (
                <button onClick={() => shiftWeek(-1)} className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10" aria-label="Previous week">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className={embedded ? "text-left" : "text-center min-w-[9rem]"}>
                <div className="font-bold">{prettyRange(weekStart)}</div>
                <div className="text-[11px] text-white/40">{isCurrentWeek ? "This week" : "Week of " + weekStart}</div>
              </div>
              {!embedded && (
                <button onClick={() => shiftWeek(1)} className="h-9 w-9 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10 border border-white/10" aria-label="Next week">
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
            {hasWeek && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${locked ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300" : "bg-amber-500/15 border-amber-400/30 text-amber-300"}`}>
                  {locked ? "Live on Gym Board" : "Draft"}
                </span>
                <button onClick={generateWeek} disabled={generating || locked}
                  title={locked ? "Unlock the week to rebuild it" : "Throw this week away and write all three days again"}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white/5 hover:bg-white/10 border border-white/15 disabled:opacity-50">
                  <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} /> Rebuild
                </button>
                <LiveSwitch live={locked} onChange={(next) => setLocked(next)} what="the Battle Team week" />
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-white/40 py-16 text-center">Loading…</div>
          ) : !hasWeek ? (
            <div className="rounded-lg border border-white/10 bg-black/30 p-8 text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-white/30" />
              <p className="font-bold mb-1">Not written yet</p>
              <p className="text-white/50 text-sm mb-5 max-w-md mx-auto">
                Monday bench, Wednesday squat, Friday deadlift — three days, warm-ups, extra work and scaling, in one go.
              </p>
              <button onClick={generateWeek} disabled={generating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white disabled:opacity-60"
                style={{ background: NLA_RED }}>
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Building the week…" : "Build this week"}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {DAYS.map((d) => (
                <DayCard
                  key={d.key}
                  meta={d}
                  day={days[d.key]}
                  locked={locked}
                  isToday={isCurrentWeek && d.weekday === new Date().getDay()}
                  rewriting={regeneratingDay === d.key}
                  revising={revisingDay === d.key}
                  busy={regeneratingDay !== null || revisingDay !== null || generating}
                  reviseText={reviseTexts[d.key] ?? ""}
                  onReviseText={(v) => setReviseTexts((t) => ({ ...t, [d.key]: v }))}
                  onRewrite={() => regenerateDay(d.key)}
                  onRevise={() => reviseDay(d.key)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Working-set logging — main lift only, per athlete. Pick the day. */}
        {hasWeek && (
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-bold">Log sets for</span>
              {DAYS.map((d) => {
                const active = d.key === selectedDay;
                return (
                  <button key={d.key} onClick={() => setSelectedDay(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${active ? "border-transparent text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white"}`}
                    style={active ? { background: NLA_RED } : undefined}>
                    {d.label}
                  </button>
                );
              })}
            </div>
            {current && (
              <WorkingSetLog
                weekStart={weekStart}
                dayKey={selectedDay}
                workoutDate={workoutDate}
                lift={current.main?.lift || current.focus}
              />
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

/** The sidebar's Battle Team Workout Plan page: the builder with its own header and week arrows. */
const StrengthCoach = () => <BattleTeamWeek />;

// One day, the whole session, on the review card: the bar, the extra work with
// its demo video, the finisher — and the coach-only extras (guidance, cues,
// how-tos, scaling) in grey underneath, which the wall deliberately leaves off.
const DayCard = ({
  meta, day, locked, isToday, rewriting, revising, busy, reviseText, onReviseText, onRewrite, onRevise,
}: {
  meta: (typeof DAYS)[number];
  day: DayWorkout | undefined;
  locked: boolean;
  isToday: boolean;
  rewriting: boolean;
  revising: boolean;
  busy: boolean;
  reviseText: string;
  onReviseText: (v: string) => void;
  onRewrite: () => void;
  onRevise: () => void;
}) => (
  <div className="rounded-lg border border-white/10 bg-black/30 p-3">
    <div className="flex items-start justify-between gap-2 mb-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-white/80">
          {meta.label}{isToday && <span className="ml-1.5 text-[9px] font-bold px-1 rounded bg-white/20">TODAY</span>}
        </p>
        <p className="text-[11px] text-white/45">{meta.lift}</p>
      </div>
      {!locked && (
        <button onClick={onRewrite} disabled={busy} title={`Rewrite the whole ${meta.label}`}
          className="text-white/40 hover:text-white disabled:opacity-30 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${rewriting ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>

    {!day ? (
      <p className="text-xs text-white/40 italic">Not written</p>
    ) : (
      <div className="space-y-3">
        {day.focus && <p className="text-sm text-white">{day.focus}</p>}

        {/* The bar */}
        {day.main && (
          <div className="rounded-md border p-2 space-y-1" style={{ borderColor: `${NLA_RED}55` }}>
            <p className="text-xs font-bold" style={{ color: NLA_RED }}>The bar</p>
            <p className="text-xs text-white leading-snug">
              <span className="text-[10px] font-bold uppercase tracking-wide text-white/45 mr-1.5">Lift</span>
              <span className="font-semibold">{day.main.lift}</span>
              <span className="text-white/60"> · {day.main.scheme}</span>
            </p>
          </div>
        )}

        {/* Extra work, each with its demo */}
        {day.accessories?.length ? (
          <div className="rounded-md border p-2 space-y-2" style={{ borderColor: "#fb718555" }}>
            <p className="text-xs font-bold" style={{ color: "#fb7185" }}>Extra work</p>
            {day.accessories.map((a, i) => (
              <div key={i}>
                <p className="text-xs text-white leading-snug flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-white/60 whitespace-nowrap">{a.sets}</span>
                </p>
                <div className="mt-1">
                  <ExerciseVideo name={a.name} compact inline />
                </div>
              </div>
            ))}
            {day.finisher && (
              <p className="text-xs text-white/80 leading-snug pt-1 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/45 mr-1.5">Finisher</span>
                <span className="font-semibold text-white">{day.finisher.name}</span>
                {day.finisher.detail ? <span className="text-white/60"> — {day.finisher.detail}</span> : null}
              </p>
            )}
          </div>
        ) : null}

        {/* Coach-only: what the wall deliberately leaves off. */}
        <div className="text-[11px] text-white/45 space-y-1 pt-1 border-t border-white/10">
          {day.warmup?.length ? (
            <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Warm-up</span>{day.warmup.map((w) => (w.detail ? `${w.name} — ${w.detail}` : w.name)).join("  ·  ")}</p>
          ) : null}
          {day.main?.guidance ? <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Guidance</span>{day.main.guidance}</p> : null}
          {day.main?.cues?.length ? <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Cues</span>{day.main.cues.join("  ·  ")}</p> : null}
          {day.main?.rest ? <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Rest</span>{day.main.rest}</p> : null}
          {day.accessories?.some((a) => a.howTo || a.scale) ? (
            <div className="space-y-0.5">
              {day.accessories.map((a, i) => (a.howTo || a.scale) ? (
                <p key={i}><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">{a.name}</span>{a.howTo ?? ""}{a.scale ? ` · ⚖ ${a.scale}` : ""}</p>
              ) : null)}
            </div>
          ) : null}
          {day.estMinutes ? <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Minutes</span>~{day.estMinutes}</p> : null}
          {day.coachNotes ? <p><span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Note</span>{day.coachNotes}</p> : null}
        </div>

        {/* Revise this day in plain English — while unlocked. */}
        {!locked && (
          <div className="flex gap-1.5 pt-1">
            <input value={reviseText} onChange={(e) => onReviseText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onRevise(); }}
              placeholder="Revise — e.g. go easier on shoulders"
              className="flex-1 min-w-0 rounded-md bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs placeholder:text-white/30 focus:outline-none focus:border-white/30" />
            <button onClick={onRevise} disabled={busy || !reviseText.trim()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-50 shrink-0" style={{ background: NLA_RED }}>
              {revising ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Revise
            </button>
          </div>
        )}
      </div>
    )}
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
