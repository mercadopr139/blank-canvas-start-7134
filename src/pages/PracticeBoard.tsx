// The Gym Board — what goes on the TV in the room.
//
// Read-only, no login, big type, readable from across the gym. It opens on
// today by itself so nobody has to touch it, and it only ever shows a
// PUBLISHED week — a half-written plan never reaches the wall.
//
// The five-minute team meeting sits at the top because it is the first thing
// that happens and what everyone is looking at while it happens.
//
// Plan: docs/PRACTICE_PLAN_PLAN.md
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Timer, X, Users, Megaphone,
  Pencil, Check, Trash2, Plus, Dumbbell,
} from "lucide-react";
import {
  NLA_RED, TOGETHER_GRAY, GROUPS, QUICK_BLOCKS, PracticeGroup, blockAccent, spiritualAccent,
  daysFor, mondayOf, dateForWeekday, todayWeekday, addDays, formatWeekRange,
  msUntilStart, countdownParts, formatStartTime, equipmentFor,
  PracticeSettings, PracticeWeek, PracticeBlock, SpiritualDay, MeetingPoints,
  SeasonMode,
} from "@/lib/practicePlan";

const PracticeBoard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  // Admin-only override to preview another week; null = follow the live week,
  // so the TV keeps auto-rolling to today's week (recomputed every render).
  const [weekOverride, setWeekOverride] = useState<string | null>(null);
  const weekStart = weekOverride ?? mondayOf();
  const isCurrentWeek = weekStart === mondayOf();
  // Open on today. Outside the training week (weekend), show Monday.
  const defaultWeekday = () => {
    const t = todayWeekday();
    return t >= 1 && t <= 5 ? t : 1;
  };
  const [weekday, setWeekday] = useState(defaultWeekday);
  const shiftWeek = (dir: number) => {
    setWeekOverride(addDays(weekStart, dir * 7));
    setWeekday(1);
  };
  const backToThisWeek = () => {
    setWeekOverride(null);
    setWeekday(defaultWeekday());
  };
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [pointDraft, setPointDraft] = useState("");
  const [reminderDraft, setReminderDraft] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["board-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_settings" as never)
        .select("season, start_time, meeting_leader")
        .maybeSingle();
      return (data as unknown as PracticeSettings) ?? {
        season: "in_season" as SeasonMode,
        start_time: "17:15:00",
        meeting_leader: "Mercado",
      };
    },
  });
  const season: SeasonMode = settings?.season ?? "in_season";
  const days = useMemo(() => daysFor(season), [season]);

  const { data: week } = useQuery({
    queryKey: ["board-week", weekStart],
    // The board lives on a TV for hours; keep it current without a refresh.
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_weeks" as never)
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();
      return (data as unknown as PracticeWeek) ?? null;
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["board-blocks", week?.id],
    enabled: !!week?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_blocks" as never)
        .select("*")
        .eq("week_id", week!.id)
        .order("position");
      return (data || []) as unknown as PracticeBlock[];
    },
  });

  const { data: meeting = [] } = useQuery({
    queryKey: ["board-meeting", week?.id],
    enabled: !!week?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_meeting_points" as never)
        .select("*")
        .eq("week_id", week!.id);
      return (data || []) as unknown as MeetingPoints[];
    },
  });

  const { data: spiritual = [] } = useQuery({
    queryKey: ["board-spiritual"],
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_spiritual_template" as never)
        .select("*");
      return (data || []) as unknown as SpiritualDay[];
    },
  });

  // Reminders that repeat every week on this weekday — part of the template,
  // so they show whether or not anyone touched this week.
  const { data: standing = [] } = useQuery({
    queryKey: ["board-standing-reminders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_standing_reminders" as never)
        .select("weekday, text")
        .order("position");
      return (data || []) as unknown as { weekday: number; text: string }[];
    },
  });

  // Announcements that stay up all night, distinct from the meeting agenda.
  const { data: reminderRows = [] } = useQuery({
    queryKey: ["board-reminders", week?.id],
    enabled: !!week?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_reminders" as never)
        .select("weekday, items")
        .eq("week_id", week!.id);
      return (data || []) as unknown as { weekday: number; items: string[] }[];
    },
  });

  // "Verse of the Day" = TODAY's verse — the exact same row (and the exact same
  // lookup) the admin Daily Verse shows on the Workbench. Keyed on today's
  // calendar date, NOT the displayed practice day, so the board and the office
  // never disagree no matter which day's plan is on screen. Recomputed each
  // render, so a TV left up overnight rolls to the new day's verse on its own.
  const verseNow = new Date();
  const verseIso = `${verseNow.getFullYear()}-${verseNow.getMonth() + 1}-${verseNow.getDate()}`;
  const { data: verse } = useQuery({
    queryKey: ["board-verse", verseIso],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_verses")
        .select("reference, text")
        .eq("year", verseNow.getFullYear())
        .eq("month", verseNow.getMonth() + 1)
        .eq("day", verseNow.getDate())
        .eq("is_trashed", false)
        .maybeSingle();
      return (data as { reference: string; text: string } | null) ?? null;
    },
  });

  // This week's S&C workouts, so a weights block can show what to set up
  // without anybody leaving the board.
  const { data: strengthWeek } = useQuery({
    queryKey: ["board-strength", weekStart],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("strength_weeks" as never)
        .select("days")
        .eq("week_start", weekStart)
        .maybeSingle();
      return (data as unknown as { days: Record<string, StrengthDay> })?.days ?? {};
    },
  });

  // ── Editing from the board ──
  // A coach standing at the TV can change tonight without walking back to a
  // laptop. Only ever offered to a signed-in admin; the board is anonymous for
  // everyone else, and RLS refuses anon writes regardless of what the UI shows.
  const saveDetail = useMutation({
    mutationFn: async ({ id, detail }: { id: string; detail: string | null }) => {
      const { error } = await supabase
        .from("practice_blocks" as never)
        .update({ detail } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save."),
  });

  const addBlock = useMutation({
    mutationFn: async ({
      group, weekday: wd, category,
    }: { group: PracticeGroup; weekday: number; category: string }) => {
      const existing = blocks.filter((b) => b.group === group && b.weekday === wd);
      const position = existing.reduce((m, b) => Math.max(m, b.position), -1) + 1;
      const { error } = await supabase
        .from("practice_blocks" as never)
        .insert({ week_id: week!.id, group, weekday: wd, position, category } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-blocks", week?.id] });
      toast.success("Added");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add that."),
  });

  // The discussion points belong to the day, not to a group — one row per
  // week per weekday, replaced wholesale.
  const savePoints = useMutation({
    mutationFn: async (next: string[]) => {
      const { error } = await supabase
        .from("practice_meeting_points" as never)
        .upsert(
          { week_id: week!.id, weekday: day.n, points: next } as never,
          { onConflict: "week_id,weekday" } as never
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-meeting", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save that."),
  });

  const saveReminders = useMutation({
    mutationFn: async (items: string[]) => {
      const { error } = await supabase
        .from("practice_reminders" as never)
        .upsert(
          { week_id: week!.id, weekday: day.n, items } as never,
          { onConflict: "week_id,weekday" } as never
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-reminders", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't save that."),
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("practice_blocks" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't remove that."),
  });

  const day = days.find((d) => d.n === weekday) ?? days[0];
  const dayDate = new Date(`${dateForWeekday(weekStart, day.n)}T12:00:00`);
  const points = meeting.find((m) => m.weekday === day.n)?.points ?? [];
  const sp = spiritual.find((s) => s.weekday === day.n);
  const weekReminders = reminderRows.find((r) => r.weekday === day.n)?.items ?? [];
  const standingToday = standing
    .filter((r) => r.weekday === day.n)
    .map((r) => r.text);
  const startTime = settings?.start_time ?? "17:15:00";
  const meetingLeader = settings?.meeting_leader ?? "";

  const move = (dir: -1 | 1) => {
    const i = days.findIndex((d) => d.n === day.n);
    const next = days[(i + dir + days.length) % days.length];
    setWeekday(next.n);
  };

  // Arrow keys, for whoever is standing at the TV.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="h-screen overflow-hidden bg-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-wrap">
        <div className="flex items-center gap-4">
          {/* A way back to the editor. Kept quiet because this page lives on a
              TV in front of the kids, but the board must not be a dead end for
              whoever put it up. The admin side is auth-gated anyway. */}
          <Button
            variant="ghost" size="icon"
            onClick={() => navigate("/admin/operations/practice-plan")}
            className="text-white/25 hover:text-white hover:bg-white/5 h-9 w-9"
            aria-label="Back to the practice plan"
            title="Back to the practice plan"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => move(-1)}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
              {day.long}
            </h1>
            <p className="text-white/40 text-sm">
              {dayDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
              {day.n === todayWeekday() && (
                <span className="ml-2 text-white/70">· Today</span>
              )}
            </p>
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => move(1)}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Only a signed-in admin is offered editing. Everyone else — the
              TV, a kid with the URL — sees a read-only board. */}
          {isAdmin && week && (
            <Button
              variant="outline"
              onClick={() => setEditing((e) => !e)}
              className={
                editing
                  ? "bg-white/10 border-white/30 text-white font-bold"
                  : "bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:text-white"
              }
            >
              {editing ? (
                <><Check className="w-4 h-4 mr-2" /> Done editing</>
              ) : (
                <><Pencil className="w-4 h-4 mr-2" /> Edit tonight</>
              )}
            </Button>
          )}
          <Button
            onClick={() => setCountdownOpen((o) => !o)}
            className={countdownOpen ? "bg-neutral-800 hover:bg-neutral-700 text-white font-bold" : "text-white font-bold"}
            style={countdownOpen ? undefined : { backgroundColor: NLA_RED }}
          >
            <Timer className="w-4 h-4 mr-2" />
            {countdownOpen ? "Hide countdown" : "Start Practice Countdown"}
          </Button>
        </div>
      </header>

      {/* Admin-only week preview — lets you prep on a Sunday and see next week
          on the board before Monday. The public/TV view never renders this, so
          the wall stays locked to the live week and keeps auto-rolling. */}
      {isAdmin && (
        <div className="flex items-center justify-center gap-3 px-6 py-2.5 border-b border-white/10 bg-amber-500/[0.05]">
          <span className="text-[11px] uppercase tracking-[0.15em] text-amber-300/70 font-semibold">
            Admin preview
          </span>
          <button
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
            className="h-7 w-7 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold min-w-[11rem] text-center">
            {formatWeekRange(weekStart, season)}
            {isCurrentWeek && <span className="text-white/40 font-normal"> · This week</span>}
          </span>
          <button
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
            className="h-7 w-7 grid place-items-center rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={backToThisWeek}
              className="ml-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Back to this week
            </button>
          )}
        </div>
      )}

      {!week ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <img
            src={nlaLogoWhite}
            alt="No Limits Academy"
            className="h-28 md:h-40 w-auto opacity-90 drop-shadow-[0_0_60px_rgba(191,15,62,0.18)]"
          />
          <p className="text-white/30 text-xl text-center">
            No plan published for this week yet.
          </p>
        </div>
      ) : (
        /* Fills the screen between the header and the pinned countdown banner,
           and scrolls INSIDE itself only if a plan is unusually long — so the
           board never page-scrolls and the countdown stays in view at the foot. */
        <main className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          {/* The mark opens the board, centered; the live countdown pins to the
              right side of the page when it's running. */}
          <div className="relative flex justify-center">
            <img
              src={nlaLogoWhite}
              alt="No Limits Academy"
              className="h-14 md:h-20 w-auto opacity-90 drop-shadow-[0_0_60px_rgba(191,15,62,0.18)]"
            />
            {countdownOpen && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <CountdownBar startTime={startTime} onClose={() => setCountdownOpen(false)} />
              </div>
            )}
          </div>

          {/* The five minutes that open practice. Always shown — the meeting
              happens every day whether or not anyone wrote points for it. */}
          <section
            className="rounded-2xl border p-5 md:p-6"
            style={{
              borderColor: `${TOGETHER_GRAY}55`,
              background: `${TOGETHER_GRAY}12`,
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,17rem)_1fr_minmax(0,22rem)] gap-5 md:gap-7">
              {/* Same shape as the spiritual band under the columns — eyebrow,
                  name, who leads it — because it is the other thing the whole
                  academy does together. */}
              <div className="flex items-start gap-3">
                <Users className="w-6 h-6 mt-1 shrink-0" style={{ color: TOGETHER_GRAY }} />
                <div>
                  <p
                    className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    Everybody · together
                  </p>
                  <h2
                    className="mt-1 text-lg md:text-xl font-bold leading-tight"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    Team Meeting
                    <span className="ml-2 text-sm md:text-base font-medium opacity-60">
                      5 min
                    </span>
                  </h2>
                  {meetingLeader && (
                    <p
                      className="text-sm md:text-base font-medium opacity-75"
                      style={{ color: TOGETHER_GRAY }}
                    >
                      with {meetingLeader}
                    </p>
                  )}
                </div>
              </div>

              {/* What actually gets said in those five minutes. Its own column
                  and its own heading, because this is the part the room is
                  reading while the meeting runs. */}
              <div className="md:border-l md:pl-8" style={{ borderColor: `${TOGETHER_GRAY}33` }}>
                <p
                  className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-2.5"
                  style={{ color: TOGETHER_GRAY }}
                >
                  Things to Discuss
                </p>

                {points.length === 0 && !editing ? (
                  <p className="text-white/25 italic text-xs">Nothing to cover tonight</p>
                ) : (
                  <ul className="space-y-1.5">
                    {points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 group/pt">
                        <span
                          className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: TOGETHER_GRAY }}
                        />
                        <span className="flex-1 text-[10px] md:text-xs leading-snug text-white">
                          {p}
                        </span>
                        {editing && (
                          <button
                            type="button"
                            onClick={() =>
                              savePoints.mutate(points.filter((_, x) => x !== i))
                            }
                            className="mt-0.5 text-white/25 hover:text-red-400 shrink-0"
                            aria-label="Remove this point"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {editing && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={pointDraft}
                      onChange={(e) => setPointDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && pointDraft.trim()) {
                          savePoints.mutate([...points, pointDraft.trim()]);
                          setPointDraft("");
                        }
                      }}
                      placeholder="No gym tomorrow · Raffle tickets are due…"
                      className="flex-1 rounded-lg bg-black/60 border border-white/15 px-3 py-1.5 text-xs text-white outline-none focus:border-white/40"
                    />
                    <Button
                      onClick={() => {
                        if (!pointDraft.trim()) return;
                        savePoints.mutate([...points, pointDraft.trim()]);
                        setPointDraft("");
                      }}
                      disabled={!pointDraft.trim()}
                      className="font-bold text-black"
                      style={{ backgroundColor: TOGETHER_GRAY }}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                )}
              </div>

              {/* The day's verse fills the space this tile always had spare.
                  Set in serif so it reads as scripture rather than another
                  notice, and quiet enough not to pull attention off the
                  discussion points beside it. */}
              {verse && (
                <div
                  className="md:border-l md:pl-7"
                  style={{ borderColor: `${TOGETHER_GRAY}33` }}
                >
                  <p
                    className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-2"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    Verse of the day
                  </p>
                  <p className="font-serif text-base md:text-lg leading-relaxed text-white/85">
                    {verse.text}
                  </p>
                  <p
                    className="mt-2 text-sm font-bold"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    {verse.reference}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Three groups, side by side */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {GROUPS.map((g) => {
              const gb = blocks
                .filter((b) => b.group === g.key && b.weekday === day.n)
                .sort((a, b) => a.position - b.position);
              return (
                <section
                  key={g.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col"
                >
                  <div
                    className="px-5 py-3 border-b"
                    style={{ borderColor: `${g.accent}44`, background: `${g.accent}18` }}
                  >
                    <h2
                      className="text-xl md:text-2xl font-black uppercase tracking-wide"
                      style={{ color: g.accent }}
                    >
                      {g.label}
                    </h2>
                    <p className="text-[11px] md:text-xs text-white/40 mt-0.5">
                      {g.blurb}
                    </p>
                  </div>
                  <div className="p-5 space-y-5 flex-1">
                    {gb.length === 0 && !editing ? (
                      <p className="text-white/25 italic">Nothing scheduled</p>
                    ) : (
                      gb.map((b) => (
                        <div key={b.id}>
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className="text-xs md:text-sm font-bold uppercase tracking-[0.15em] mb-1.5"
                              style={{ color: blockAccent(b.category, g.accent) }}
                            >
                              {b.category}
                            </p>
                            {editing && (
                              <button
                                type="button"
                                onClick={() => removeBlock.mutate(b.id)}
                                className="text-white/25 hover:text-red-400 shrink-0"
                                aria-label={`Remove ${b.category}`}
                                title="Remove this block"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {editing ? (
                            <textarea
                              key={`${b.id}-${b.detail ?? ""}`}
                              defaultValue={b.detail ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== (b.detail || null))
                                  saveDetail.mutate({ id: b.id, detail: v });
                              }}
                              placeholder="What are we doing?"
                              rows={2}
                              className="w-full rounded-lg bg-black/60 border border-white/15 px-3 py-2 text-lg text-white outline-none focus:border-white/40"
                            />
                          ) : b.detail?.trim() ? (
                            <p className="text-lg md:text-xl leading-snug text-white whitespace-pre-line">
                              {b.detail}
                            </p>
                          ) : (
                            <p className="text-white/25 italic text-base">
                              Coach&apos;s call
                            </p>
                          )}

                          {/* Weights day: the workout is one tap away, shown
                              over the board rather than on another page, so
                              the board is never navigated away from. */}
                          {isWeightsBlock(b.category) && (
                            <button
                              type="button"
                              onClick={() => setWorkoutOpen(true)}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors hover:bg-white/10"
                              style={{ borderColor: `${g.accent}77`, color: g.accent }}
                            >
                              <Dumbbell className="w-4 h-4" />
                              Workout Prep
                            </button>
                          )}
                        </div>
                      ))
                    )}

                    {/* Ad-hoc additions live in this week only — never the
                        template — so "add a run tonight" doesn't become a
                        standing Tuesday run forever. */}
                    {editing && (
                      <AddBlock
                        accent={g.accent}
                        onAdd={(category) =>
                          addBlock.mutate({ group: g.key, weekday: day.n, category })
                        }
                      />
                    )}
                  </div>

                  {/* The same teal footer on all three columns. Because the
                      cards are equal height it reads as one unbroken band
                      running under the whole board — which is the point: this
                      is the one thing every group does together. */}
                  {sp && (
                    <div
                      className="border-t px-5 py-3.5"
                      style={{
                        borderColor: `${spiritualAccent(sp.label)}55`,
                        background: `${spiritualAccent(sp.label)}14`,
                      }}
                    >
                      <p
                        className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70"
                        style={{ color: spiritualAccent(sp.label) }}
                      >
                        Everybody · together
                      </p>
                      <p
                        className="mt-1 text-lg md:text-xl font-bold leading-tight"
                        style={{ color: spiritualAccent(sp.label) }}
                      >
                        {sp.label}
                      </p>
                      {sp.leader && (
                        <p
                          className="text-sm md:text-base font-medium opacity-75"
                          style={{ color: spiritualAccent(sp.label) }}
                        >
                          with {sp.leader}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Special Reminders — announcements that stay up all night.
              Deliberately not the meeting agenda: "Things to Discuss" is what
              gets said in those five minutes, this is what the room should
              keep seeing afterwards. Amber, because it is the one thing on the
              board asking to be noticed. */}
          <section
            className="rounded-2xl border p-4 md:p-5"
            style={{
              borderColor: `${TOGETHER_GRAY}44`,
              background: `${TOGETHER_GRAY}0d`,
            }}
          >
              <div className="flex items-center gap-2 mb-2.5">
                <Megaphone className="w-4 h-4" style={{ color: TOGETHER_GRAY }} />
                <p
                  className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: TOGETHER_GRAY }}
                >
                  Special Reminders
                </p>
              </div>

              {standingToday.length === 0 && weekReminders.length === 0 ? (
                <p className="text-white/25 italic text-sm">
                  Nothing special tonight.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {standingToday.map((r) => (
                    <li key={`std-${r}`} className="flex items-start gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                        style={{ backgroundColor: TOGETHER_GRAY }}
                      />
                      <span className="flex-1 text-base md:text-lg leading-snug text-white">
                        {r}
                      </span>
                      {editing && (
                        <span className="text-[10px] uppercase tracking-wider text-white/25 mt-1.5 shrink-0">
                          every week
                        </span>
                      )}
                    </li>
                  ))}
                  {weekReminders.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 group/rm">
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                        style={{ backgroundColor: TOGETHER_GRAY }}
                      />
                      <span className="flex-1 text-base md:text-lg leading-snug text-white">
                        {r}
                      </span>
                      {editing && (
                        <button
                          type="button"
                          onClick={() =>
                            saveReminders.mutate(
                              weekReminders.filter((_, x) => x !== i)
                            )
                          }
                          className="text-white/25 hover:text-red-400 shrink-0 mt-1"
                          aria-label="Remove this reminder"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {editing && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reminderDraft}
                    onChange={(e) => setReminderDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && reminderDraft.trim()) {
                        saveReminders.mutate([...weekReminders, reminderDraft.trim()]);
                        setReminderDraft("");
                      }
                    }}
                    placeholder="Event Tomorrow — Must Set Up"
                    className="flex-1 rounded-lg bg-black/60 border border-white/15 px-3 py-2 text-base text-white outline-none focus:border-white/40"
                  />
                  <Button
                    onClick={() => {
                      if (!reminderDraft.trim()) return;
                      saveReminders.mutate([...weekReminders, reminderDraft.trim()]);
                      setReminderDraft("");
                    }}
                    disabled={!reminderDraft.trim()}
                    className="font-bold text-black"
                    style={{ backgroundColor: TOGETHER_GRAY }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              )}
          </section>

        </main>
      )}

      {workoutOpen && (
        <WorkoutPrepPanel
          workout={
            (strengthWeek?.[STRENGTH_DAY_KEY[day.n]] as StrengthDay | undefined) ?? null
          }
          dayLabel={day.long}
          onClose={() => setWorkoutOpen(false)}
        />
      )}

      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-center gap-2">
        {days.map((d) => (
          <button
            key={d.n}
            onClick={() => setWeekday(d.n)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              d.n === day.n
                ? "bg-white/15 text-white"
                : "text-white/35 hover:text-white/70"
            }`}
          >
            {d.short}
          </button>
        ))}
      </footer>
    </div>
  );
};

/** The S&C week is keyed by day name; the board works in weekday numbers. */
const STRENGTH_DAY_KEY: Record<number, string> = {
  1: "monday",
  3: "wednesday",
  5: "friday",
};

export interface StrengthDay {
  focus?: string;
  estMinutes?: number;
  warmup?: { name: string; detail: string }[];
  main?: { lift: string; scheme: string; guidance?: string; cues?: string[]; rest?: string };
  accessories?: { name: string; scheme?: string; howTo?: string; scale?: string; rest?: string }[];
  coachNotes?: string;
}

const isWeightsBlock = (category: string) => /weight|strength/i.test(category);

/**
 * Workout Prep — what has to be carried out before the lift starts.
 *
 * Deliberately NOT the workout. The athletes already know the day's lift, and
 * the S&C board has the full session. What they don't know until they look is
 * what tonight's extra work needs dragged out of the racks. So this answers
 * exactly that question and nothing else, and it closes on a tap, leaving the
 * board exactly as it was.
 */
const WorkoutPrepPanel = ({
  workout, dayLabel, onClose,
}: {
  workout: StrengthDay | null;
  dayLabel: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const exercises = [
    workout?.main?.lift ?? "",
    ...(workout?.accessories ?? []).map((a) => a.name),
    ...(workout?.warmup ?? []).map((w) => w.name),
  ].filter(Boolean);
  const needs = equipmentFor(exercises);

  const extras = (workout?.accessories ?? []).map((a) => a.name).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-full overflow-y-auto rounded-2xl border border-white/15 bg-neutral-950 p-6 md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white p-1.5"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-3">
          <Dumbbell className="w-6 h-6" style={{ color: NLA_RED }} />
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
            Workout Prep
          </h2>
        </div>
        <p className="text-white/45 text-sm md:text-base mt-1">
          {dayLabel}
          {workout?.main?.lift ? ` · ${workout.main.lift}` : ""}
        </p>

        {!workout ? (
          <p className="mt-8 text-white/40 text-lg">
            No S&amp;C workout posted for {dayLabel.toLowerCase()} yet — nothing
            to set out.
          </p>
        ) : needs.length === 0 ? (
          <p className="mt-8 text-white/40 text-lg">
            Nothing to carry out tonight — bodyweight only.
          </p>
        ) : (
          <>
            <p className="mt-7 mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/40">
              Set these out
            </p>
            <ul className="space-y-2.5">
              {needs.map((n) => (
                <li
                  key={n.item}
                  className="flex items-baseline gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 translate-y-[-2px]"
                    style={{ backgroundColor: NLA_RED }}
                  />
                  <span className="text-2xl md:text-3xl font-black text-white">
                    {n.item}
                  </span>
                  <span className="text-white/35 text-sm md:text-base ml-auto text-right">
                    {n.forWhat.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>

            {/* The bit that actually changes week to week. */}
            {extras.length > 0 && (
              <p className="mt-5 text-white/45 text-sm md:text-base">
                <span className="font-bold text-white/70">Extra work:</span>{" "}
                {extras.join(" · ")}
              </p>
            )}
          </>
        )}

        <div className="mt-8 flex gap-2 flex-wrap">
          <Button
            onClick={onClose}
            className="text-white font-bold"
            style={{ backgroundColor: NLA_RED }}
          >
            Back to the board
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open("/strength-coach", "_blank")}
            className="bg-transparent border-white/20 text-white/70 hover:bg-white/5 hover:text-white"
          >
            Full workout
          </Button>
        </div>
      </div>
    </div>
  );
};


/**
 * Drop an extra block onto one group's day from the board — "add a run for the
 * Battle Team tonight". Quick picks for the things that actually get added on
 * the night, and a free-text box for anything else.
 *
 * These are week-only. The template is untouched, so tonight's run does not
 * become a standing Monday run forever.
 */
const AddBlock = ({
  accent, onAdd,
}: {
  accent: string;
  onAdd: (category: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 py-2.5 text-sm font-semibold text-white/40 hover:text-white hover:border-white/40 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add a block
      </button>
    );
  }

  const add = (category: string) => {
    const c = category.trim();
    if (!c) return;
    onAdd(c);
    setCustom("");
    setOpen(false);
  };

  return (
    <div className="rounded-lg border border-white/15 bg-black/50 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
          Add a block
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-white/30 hover:text-white"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_BLOCKS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => add(q)}
            className="px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors hover:bg-white/10"
            style={{ borderColor: `${accent}66`, color: accent }}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(custom)}
          placeholder="Something else…"
          className="flex-1 rounded-md bg-black border border-white/15 px-2.5 py-1.5 text-sm text-white outline-none focus:border-white/40"
        />
        <Button
          size="sm"
          onClick={() => add(custom)}
          disabled={!custom.trim()}
          className="h-8 text-white font-semibold"
          style={{ backgroundColor: accent }}
        >
          Add
        </Button>
      </div>
    </div>
  );
};

/**
 * The countdown to practice start, as a compact pill in the header — small and
 * out of the way so the whole plan stays on screen. Turns red in the last
 * minute; auto-hides shortly after practice begins.
 */
const CountdownBar = ({
  startTime, onClose,
}: {
  startTime: string;
  onClose: () => void;
}) => {
  const [ms, setMs] = useState(() => msUntilStart(startTime));

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilStart(startTime)), 250);
    return () => clearInterval(id);
  }, [startTime]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Zero is a moment, not a state: hold "PRACTICE STARTS NOW" briefly, then
  // give the row back on its own.
  const started = ms <= 0;
  const justStarted = started && ms > -6000;
  useEffect(() => {
    if (!justStarted) return;
    const id = setTimeout(onClose, Math.max(0, 6000 + ms));
    return () => clearTimeout(id);
  }, [justStarted, ms, onClose]);

  const lastMinute = !started && ms < 60_000;
  const { lead, secs } = countdownParts(ms);

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-md transition-colors"
      style={{
        borderColor: lastMinute ? NLA_RED : "rgba(52,211,153,0.45)",
        background: lastMinute ? `${NLA_RED}22` : "rgba(52,211,153,0.10)",
        boxShadow: lastMinute ? `0 0 28px ${NLA_RED}66` : "0 0 20px rgba(52,211,153,0.20)",
      }}
      role="timer"
      aria-label="Practice countdown"
    >
      <Timer
        className="w-5 h-5 md:w-6 md:h-6 shrink-0"
        style={{ color: lastMinute ? NLA_RED : "#34d399" }}
      />
      {justStarted ? (
        <span className="text-xl md:text-2xl font-black uppercase tracking-wide animate-pulse" style={{ color: NLA_RED }}>
          Practice starts now
        </span>
      ) : started ? (
        <span className="text-base md:text-lg font-bold text-white/70 whitespace-nowrap">
          Practice underway · {formatStartTime(startTime)}
        </span>
      ) : (
        <div className="flex flex-col leading-none">
          <span className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-white/55 font-bold mb-0.5">
            Practice {formatStartTime(startTime)}
          </span>
          {/* Minutes green, seconds red — two colours so the moving part reads
              distinctly. Everything is red in the last minute. */}
          <span className="text-2xl md:text-3xl font-black tabular-nums leading-none">
            <span style={{ color: lastMinute ? NLA_RED : "#34d399" }}>{lead}</span>
            <span className="text-white/25">:</span>
            <span style={{ color: NLA_RED }}>{secs}</span>
          </span>
        </div>
      )}
    </div>
  );
};

export default PracticeBoard;
