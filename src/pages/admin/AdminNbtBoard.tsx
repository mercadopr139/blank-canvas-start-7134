// NBT S&C Board — the coach's side.
//
// A month is the unit, not a week. The programming rules forbid random weeks:
// primary movements hold across a block while the challenge rises. So this
// builds a whole month at once, feeding each week the earlier weeks of the same
// block, and the coach reviews before any of it reaches the gym screen.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft, ChevronRight, Sparkles, Loader2, Monitor, Users, Dumbbell, RefreshCw, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  DAYS, DayKey, TRACKS, TRACK_META, Track, NbtBlock, NbtWeek, NbtDay, NbtLog,
  toDateString, firstOfMonth, monthLabel, mondaysInMonth, dateOfDay,
} from "@/lib/nbt";
import { priorWeekBriefs, roomReport, carryOver, dayProblem } from "@/lib/nbtCoaching";
import NbtLevels from "@/components/nbt/NbtLevels";
import NbtEditDay from "@/components/nbt/NbtEditDay";

const shiftMonth = (monthStart: string, n: number) => {
  const d = new Date(`${monthStart}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return firstOfMonth(toDateString(d));
};

const AdminNbtBoard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => firstOfMonth(toDateString(new Date())));
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Persistent, unlike a toast — a twelve-call build should say where it is.
  const [progress, setProgress] = useState<string | null>(null);
  const [tab, setTab] = useState<"plan" | "levels">("plan");
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
    only?: { track: Track; keepDay: NbtDay },
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
          dayKey, weekInBlock: weekNo, blockFocus, priorWeeks,
          ...(room ? { room } : {}),
          ...(carry ? { carryOver: carry } : {}),
          ...(only ? { onlyTrack: only.track, keepDay: only.keepDay } : {}),
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
  const buildMonth = async (rebuild = false) => {
    setBusy("month");
    setProgress(null);
    const failed: number[] = [];
    try {
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

      // Weeks already written stay as context for the ones that follow, so
      // continuity holds even when only the back half is being filled in.
      const built: NbtWeek[] = rebuild ? [] : [...weeks];
      const blockFocus = focus.trim() || b.focus || "";

      for (let i = 0; i < mondays.length; i++) {
        const weekNo = i + 1;
        const existing = weeks.find((w) => w.week_start === mondays[i]);
        const complete = existing && DAYS.every((d) => existing.days?.[d.key]);
        if (!rebuild && complete) continue;

        setProgress(`Writing week ${weekNo} of ${mondays.length}…`);
        try {
          // The three days of a week are independent, so they go in parallel;
          // the WEEKS are sequential, because week 2 has to see week 1.
          const [monday, tuesday, thursday] = await Promise.all(
            DAYS.map((d) => generateDay(blockFocus, weekNo, d.key, built))
          );

          const { data: saved, error } = await supabase
            .from("nbt_weeks" as never)
            .upsert(
              {
                block_id: b.id,
                week_start: mondays[i],
                week_in_block: weekNo,
                days: { monday, tuesday, thursday },
              } as never,
              { onConflict: "week_start" } as never
            )
            .select("*")
            .single();
          if (error) throw error;

          const savedWeek = saved as unknown as NbtWeek;
          const at = built.findIndex((w) => w.week_start === savedWeek.week_start);
          if (at >= 0) built[at] = savedWeek;
          else built.push(savedWeek);
        } catch {
          failed.push(weekNo);
        }
      }

      refresh();
      if (failed.length === 0) {
        toast.success(`${monthLabel(month)} is written.`);
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
  const regenerateTrack = async (week: NbtWeek, dayKey: DayKey, track: Track) => {
    const current = week.days?.[dayKey];
    if (!current) return;
    setBusy(`${week.id}-${dayKey}-${track}`);
    try {
      const day = await generateDay(
        block?.focus ?? "",
        week.week_in_block,
        dayKey,
        weeks,
        0,
        { track, keepDay: current }
      );
      // Belt and braces: the other two tracks are restored from what we sent,
      // so a model that ignores the instruction still cannot disturb them.
      const merged: NbtDay = {
        ...current,
        lift: { ...current.lift, [track]: day.lift[track] },
        work: { ...current.work, [track]: day.work[track] },
      };
      await saveDay(week, dayKey, merged);
      toast.success(`${TRACK_META[track].label} rewritten.`);
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">NBT S&amp;C Board</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Monday, Tuesday and Thursday for the Non-Battle Team — three tracks, one month at a time.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/nbt-board")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
        >
          <Monitor className="w-4 h-4 mr-1.5" /> Open gym board
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <TabBtn active={tab === "plan"} onClick={() => setTab("plan")} icon={Dumbbell}>The month</TabBtn>
        <TabBtn active={tab === "levels"} onClick={() => setTab("levels")} icon={Users}>Athlete levels</TabBtn>
      </div>

      {tab === "levels" ? (
        <NbtLevels />
      ) : (
        <>
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
                <Button
                  onClick={() => buildMonth(false)}
                  disabled={busy !== null}
                  className="text-white font-bold"
                  style={{ backgroundColor: TRACK_META.alpha.color }}
                >
                  {busy === "month" ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1.5" />
                  )}
                  {missing > 0 && weeks.length > 0
                    ? `Write the missing ${missing} week${missing > 1 ? "s" : ""}`
                    : "Build the month"}
                </Button>
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
                  Weeks are written in order, each one seeing the last — so the movements hold across the
                  month and only the challenge changes.
                </p>
              )}
            </div>
          </div>

          {isLoading ? (
            <p className="text-neutral-500 py-10 text-center">Loading…</p>
          ) : weeks.length === 0 ? (
            <div className="text-center py-14 text-neutral-600">
              <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Nothing for {monthLabel(month)} yet.</p>
              <p className="text-sm mt-1">Type an emphasis and build it.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weeks.map((w) => (
                <div key={w.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <p className="font-bold mb-3">
                    Week {w.week_in_block}
                    <span className="text-neutral-500 font-normal text-sm ml-2">
                      {w.week_start} — {dateOfDay(w.week_start, "thursday")}
                    </span>
                  </p>
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
                            <div className="space-y-1.5">
                              {day.focus && <p className="text-sm text-white">{day.focus}</p>}
                              <p className="text-[11px] text-neutral-500 uppercase tracking-wide">
                                Strength · {day.lift.pattern}
                              </p>
                              {TRACKS.map((t) => (
                                <p key={t} className="text-xs flex items-start gap-1.5 group/track">
                                  <span style={{ color: TRACK_META[t].color }} className="font-bold shrink-0">
                                    {TRACK_META[t].label}
                                  </span>
                                  <span className="text-neutral-400 flex-1">
                                    {day.lift[t].name} · {day.lift[t].detail}
                                  </span>
                                  {/* Rewrite just this track. The other two are
                                      sent along and put back untouched. */}
                                  <button
                                    onClick={() => regenerateTrack(w, d.key, t)}
                                    disabled={busy !== null}
                                    title={`Rewrite only ${TRACK_META[t].label}`}
                                    className="text-neutral-700 hover:text-white shrink-0 mt-0.5"
                                  >
                                    {busy === `${w.id}-${d.key}-${t}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3" />
                                    )}
                                  </button>
                                </p>
                              ))}
                              {day.work.title && (
                                <p className="text-[11px] text-neutral-500 pt-1">
                                  Conditioning: {day.work.title}
                                  {day.work.emphasis ? ` (${day.work.emphasis})` : ""}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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

const TabBtn = ({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Dumbbell;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`h-9 px-4 rounded-lg text-sm font-semibold border inline-flex items-center gap-1.5 transition-colors ${
      active ? "border-white/30 bg-white/10 text-white" : "border-neutral-800 text-neutral-400 hover:text-white"
    }`}
  >
    <Icon className="w-4 h-4" /> {children}
  </button>
);

export default AdminNbtBoard;
