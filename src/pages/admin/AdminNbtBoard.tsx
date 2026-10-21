// NBT S&C Board — the coach's side.
//
// A month is the unit, not a week. The programming rules forbid random weeks:
// primary movements hold across a block while the challenge rises. So this
// builds a whole month at once, feeding each week the earlier weeks of the same
// block, and the coach reviews before any of it reaches the gym screen.
import { useMemo, useState } from "react";
import { levelIndent, levelDot, levelText } from "@/lib/bulletText";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Sparkles, Loader2, Monitor, Dumbbell, RefreshCw, Pencil, Lock, Unlock,
} from "lucide-react";
import { toast } from "sonner";
import {
  DAYS, DayKey, TRACKS, TRACK_META, Track, NbtBlock, NbtWeek, NbtDay, NbtLog, toDateString, firstOfMonth, monthLabel, mondaysInMonth, dateOfDay, mondayOf, addDays, NBT_AMBER, readableLines, minutesOf, totalMinutes, weekDays,
} from "@/lib/nbt";
import { priorWeekBriefs, roomReport, carryOver, dayProblem } from "@/lib/nbtCoaching";
import { AlertTriangle, Mail } from "lucide-react";
import { roomBrief } from "@/lib/nbtRooms";
import { prettyRange } from "@/lib/strength";
import { LiveSwitch } from "@/components/practice/LiveSwitch";
import NbtEditDay from "@/components/nbt/NbtEditDay";

/**
 * The Cardio Stations block as the wall reads it: the header line, then one
 * tile per station with its bullets (one per exercise) and the cue. Null for
 * a day written before the stations — an older circuit — which keeps the list.
 */
const stationsOf = (day: NbtDay) => {
  const lines = day.work.alpha ?? [];
  if (!/^\d+ stations/i.test(lines[0] ?? "")) return null;
  const tiles = lines.slice(1).map((l) => {
    const m = l.match(/^Station\s+(\d)\s*·\s*([^—]+?)\s*—\s*(.*)$/);
    const rest = m ? m[3].trim() : l;
    const [work, ...cueParts] = rest.split(" — ");
    const raw = work.split(/,\s*(?=(?:then|repeat|and then)\b)/i).map((x) => x.trim()).filter(Boolean);
    const repeats = raw.some((x) => /^repeat\b/i.test(x));
    const items = raw.filter((x) => !/^repeat\b/i.test(x)).map((x) => x.replace(/^(?:and\s+)?then\s+/i, ""));
    const cue = [repeats ? "Repeat" : "", cueParts.join(" — ").trim()].filter(Boolean).join(" · ");
    return { n: m ? m[1] : "", name: m ? m[2].trim() : "", items, cue };
  });
  return { header: lines[0], tiles };
};

/** The wall's card header shade — every card on the NBT wall wears it. */
const CARD_HEADER = { background: "#3c3527", borderColor: `${NBT_AMBER}66` } as const;
/** The small outline button on a lift card: Lift · Cardio · Both. */
const PART_BTN = "inline-flex items-center gap-1 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/55 hover:text-white hover:border-white/50 disabled:opacity-40 transition-colors";
/** A control in a card header. */
const ICON_BTN = "text-white/50 hover:text-white disabled:opacity-30 transition-colors";

/** The first of the month n months away — for the previous block's weeks. */
const shiftMonth = (monthStart: string, n: number) => {
  const d = new Date(`${monthStart}T12:00:00`);
  d.setMonth(d.getMonth() + n, 1);
  return firstOfMonth(toDateString(d));
};

/**
 * The NBT week builder. Runs in two places with one set of rules: on its own
 * page (the sidebar's NBT Workout Plan, with header and week arrows) and
 * inside the Practice Plan's NBT tab (`embedded`, where the page's week
 * picker owns the week). (Josh, 2026-10-03.)
 */
export const NbtWeekBuilder = ({
  weekStart: controlledWeek, onWeekChange, embedded = false,
}: {
  weekStart?: string;
  onWeekChange?: (weekStart: string) => void;
  embedded?: boolean;
}) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Opened from the Practice Plan: offer the way back, and open on that week.
  const [params] = useSearchParams();
  const fromPlan = params.get("from") === "practice-plan";
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : null;
  // Week by week, like the Battle Team page and the Practice Plan. The month
  // block is derived — a week belongs to the month its Monday is in — and
  // stays the thread for the emphasis and the continuity. (Josh, 2026-10-03.)
  const [ownWeekStart, setOwnWeekStart] = useState(() => mondayOf(linkedWeek ?? toDateString(new Date())));
  // The Practice Plan's week wins when it gives one; otherwise this page keeps its own.
  const weekStart = controlledWeek ? mondayOf(controlledWeek) : ownWeekStart;
  const setWeekStart = (next: string | ((w: string) => string)) => {
    const w = typeof next === "function" ? next(weekStart) : next;
    if (onWeekChange) onWeekChange(w);
    else setOwnWeekStart(w);
  };
  const month = firstOfMonth(weekStart);
  const thisWeekStart = mondayOf(toDateString(new Date()));
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Rev gets the day at 7 AM on his own; this is the resend, or the late change.
  const emailRev = async (w: NbtWeek, dayKey: DayKey) => {
    const date = dateOfDay(w.week_start, dayKey);
    setBusy(`mail-${w.id}-${dayKey}`);
    try {
      const { data, error } = await supabase.functions.invoke("nbt-morning", { body: { date } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.held) toast.error("The week isn't locked, so it went to Josh instead of Rev.");
      else toast.success(`Sent to Rev: ${DAYS.find((d) => d.key === dayKey)?.label ?? dayKey}'s workout.`);
    } catch (e) {
      toast.error(`Couldn't send it: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };
  // Persistent, unlike a toast — a twelve-call build should say where it is.
  const [progress, setProgress] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ week: NbtWeek; dayKey: DayKey } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["nbt-block", month],
    queryFn: async () => {
      const { data: block } = await supabase
        .from("nbt_blocks" as never)
        .select("*")
        .eq("month_start", month)
        .maybeSingle();
      const b = (block as unknown as NbtBlock) ?? null;
      if (!b) return { block: null, weeks: [] as NbtWeek[] };
      const { data: weeks } = await supabase
        .from("nbt_weeks" as never)
        .select("*")
        .eq("block_id", b.id)
        .order("week_in_block");
      return { block: b, weeks: (weeks as unknown as NbtWeek[]) || [] };
    },
  });

  /**
   * The block before this one, and every log the programme has.
   *
   * Both exist so the generator can stop working blind. Without the previous
   * block each month restarted from a clean slate; without the logs the model
   * progressed on the calendar while the rules told it mastery earns
   * progression. Neither is used for display — only as context for the AI.
   */
  const { data: history } = useQuery({
    queryKey: ["nbt-history", month],
    queryFn: async () => {
      const prevMonth = shiftMonth(month, -1);
      const { data: prevBlock } = await supabase
        .from("nbt_blocks" as never)
        .select("id")
        .eq("month_start", prevMonth)
        .maybeSingle();
      let prevWeeks: NbtWeek[] = [];
      if (prevBlock) {
        const { data: pw } = await supabase
          .from("nbt_weeks" as never)
          .select("*")
          .eq("block_id", (prevBlock as unknown as { id: string }).id)
          .order("week_in_block");
        prevWeeks = (pw as unknown as NbtWeek[]) || [];
      }
      // Enough history for a three-session window on each of the three days.
      const { data: logs } = await supabase
        .from("nbt_logs" as never)
        .select("*")
        .order("workout_date", { ascending: false })
        .limit(400);
      return { prevWeeks, logs: (logs as unknown as NbtLog[]) || [] };
    },
  });

  const block = data?.block ?? null;
  const weeks = useMemo(() => data?.weeks ?? [], [data]);
  // Green once the week ON SCREEN is live — not today's week.
  const thisWeekLocked = weeks.some((w) => w.week_start === weekStart && w.status === "locked");
  const mondays = useMemo(() => mondaysInMonth(month), [month]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["nbt-block", month] });

  /**
   * One day, generated with the earlier weeks of this block as context.
   *
   * Retried, because building a month is twelve AI calls back to back and a
   * single busy response used to abandon the rest of the month.
   */
  const generateDay = async (
    blockFocus: string,
    weekNo: number,
    dayKey: DayKey,
    prior: NbtWeek[],
    attempt = 0,
    only?: { track: Track; keepDay: NbtDay; block?: "lift" | "work" },
    /** Why the last attempt was thrown away, so the next one can fix it. */
    retryNote?: string
  ): Promise<NbtDay> => {
    // All three tracks of every earlier week in this block, not Alpha alone.
    const priorWeeks = priorWeekBriefs(prior, dayKey, weekNo);
    // Anonymised medians of what the room managed. Names never leave the app.
    const room = roomReport(history?.logs ?? [], dayKey, toDateString(new Date()));
    // Where last month finished, so week 1 continues rather than resets.
    const carry = weekNo === 1 ? carryOver(history?.prevWeeks ?? [], dayKey) : null;

    try {
      const { data: res, error } = await supabase.functions.invoke("nbt-workout", {
        body: {
          // The room and its kit, from the one inventory the checks also read.
          dayKey, weekInBlock: weekNo, blockFocus, priorWeeks, roomKit: roomBrief(dayKey),
          ...(room ? { room } : {}),
          ...(carry ? { carryOver: carry } : {}),
          ...(only ? { onlyTrack: only.track, keepDay: only.keepDay, ...(only.block ? { onlyBlock: only.block } : {}) } : {}),
          ...(retryNote ? { retryNote } : {}),
        },
      });
      if (error) throw error;
      if (!res?.day) throw new Error(res?.error ?? "Nothing came back.");
      // The room and the equipment are hard limits, and a prompt rule can be
      // ignored silently. A session that cannot physically be run — nowhere to
      // do it, or two tracks queueing for the same six bikes — is refused here
      // rather than put on the screen.
      const problem = dayProblem(res.day as NbtDay, dayKey, only?.track);
      if (problem) throw new Error(problem);
      return res.day as NbtDay;
    } catch (e) {
      if (attempt >= 2) throw e;
      // Busy responses are transient; wait and go again. A rejection is not
      // transient, so the reason goes back with the retry — asking again with
      // the identical prompt would only reproduce the same mistake.
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return generateDay(
        blockFocus, weekNo, dayKey, prior, attempt + 1, only, (e as Error)?.message
      );
    }
  };

  /**
   * Build the month. Weeks run in order so each can see the last.
   *
   * `rebuild` redoes every week; otherwise only the weeks that are missing get
   * written, so a month that stopped half way can be finished without throwing
   * away the weeks that worked.
   *
   * A week that fails does NOT abandon the rest — it is reported at the end and
   * can be filled in with another click.
   */
  /** The month's block row — made on first use so a week has a thread to belong to. */
  const ensureBlock = async (): Promise<NbtBlock> => {
    let b = block;
    if (!b) {
      const { data: created, error } = await supabase
        .from("nbt_blocks" as never)
        .insert({ month_start: month, focus: focus.trim() || null } as never)
        .select("*")
        .single();
      if (error) throw error;
      b = created as unknown as NbtBlock;
    } else if (focus.trim() && focus.trim() !== b.focus) {
      await supabase.from("nbt_blocks" as never).update({ focus: focus.trim() } as never).eq("id", b.id);
    }
    return b;
  };

  /**
   * Write ONE week — three days, in parallel — with every earlier week of the
   * block as context, so the movements hold and only the challenge changes.
   * A built or rebuilt week lands as a draft; the coach locks it to put it on
   * the wall. (Josh, 2026-10-03: per week, like everything else.)
   */
  const writeWeek = async (b: NbtBlock, weekNo: number, context: NbtWeek[]): Promise<NbtWeek> => {
    const blockFocus = focus.trim() || b.focus || "";
    const [monday, tuesday, thursday] = await Promise.all(
      DAYS.map((d) => generateDay(blockFocus, weekNo, d.key, context))
    );
    const { data: saved, error } = await supabase
      .from("nbt_weeks" as never)
      .upsert(
        {
          block_id: b.id,
          week_start: mondays[weekNo - 1],
          week_in_block: weekNo,
          days: { monday, tuesday, thursday },
          status: "draft",
          locked_at: null,
        } as never,
        { onConflict: "week_start" } as never
      )
      .select("*")
      .single();
    if (error) throw error;
    return saved as unknown as NbtWeek;
  };

  const buildWeek = async (weekNo: number) => {
    setBusy(`week-${weekNo}`);
    setProgress(`Writing week ${weekNo}…`);
    try {
      const b = await ensureBlock();
      // Earlier weeks of this block are the context; this week is replaced.
      const context = weeks.filter((w) => w.week_in_block < weekNo);
      await writeWeek(b, weekNo, context);
      refresh();
      toast.success(`Week ${weekNo} is written. Lock it when it's ready for the wall.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't build that week.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  /** On the wall, or off it. The wall shows locked weeks only. */
  const toggleLock = async (w: NbtWeek) => {
    const lock = w.status !== "locked";
    const { error } = await supabase
      .from("nbt_weeks" as never)
      .update({ status: lock ? "locked" : "draft", locked_at: lock ? new Date().toISOString() : null } as never)
      .eq("id", w.id);
    if (error) toast.error(error.message);
    else {
      refresh();
      toast.success(lock ? `Week ${w.week_in_block} is live on the Gym Board.` : `Week ${w.week_in_block} is off the Gym Board — edit away.`);
    }
  };

  const saveDay = async (week: NbtWeek, dayKey: DayKey, day: NbtDay) => {
    const { error } = await supabase
      .from("nbt_weeks" as never)
      .update({ days: { ...week.days, [dayKey]: day } } as never)
      .eq("id", week.id);
    if (error) throw error;
    refresh();
  };

  /**
   * Rewrite ONE track of a day, handing the model the other two so the three
   * stay progressions of the same pattern rather than drifting apart.
   */
  /**
   * Rewrite one track — or just its lift, or just its work block. Whatever
   * was not asked for is put back from what we sent, so a model that ignores
   * the instruction still cannot disturb it. (Josh, 2026-10-03.)
   */
  const regenerateTrack = async (week: NbtWeek, dayKey: DayKey, track: Track, blockPart?: "lift" | "work") => {
    const current = week.days?.[dayKey];
    if (!current) return;
    setBusy(`${week.id}-${dayKey}-${track}${blockPart ? `-${blockPart}` : ""}`);
    try {
      const day = await generateDay(
        block?.focus ?? "",
        week.week_in_block,
        dayKey,
        weeks,
        0,
        { track, keepDay: current, block: blockPart }
      );
      const merged: NbtDay = {
        ...current,
        lift: blockPart === "work" ? current.lift : { ...current.lift, [track]: day.lift[track] },
        // The Cardio Stations block is one block for the room: both tracks' lines come back together.
        work: day.work,
      };
      await saveDay(week, dayKey, merged);
      toast.success(blockPart === "work" ? "Cardio Stations rewritten for the room." : `${TRACK_META[track].label}'s ${blockPart === "lift" ? "lift" : "track"} rewritten.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn’t rewrite that track.");
    } finally {
      setBusy(null);
    }
  };

  /** Rewrite one day, keeping the rest of the month exactly as it is. */
  const regenerateDay = async (week: NbtWeek, dayKey: DayKey) => {
    setBusy(`${week.id}-${dayKey}`);
    try {
      const day = await generateDay(block?.focus ?? "", week.week_in_block, dayKey, weeks);
      await saveDay(week, dayKey, day);
      toast.success(`${dayKey} rewritten.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't rewrite that day.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={embedded ? "space-y-5 text-white" : "p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white"}>
      {!embedded && fromPlan && (
        <button
          type="button"
          onClick={() => navigate(`/admin/operations/practice-plan?week=${weekStart}&tab=nbt`)}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> The Planner
        </button>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {embedded ? (
          <p className="text-sm text-neutral-400 self-center">
            <span className="font-bold text-white">NBT Workout Plan</span> · Monday · Tuesday · Thursday · Bravo and Alpha
          </p>
        ) : (
        <div>
          <h2 className="text-2xl font-bold">NBT Workout Plan</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Monday, Tuesday and Thursday for the Non-Battle Team — Bravo and Alpha, one week at a time, each week seeing the last.
          </p>
        </div>
        )}
        {/* Green once this week is locked: it's on the wall for everyone. */}
        <Button
          variant="outline"
          onClick={() => navigate(`/nbt-board?week=${weekStart}&from=plan`)}
          title={thisWeekLocked ? "Live on the gym board" : "This week is still a draft — lock it to put it on the board"}
          className={thisWeekLocked
            ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white hover:text-white"
            : "bg-transparent border-neutral-700 text-neutral-300 hover:text-white"}
        >
          <Monitor className="w-4 h-4 mr-1.5" /> Open gym board
        </Button>
      </div>

          {/* Week nav + the month's emphasis */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <div className={`flex items-center gap-2 ${embedded ? "" : "justify-between"}`}>
              {!embedded && (
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setWeekStart((w) => addDays(w, -7))}
                  className="text-neutral-400 hover:text-white h-8 w-8"
                  aria-label="Previous week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              )}
              <div className={embedded ? "text-left" : "text-center"}>
                <p className="font-bold text-lg">{prettyRange(weekStart)}</p>
                <p className="text-[11px] text-neutral-500">
                  {weekStart === thisWeekStart ? "This week" : `Week of ${weekStart}`}
                </p>
              </div>
              {!embedded && (
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setWeekStart((w) => addDays(w, 7))}
                  className="text-neutral-400 hover:text-white h-8 w-8"
                  aria-label="Next week"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-xs text-neutral-400 shrink-0">{monthLabel(month).replace(/ \d{4}$/, "")}&apos;s emphasis</Label>
              <Input
                value={focus || block?.focus || ""}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Own the basics · Pace yourself · Quality before weight"
                className="flex-1 min-w-[240px] h-9 bg-neutral-800 border-neutral-700 text-white text-sm"
              />
            </div>
            {progress ? (
              <p className="text-[11px] text-neutral-300 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> {progress} This takes a minute or two.
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500">
                One line for the whole month. Each week sees the ones before it, so the movements hold
                across the month and only the challenge changes.
              </p>
            )}
          </div>

          {isLoading ? (
            <p className="text-neutral-500 py-10 text-center">Loading…</p>
          ) : (
            <div className="space-y-4">
              {[weekStart].map((monday) => {
                const weekNo = mondays.indexOf(monday) + 1;
                const w = weeks.find((x) => x.week_start === monday);
                const isThisWeek = monday === thisWeekStart;
                const isLinked = monday === linkedWeek;
                if (!w) {
                  return (
                    <div
                      key={monday}
                      className={`rounded-xl border bg-neutral-900 p-8 text-center ${isLinked ? "border-white/30" : "border-neutral-800"}`}
                    >
                      <Sparkles className="h-8 w-8 mx-auto mb-3 text-white/30" />
                      <p className="font-bold mb-1">Not written yet</p>
                      <p className="text-neutral-400 text-sm mb-5 max-w-md mx-auto">
                        Monday squat and push, Tuesday athletic and overhead, Thursday hinge and pull — Alpha and Bravo, in one go.
                      </p>
                      <Button
                        onClick={() => buildWeek(weekNo)}
                        disabled={busy !== null}
                        className="text-black font-bold"
                        style={{ backgroundColor: NBT_AMBER }}
                      >
                        {busy === `week-${weekNo}` ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-1.5" />
                        )}
                        Build this week
                      </Button>
                    </div>
                  );
                }
                const locked = w.status === "locked";
                // A week written before the current room rules — the sled,
                // the court language, the kit — is caught here, not on the
                // wall. The checks only run when a day is generated, so a
                // stored week needs a rebuild to pick the rules up.
                const stale = DAYS
                  .map((d) => ({ d, problem: w.days?.[d.key] ? dayProblem(w.days[d.key]!, d.key) : null }))
                  .filter((x) => x.problem);
                return (
                <div
                  key={w.id}
                  className={`rounded-xl border bg-black/40 p-4 ${isLinked ? "border-white/30" : "border-white/10"}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <p className="font-bold">
                      {prettyRange(w.week_start)}
                      <span className="text-neutral-500 font-normal text-sm ml-2">
                        {isThisWeek ? "this week" : "Mon · Tue · Thu"}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => buildWeek(weekNo)}
                        disabled={busy !== null || locked}
                        title={locked ? "Take the week off the Gym Board to rebuild it" : "Throw this week away and write it again"}
                        className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
                      >
                        {busy === `week-${weekNo}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Rebuild
                      </Button>
                      <LiveSwitch live={locked} onChange={() => toggleLock(w)} pending={busy !== null} what="the NBT week" />
                    </div>
                  </div>
                  {stale.length > 0 && (
                    <div className="mb-3 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm">
                      <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" /> Written before the current room rules — rebuild this week.
                      </p>
                      <ul className="mt-1 space-y-0.5 text-amber-100/80 text-xs">
                        {stale.map(({ d, problem }) => (
                          <li key={d.key}><span className="font-semibold">{d.label}:</span> {problem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-4">
                    {weekDays(w.days).map((d) => {
                      const day = w.days?.[d.key];
                      const key = `${w.id}-${d.key}`;
                      const stations = day ? stationsOf(day) : null;
                      return (
                        <div key={d.key} className="rounded-xl border border-white/15 bg-[#141416] overflow-hidden shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]">
                          {/* The day's header in the wall's shade; the day's controls live in it. */}
                          <div className="px-4 py-2.5 border-b flex items-center justify-between gap-3" style={CARD_HEADER}>
                            <div className="min-w-0">
                              <p className="text-sm font-black uppercase tracking-wide text-white leading-tight">{d.label}</p>
                              <p className="text-[11px] text-white/40">{d.title}</p>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                onClick={() => day && setEditing({ week: w, dayKey: d.key })}
                                disabled={!day || busy !== null}
                                title="Edit this day by hand"
                                className={ICON_BTN}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => emailRev(w, d.key)}
                                disabled={!day || !locked || busy !== null}
                                title={locked ? "Email this day's workout to Rev now" : "Put the week on the Gym Board first, then it can go to Rev"}
                                className={ICON_BTN}
                              >
                                {busy === `mail-${w.id}-${d.key}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Mail className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => regenerateDay(w, d.key)}
                                disabled={busy !== null}
                                title="Rewrite the whole day"
                                className={ICON_BTN}
                              >
                                {busy === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="p-3">
                          {!day ? (
                            <p className="text-xs text-neutral-600 italic">Not written</p>
                          ) : (
                            /* The whole session the way the wall shows it, so the
                               week is reviewed and approved from here. */
                            <div className="space-y-3">
                              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                                <p className="text-sm text-white">{day.focus || ""}</p>
                                <p className="text-[11px] text-white/45 tabular-nums">
                                  prep {minutesOf(day).prep} · lift {minutesOf(day).lift} · stations {minutesOf(day).work} · reset {minutesOf(day).reset} · {totalMinutes(day)} min
                                </p>
                              </div>

                              {/* The lifts: two cards, one row — Alpha left, Bravo right, as on the wall. */}
                              <div className="grid gap-3 sm:grid-cols-2">
                                {TRACKS.map((t) => {
                                  const m = TRACK_META[t];
                                  const lift = day.lift[t];
                                  const [dose, ...cue] = (lift?.detail ?? "").split(" — ");
                                  return (
                                    <section key={t} className="rounded-lg border border-white/15 bg-[#141416] overflow-hidden">
                                      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={CARD_HEADER}>
                                        <div className="min-w-0">
                                          <p className="text-sm font-black uppercase tracking-wide text-white leading-tight">{m.label}</p>
                                          <p className="text-[10px] text-white/40 truncate">{m.blurb}</p>
                                        </div>
                                        {/* Rewrite this track's lift. The Cardio Stations are one block for
                                            the room, so their button sits on the stations card (Josh, 2026-10-21). */}
                                        <div className="flex items-center gap-1 shrink-0">
                                          {([
                                            ["lift", "Rewrite lift"],
                                          ] as const).map(([part, label]) => {
                                            const bkey = `${w.id}-${d.key}-${t}${part ? `-${part}` : ""}`;
                                            return (
                                              <button
                                                key={label}
                                                onClick={() => regenerateTrack(w, d.key, t, part)}
                                                disabled={busy !== null}
                                                title={part === "lift" ? `Rewrite only ${m.label}'s lift` : part === "work" ? "Rewrite the Cardio Stations for the room" : `Rewrite ${m.label}'s lift and the Cardio Stations`}
                                                className={PART_BTN}
                                              >
                                                {busy === bkey ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                {label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div className="px-3 pt-2 pb-3">
                                        <p className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: `${m.color}b3` }}>Lift</p>
                                        <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                                          <p className="text-lg font-bold leading-tight" style={{ color: m.color }}>{lift?.name || "—"}</p>
                                          {dose && (
                                            <p className="rounded px-1.5 py-0.5 text-sm font-black leading-snug" style={{ backgroundColor: `${m.color}26`, color: m.color }}>{dose}</p>
                                          )}
                                        </div>
                                        {cue.length > 0 && <p className="mt-1 text-xs text-white/65 leading-snug">{cue.join(" — ")}</p>}
                                        {/* A week written before the stations keeps its circuit under the lift. */}
                                        {!stations && (day.work[t] ?? []).length > 0 && (
                                          <div className="mt-2">
                                            <p className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: `${m.color}b3` }}>Cardio</p>
                                            <ul className="mt-0.5 space-y-0.5">
                                              {readableLines(day.work[t]).map((line, k) =>
                                                line.kind === "rounds" ? (
                                                  <li key={k} className="text-[11px] font-bold uppercase tracking-wide" style={{ color: m.color }}>
                                                    {line.text}
                                                  </li>
                                                ) : (
                                                  <li key={k} className="text-xs flex items-start gap-1.5" style={{ marginLeft: levelIndent(line.level) }}>
                                                    <span className="rounded-full shrink-0 mt-[0.45em]" style={{ width: levelDot(line.level, 0.25).size, height: levelDot(line.level, 0.25).size, backgroundColor: NBT_AMBER }} />
                                                    <span style={levelText(line.level)}>{line.text}</span>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    </section>
                                  );
                                })}
                              </div>

                              {/* Cardio Stations: one card for the room, a tile per station. */}
                              {stations && (
                                <section className="rounded-lg border border-white/15 bg-white/[0.06] overflow-hidden">
                                  <div className="px-3 py-2 border-b flex items-baseline justify-between gap-3 flex-wrap" style={CARD_HEADER}>
                                    <p className="text-sm font-black uppercase tracking-wide text-white leading-tight">
                                      Cardio Stations <span className="text-white/40 text-[10px] tracking-normal font-bold">· everyone</span>
                                    </p>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <p className="text-[11px] text-white/40">{stations.header}</p>
                                      {/* One rewrite for the room: the stations are the same lines for both tracks. */}
                                      <button
                                        onClick={() => regenerateTrack(w, d.key, "alpha", "work")}
                                        disabled={busy !== null}
                                        title="Rewrite the Cardio Stations for the whole room — both lifts stay as they are"
                                        className={PART_BTN}
                                      >
                                        {busy === `${w.id}-${d.key}-alpha-work` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Rewrite stations
                                      </button>
                                    </div>
                                  </div>
                                  <div
                                    className="grid gap-2 px-3 pt-2.5 pb-3 grid-cols-2 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
                                    style={{ "--n": Math.max(1, stations.tiles.length) } as React.CSSProperties}
                                  >
                                    {stations.tiles.map((tile, i) => (
                                      <div key={i} className="rounded-md border border-white/15 bg-[#141416] px-2.5 py-2 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-tight" style={{ color: `${NBT_AMBER}b3` }}>
                                          <span className="text-base font-black tracking-normal mr-1 align-[-0.1em]" style={{ color: NBT_AMBER }}>{tile.n || i + 1}</span>{tile.name}
                                        </p>
                                        <ul className="mt-1.5 space-y-0.5">
                                          {tile.items.map((it, k) => (
                                            <li key={k} className="flex items-start gap-1.5">
                                              <span className="shrink-0 rounded-full mt-[0.45em]" style={{ width: 5, height: 5, backgroundColor: NBT_AMBER }} />
                                              <span className="text-xs leading-snug text-white">{it}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        {tile.cue && <p className="mt-1 text-[11px] leading-snug text-white/55">{tile.cue}</p>}
                                      </div>
                                    ))}
                                  </div>
                                </section>
                              )}

                              {/* Coach-only: what the wall deliberately leaves off. */}
                              <div className="text-[11px] text-white/40 space-y-1 pt-2 border-t border-white/10">
                                <p>
                                  <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Pattern</span>
                                  {day.lift.pattern || "—"}
                                  {day.work.title ? ` · ${day.work.title}` : ""}
                                  {day.work.emphasis ? ` (${day.work.emphasis})` : ""}
                                </p>
                                {day.lift.cues.length > 0 && (
                                  <p>
                                    <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Cues</span>
                                    {day.lift.cues.join("  ·  ")}
                                  </p>
                                )}
                                {day.reset.length > 0 && (
                                  <p>
                                    <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Reset</span>
                                    {day.reset.join("  ·  ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}

      <NbtEditDay
        day={editing ? editing.week.days?.[editing.dayKey] ?? null : null}
        dayKey={editing?.dayKey ?? null}
        weekLabel={editing ? `Week ${editing.week.week_in_block}` : ""}
        onClose={() => setEditing(null)}
        onSave={async (d) => {
          if (!editing) return;
          try {
            await saveDay(editing.week, editing.dayKey, d);
            toast.success("Saved.");
            setEditing(null);
          } catch (e) {
            toast.error((e as Error)?.message ?? "Couldn’t save that.");
          }
        }}
      />
    </div>
  );
};

/** The sidebar's NBT Workout Plan page: the builder with its own header and week arrows. */
const AdminNbtBoard = () => <NbtWeekBuilder />;

export default AdminNbtBoard;
