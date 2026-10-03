// NBT S&C Board — the coach's side.
//
// A month is the unit, not a week. The programming rules forbid random weeks:
// primary movements hold across a block while the challenge rises. So this
// builds a whole month at once, feeding each week the earlier weeks of the same
// block, and the coach reviews before any of it reaches the gym screen.
import { useMemo, useState } from "react";
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
  DAYS, DayKey, TRACKS, TRACK_META, Track, NbtBlock, NbtWeek, NbtDay, NbtLog,
  toDateString, firstOfMonth, monthLabel, mondaysInMonth, dateOfDay, mondayOf, NBT_AMBER,
  readableLines, minutesOf, totalMinutes,
} from "@/lib/nbt";
import { priorWeekBriefs, roomReport, carryOver, dayProblem } from "@/lib/nbtCoaching";
import { AlertTriangle } from "lucide-react";
import { roomBrief } from "@/lib/nbtRooms";
import NbtEditDay from "@/components/nbt/NbtEditDay";

const shiftMonth = (monthStart: string, n: number) => {
  const d = new Date(`${monthStart}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return firstOfMonth(toDateString(d));
};

const AdminNbtBoard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Opened from the Practice Plan's S&C tab: offer the way back, and open on
  // the month that week belongs to.
  const [params] = useSearchParams();
  const fromPlan = params.get("from") === "practice-plan";
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : null;
  const [month, setMonth] = useState(() => firstOfMonth(linkedWeek ?? toDateString(new Date())));
  const thisWeekStart = mondayOf(toDateString(new Date()));
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
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
  // Green once this week's row is locked: that's what the wall shows.
  const thisWeekLocked = weeks.some((w) => w.week_start === thisWeekStart && w.status === "locked");
  const mondays = useMemo(() => mondaysInMonth(month), [month]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["nbt-block", month] });

  // A week only counts as written when all three days are there.
  const missing = useMemo(
    () =>
      mondays.filter((m) => {
        const w = weeks.find((x) => x.week_start === m);
        return !w || !DAYS.every((d) => w.days?.[d.key]);
      }).length,
    [mondays, weeks]
  );

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
      toast.success(lock ? `Week ${w.week_in_block} is on the gym board.` : `Week ${w.week_in_block} is off the board for edits.`);
    }
  };

  /**
   * The whole month, one week after another — the weeks are sequential
   * because week 2 has to see week 1. `rebuild` redoes every week; otherwise
   * only the missing ones get written. A week that fails does NOT abandon the
   * rest — it is reported at the end and can be filled in with another click.
   */
  const buildMonth = async (rebuild = false) => {
    setBusy("month");
    setProgress(null);
    const failed: number[] = [];
    try {
      const b = await ensureBlock();
      const built: NbtWeek[] = rebuild ? [] : [...weeks];
      for (let i = 0; i < mondays.length; i++) {
        const weekNo = i + 1;
        const existing = weeks.find((w) => w.week_start === mondays[i]);
        const complete = existing && DAYS.every((d) => existing.days?.[d.key]);
        if (!rebuild && complete) continue;
        setProgress(`Writing week ${weekNo} of ${mondays.length}…`);
        try {
          const savedWeek = await writeWeek(b, weekNo, built.filter((w) => w.week_in_block < weekNo));
          const at = built.findIndex((w) => w.week_start === savedWeek.week_start);
          if (at >= 0) built[at] = savedWeek;
          else built.push(savedWeek);
        } catch {
          failed.push(weekNo);
        }
      }
      refresh();
      if (failed.length === 0) {
        toast.success(`${monthLabel(month)} is written. Lock each week when it's ready for the wall.`);
      } else {
        toast.error(
          `Week${failed.length > 1 ? "s" : ""} ${failed.join(", ")} didn't come back. Click build again to fill them in.`
        );
      }
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't build the month.");
    } finally {
      setBusy(null);
      setProgress(null);
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
        work: blockPart === "lift" ? current.work : { ...current.work, [track]: day.work[track] },
      };
      await saveDay(week, dayKey, merged);
      const what = blockPart === "lift" ? "lift" : blockPart === "work" ? "work" : "track";
      toast.success(`${TRACK_META[track].label}'s ${what} rewritten.`);
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
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      {fromPlan && (
        <button
          type="button"
          onClick={() => navigate("/admin/operations/practice-plan")}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Practice Plan
        </button>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">NBT Workout Plan</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Monday, Tuesday and Thursday for the Non-Battle Team — Bravo and Alpha, one week at a time, each week seeing the last.
          </p>
        </div>
        {/* Green once this week is locked: it's on the wall for everyone. */}
        <Button
          variant="outline"
          onClick={() => navigate("/nbt-board")}
          title={thisWeekLocked ? "Live on the gym board" : "This week is still a draft — lock it to put it on the board"}
          className={thisWeekLocked
            ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white hover:text-white"
            : "bg-transparent border-neutral-700 text-neutral-300 hover:text-white"}
        >
          <Monitor className="w-4 h-4 mr-1.5" /> Open gym board
        </Button>
      </div>

          {/* Month nav + focus */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost" size="icon"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="text-neutral-400 hover:text-white h-8 w-8"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="font-bold">{monthLabel(month)}</p>
                <p className="text-[11px] text-neutral-500">
                  {mondays.length} training weeks
                  {block ? ` · ${mondays.length - missing} written` : " · not started"}
                </p>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="text-neutral-400 hover:text-white h-8 w-8"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div>
              <Label className="text-xs text-neutral-400">This month&apos;s emphasis</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Input
                  value={focus || block?.focus || ""}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="Own the basics · Pace yourself · Quality before weight"
                  className="flex-1 min-w-[220px] bg-neutral-800 border-neutral-700 text-white"
                />
                {missing > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => buildMonth(false)}
                    disabled={busy !== null}
                    className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
                    title="Write every week of the month that isn't written yet, in order"
                  >
                    {busy === "month" ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1.5" />
                    )}
                    {weeks.length > 0 ? `Write the missing ${missing} week${missing > 1 ? "s" : ""}` : "Build the whole month"}
                  </Button>
                )}
                {weeks.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => buildMonth(true)}
                    disabled={busy !== null}
                    className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
                    title="Throw away this month and write it again from scratch"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Start over
                  </Button>
                )}
              </div>
              {progress ? (
                <p className="text-[11px] text-neutral-300 mt-1.5 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> {progress} This takes a minute or two.
                </p>
              ) : (
                <p className="text-[11px] text-neutral-500 mt-1.5">
                  Build a week below. Each week sees the ones before it, so the movements hold across the
                  month and only the challenge changes. Lock a week to put it on the gym board.
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <p className="text-neutral-500 py-10 text-center">Loading…</p>
          ) : (
            <div className="space-y-4">
              {mondays.map((monday, i) => {
                const weekNo = i + 1;
                const w = weeks.find((x) => x.week_start === monday);
                const isThisWeek = monday === thisWeekStart;
                const isLinked = monday === linkedWeek;
                if (!w) {
                  return (
                    <div
                      key={monday}
                      className={`rounded-xl border bg-neutral-900 p-4 flex items-center justify-between gap-4 flex-wrap ${
                        isLinked ? "border-white/30" : "border-neutral-800"
                      }`}
                    >
                      <p className="font-bold">
                        Week {weekNo}
                        <span className="text-neutral-500 font-normal text-sm ml-2">
                          {monday} — {dateOfDay(monday, "thursday")}
                          {isThisWeek ? " · this week" : ""}
                        </span>
                        <span className="block text-sm font-normal text-neutral-500 mt-0.5">Not written yet.</span>
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
                        Build week {weekNo}
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
                  className={`rounded-xl border bg-neutral-900 p-4 ${isLinked ? "border-white/30" : "border-neutral-800"}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <p className="font-bold">
                      Week {w.week_in_block}
                      <span className="text-neutral-500 font-normal text-sm ml-2">
                        {w.week_start} — {dateOfDay(w.week_start, "thursday")}
                        {isThisWeek ? " · this week" : ""}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                          locked
                            ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-300"
                            : "bg-amber-500/15 border-amber-400/30 text-amber-300"
                        }`}
                      >
                        {locked ? "On the gym board" : "Draft"}
                      </span>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => buildWeek(weekNo)}
                        disabled={busy !== null || locked}
                        title={locked ? "Unlock the week to rebuild it" : "Throw this week away and write it again"}
                        className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
                      >
                        {busy === `week-${weekNo}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Rebuild
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => toggleLock(w)}
                        disabled={busy !== null}
                        className={locked ? "bg-neutral-800 text-white hover:bg-neutral-700" : "text-white font-bold"}
                        style={locked ? undefined : { backgroundColor: "#bf0f3e" }}
                      >
                        {locked ? <Unlock className="w-3.5 h-3.5 mr-1.5" /> : <Lock className="w-3.5 h-3.5 mr-1.5" />}
                        {locked ? "Unlock to edit" : "Lock the week"}
                      </Button>
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
                  <div className="grid gap-3 md:grid-cols-3">
                    {DAYS.map((d) => {
                      const day = w.days?.[d.key];
                      const key = `${w.id}-${d.key}`;
                      return (
                        <div key={d.key} className="rounded-lg border border-neutral-800 bg-black/30 p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-neutral-300">
                                {d.label}
                              </p>
                              <p className="text-[11px] text-neutral-500">{d.title}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => day && setEditing({ week: w, dayKey: d.key })}
                                disabled={!day || busy !== null}
                                title="Edit this day by hand"
                                className="text-neutral-500 hover:text-white disabled:opacity-30"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => regenerateDay(w, d.key)}
                                disabled={busy !== null}
                                title="Rewrite the whole day"
                                className="text-neutral-500 hover:text-white"
                              >
                                {busy === key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {!day ? (
                            <p className="text-xs text-neutral-600 italic">Not written</p>
                          ) : (
                            /* The whole session, in the order the kids read it,
                               so the week is reviewed and approved from here. */
                            <div className="space-y-3">
                              {day.focus && <p className="text-sm text-white">{day.focus}</p>}


                              {TRACKS.map((t) => {
                                const m = TRACK_META[t];
                                return (
                                  <div key={t} className="rounded-md border p-2 space-y-1.5" style={{ borderColor: `${m.color}44` }}>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-bold" style={{ color: m.color }}>{m.label}</p>
                                      {/* Rewrite the whole track, just its lift, or just
                                          its work. Whatever isn't asked for is put back. */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {([
                                          ["lift", "Lift"],
                                          ["work", "Work"],
                                          [undefined, "Both"],
                                        ] as const).map(([part, label]) => {
                                          const key = `${w.id}-${d.key}-${t}${part ? `-${part}` : ""}`;
                                          return (
                                            <button
                                              key={label}
                                              onClick={() => regenerateTrack(w, d.key, t, part)}
                                              disabled={busy !== null}
                                              title={part ? `Rewrite only ${m.label}'s ${part}` : `Rewrite all of ${m.label}`}
                                              className="inline-flex items-center gap-1 rounded border border-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500 hover:text-white hover:border-neutral-600 disabled:opacity-40"
                                            >
                                              {busy === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                              {label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <p className="text-xs text-white leading-snug">
                                      <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 mr-1.5">Lift</span>
                                      <span className="font-semibold">{day.lift[t].name}</span>
                                      {day.lift[t].detail && <span className="text-neutral-400"> · {day.lift[t].detail}</span>}
                                    </p>
                                    {(day.work[t] ?? []).length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Work</p>
                                        <ul className="mt-0.5 space-y-0.5">
                                          {readableLines(day.work[t]).map((line, k) =>
                                            line.kind === "rounds" ? (
                                              <li key={k} className="text-[11px] font-bold uppercase tracking-wide" style={{ color: m.color }}>
                                                {line.text}
                                              </li>
                                            ) : (
                                              <li key={k} className="text-xs text-neutral-300 flex items-start gap-1.5">
                                                <span className="w-1 h-1 rounded-full shrink-0 mt-[0.45em]" style={{ backgroundColor: m.color }} />
                                                <span>{line.text}</span>
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Coach-only: what the wall deliberately leaves off. */}
                              <div className="text-[11px] text-neutral-500 space-y-1 pt-1 border-t border-neutral-800">
                                <p>
                                  <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Pattern</span>
                                  {day.lift.pattern || "—"}
                                  {day.work.title ? ` · ${day.work.title}` : ""}
                                  {day.work.emphasis ? ` (${day.work.emphasis})` : ""}
                                </p>
                                <p>
                                  <span className="font-bold uppercase tracking-wide text-[10px] mr-1.5">Minutes</span>
                                  prep {minutesOf(day).prep} · lift {minutesOf(day).lift} · work {minutesOf(day).work} · reset {minutesOf(day).reset} · {totalMinutes(day)} total
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

export default AdminNbtBoard;
