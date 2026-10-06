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
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Timer, X, Users, Megaphone,
  Pencil, Check, Trash2, Plus, Dumbbell, Sparkles, Maximize, Minimize,
  ClipboardCheck,
} from "lucide-react";
import DailyDutiesBoard from "@/components/duties/DailyDutiesBoard";
import JuniorsSessionBoard from "@/components/juniors/JuniorsSessionBoard";
import VerseDiscussion, { DiscussionDay, DiscussionFigure } from "@/components/verse/VerseDiscussion";
import {
  NLA_RED, TOGETHER_GRAY, GROUPS, QUICK_BLOCKS, PracticeGroup, blockAccent, spiritualAccent,
  daysForWeek, mondayOf, dateForWeekday, todayWeekday, addDays, formatWeekRange,
  msUntilStart, countdownParts, formatStartTime,
  PracticeSettings, PracticeWeek, PracticeBlock, SpiritualDay, MeetingPoints,
  SeasonMode,
} from "@/lib/practicePlan";
import { handleIndentKey } from "@/lib/indentTextarea";
import { SplitLanesEditor, SplitLanesView } from "@/components/practice/SplitLanes";
import { isSplitBlock, parseSplit, isJuniorsLane, hasLanes, isBibleStudyBlock, laneDefaults, bibleStudySiblings, isWeightsBlock, wrapupFor } from "@/lib/practicePlan";
import { DAYS as NBT_DAYS } from "@/lib/nbt";

const PracticeBoard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  // Admin-only override to preview another week; null = follow the live week,
  // so the TV keeps auto-rolling to today's week (recomputed every render).
  // Coming back from a Workout Plan: `?week=2026-10-05&wd=1` reopens the
  // board on the week and day it was left on, instead of jumping to today.
  const [params] = useSearchParams();
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week") : null;
  const linkedDay = Number(params.get("wd"));
  const hasLinkedDay = Number.isInteger(linkedDay) && linkedDay >= 1 && linkedDay <= 7;
  const [weekOverride, setWeekOverride] = useState<string | null>(
    () => (linkedWeek && linkedWeek !== mondayOf() ? linkedWeek : null),
  );
  const weekStart = weekOverride ?? mondayOf();
  const isCurrentWeek = weekStart === mondayOf();
  // Open on today. If today isn't one of the week's days (a weekend with no
  // session), the effect below moves to the week's first day once the days
  // are known. A hand-picked day is left alone.
  const defaultWeekday = () => todayWeekday();
  const [weekday, setWeekday] = useState(() => (hasLinkedDay ? linkedDay : defaultWeekday()));
  const userPicked = useRef(hasLinkedDay);
  const shiftWeek = (dir: number) => {
    setWeekOverride(addDays(weekStart, dir * 7));
    userPicked.current = false;
    setWeekday(1);
  };
  const backToThisWeek = () => {
    setWeekOverride(null);
    userPicked.current = false;
    setWeekday(defaultWeekday());
  };
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [dutiesOpen, setDutiesOpen] = useState(false);
  const [juniorsOpen, setJuniorsOpen] = useState(false);
  // Junior Boxers practice on Tuesdays; the Juniors board only shows that day.
  const isTuesdayToday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" }) === "Tuesday";
  const [verseDiscussion, setVerseDiscussion] = useState<DiscussionDay | null>(null);

  // Fullscreen: on the gym TV this hides the browser tabs, address bar and the
  // Android nav bar, which is most of the wasted space up top and down bottom.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };
  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  // Fit the three group columns to the height available instead of letting
  // them scroll. With 80 youth sitting in front of the board, anything that
  // needs scrolling is effectively invisible — the whole night has to be
  // readable at a glance. One shared size across all three columns, because
  // three different text sizes side by side looks broken.
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fitColumns = useCallback(() => {
    const els = colRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    const MAX = 22;
    const MIN = 9;
    const apply = (px: number) =>
      els.forEach((el) => {
        el.style.fontSize = `${px}px`;
      });
    // Overflowing by a pixel or two is rounding, not a real overflow.
    const fits = () => els.every((el) => el.scrollHeight <= el.clientHeight + 2);
    let px = MAX;
    apply(px);
    while (px > MIN && !fits()) {
      px -= 1;
      apply(px);
    }
  }, []);

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

  // A one-off start time for this date — a holiday, an early finish. Absent
  // almost always, in which case the standing 5:15 stands.
  const { data: dayStart } = useQuery({
    queryKey: ["board-day-start", dateForWeekday(weekStart, weekday)],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("practice_day_start_times" as never)
        .select("start_time")
        .eq("practice_date", dateForWeekday(weekStart, weekday))
        .maybeSingle();
      return (data as unknown as { start_time: string } | null) ?? null;
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

  // Themed "Verse of the Week" for the day being shown, when the coach has
  // PUBLISHED one. The board's own query filters to published, so an admin
  // previewing a draft never projects it. No published theme → the classic
  // daily verse above stands in (and an admin sees a nudge to set one).
  const { data: themed } = useQuery({
    queryKey: ["board-verse-week", weekStart, weekday],
    refetchInterval: 60000,
    queryFn: async () => {
      const { data: wk } = await supabase
        .from("board_verse_weeks" as never)
        .select("theme, is_published")
        .eq("week_start", weekStart)
        .maybeSingle();
      const week = (wk as unknown as { theme: string; is_published: boolean } | null) ?? null;
      if (!week?.is_published) return { published: false, theme: null as string | null, day: null as DiscussionDay | null };
      const { data: dayRow } = await supabase
        .from("board_verse_days" as never)
        .select("reference, text, context, figures, questions, answers")
        .eq("week_start", weekStart)
        .eq("weekday", weekday)
        .maybeSingle();
      const d = dayRow as unknown as
        | { reference: string; text: string; context: string | null; figures: DiscussionFigure[]; questions: string[]; answers: string[] }
        | null;
      return {
        published: true,
        theme: (week.theme ?? "").trim() || null,
        day: d
          ? ({ reference: d.reference, text: d.text, context: d.context, figures: d.figures ?? [], questions: d.questions ?? [], answers: d.answers ?? [] } as DiscussionDay)
          : null,
      };
    },
  });

  // This week's S&C workouts, so a weights block can show what to set up
  // without anybody leaving the board.
  // ── Editing from the board ──
  // A coach standing at the TV can change tonight without walking back to a
  // laptop. Only ever offered to a signed-in admin; the board is anonymous for
  // everyone else, and RLS refuses anon writes regardless of what the UI shows.
  const saveDetail = useMutation({
    mutationFn: async ({ id, detail }: { id: string; detail: string | null }) => {
      // A Bible Study box in both team columns is one study: write both.
      const { error } = await supabase
        .from("practice_blocks" as never)
        .update({ detail } as never)
        .in("id", bibleStudySiblings(blocks, id));
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

  const saveDayStart = useMutation({
    mutationFn: async (time: string | null) => {
      const iso = dateForWeekday(weekStart, day.n);
      if (!time) {
        const { error } = await supabase
          .from("practice_day_start_times" as never)
          .delete()
          .eq("practice_date", iso);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("practice_day_start_times" as never)
        .upsert(
          { practice_date: iso, start_time: time } as never,
          { onConflict: "practice_date" } as never
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-day-start"] });
      toast.success("Start time updated for today");
    },
    onError: (e) => toast.error(e.message || "Couldn't set that time."),
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

  /**
   * Move one block up or down within its group's day.
   *
   * Positions are rewritten for the whole column rather than swapping a pair,
   * because stored positions are not guaranteed contiguous — blocks get added,
   * removed and carried over from last week, so gaps and ties are normal. Laying
   * the whole list down as 0..n-1 makes the order true whatever state it was in.
   */
  const moveBlock = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const column = blocks
        .filter((b) => b.weekday === weekday)
        .filter((b) => b.group === blocks.find((x) => x.id === id)?.group)
        .sort((a, b) => a.position - b.position);

      const from = column.findIndex((b) => b.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= column.length) return;

      const reordered = [...column];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

      await Promise.all(
        reordered.map((b, i) =>
          supabase.from("practice_blocks" as never).update({ position: i } as never).eq("id", b.id)
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-blocks", week?.id] }),
    onError: (e: Error) => toast.error(e.message || "Couldn't move that."),
  });

  // The week's own days (Sat/Sun included when the week was started with
  // them); the season's default days until the week's blocks arrive.
  const days = useMemo(() => daysForWeek(blocks, season), [blocks, season]);
  // Land on today when the week has it; otherwise its first day. Never
  // overrides a day someone tapped.
  useEffect(() => {
    if (userPicked.current || days.length === 0) return;
    const t = todayWeekday();
    const preferred = isCurrentWeek && days.some((d) => d.n === t) ? t : days[0].n;
    if (preferred !== weekday) setWeekday(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-evaluate only when the week's days change
  }, [days, isCurrentWeek]);

  const day = days.find((d) => d.n === weekday) ?? days[0];
  const dayDate = new Date(`${dateForWeekday(weekStart, day.n)}T12:00:00`);
  const nbtDayKey = NBT_DAYS.find((d) => d.weekday === day.n)?.key ?? null;

  // Tonight's duties, for the Eat up · Clean up band: how many jobs have
  // someone on them. Assignments are only ever "today", so the count only
  // means something when the board is showing tonight.
  const isTonight = isCurrentWeek && day.n === todayWeekday();
  const { data: dutyProgress } = useQuery({
    queryKey: ["board-duty-progress"],
    enabled: isTonight,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [jobsRes, assignedRes] = await Promise.all([
        supabase.from("duty_jobs" as never).select("id").eq("is_active", true),
        supabase.rpc("get_todays_duty_assignments" as never),
      ]);
      const total = ((jobsRes.data ?? []) as unknown[]).length;
      const done = new Set(
        ((assignedRes.data ?? []) as unknown as { job_id: string }[]).map((r) => r.job_id)
      ).size;
      return { total, done };
    },
  });
  // The Junior Boxers (7–10) aren't one of the three tiles, but on a night a
  // group splits to coach them, that lane IS their session — print it as a
  // strip under the tiles, from the same text, so it can never disagree.
  const juniorLanes = useMemo(
    () => blocks
      .filter((b) => b.weekday === day.n && isSplitBlock(b.category))
      .flatMap((b) => parseSplit(b.detail).filter(isJuniorsLane).map((lane) => ({ lane, group: b.group }))),
    [blocks, day.n],
  );
  // Thursday's Bible study: one block in the plan (Battle Team or Non-Battle
  // Team, whichever carries it), printed once as a strip under the tiles with
  // its boys and girls lanes. The Littles aren't in it — the Verse of the Day
  // up top is theirs — so their column just says to keep going.
  const bibleBlock = useMemo(
    () => blocks.find((b) => b.weekday === day.n && isBibleStudyBlock(b.category)) ?? null,
    [blocks, day.n],
  );
  const bibleLanes = useMemo(
    () => (bibleBlock ? parseSplit(bibleBlock.detail, laneDefaults(bibleBlock.category)) : []),
    [bibleBlock],
  );
  // One study, two rooms: the topic typed on the block wins; otherwise the
  // week's published Bible topic from the banner, so verse and study agree.
  const bibleTopic = bibleLanes[0]?.text.trim() || themed?.theme || "";
  const points = meeting.find((m) => m.weekday === day.n)?.points ?? [];
  // A paused template row keeps its place in the template but must not
  // reach the wall — Juniors Aftercare is not running for a few weeks.
  // This week's own line for the night wins; else the template's, unless paused.
  const sp = wrapupFor(week, day.n, spiritual.find((s) => s.weekday === day.n && s.is_active !== false));
  const weekReminders = reminderRows.find((r) => r.weekday === day.n)?.items ?? [];
  const standingToday = standing
    .filter((r) => r.weekday === day.n)
    .map((r) => r.text);
  const defaultStart = settings?.start_time ?? "17:15:00";
  // The day's own time wins where one is set; otherwise the standing default.
  const startTime = dayStart?.start_time ?? defaultStart;
  const startIsOverridden = !!dayStart?.start_time;
  const meetingLeader = settings?.meeting_leader ?? "";

  const move = (dir: -1 | 1) => {
    const i = days.findIndex((d) => d.n === day.n);
    const next = days[(i + dir + days.length) % days.length];
    userPicked.current = true;
    setWeekday(next.n);
  };

  // Re-fit whenever the content, the day or the window changes. Runs before
  // paint so the board never flashes at the wrong size. Skipped while editing,
  // where the textareas want a stable, comfortable size.
  useLayoutEffect(() => {
    if (editing) {
      colRefs.current.forEach((el) => el && (el.style.fontSize = ""));
      return;
    }
    fitColumns();
    const ro = new ResizeObserver(() => fitColumns());
    colRefs.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", fitColumns);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fitColumns);
    };
  }, [editing, fitColumns, blocks, weekday, week?.id, isFullscreen, countdownOpen]);

  // Entering or leaving fullscreen resizes the board a beat AFTER the event
  // fires, so the re-fit above measures the old screen height and picks a size
  // that then clips — the plan comes back cut off until someone refreshes.
  // Measure again once the browser has actually settled.
  useEffect(() => {
    if (editing) return;
    const frame = requestAnimationFrame(fitColumns);
    const timers = [150, 500].map((ms) => setTimeout(fitColumns, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [isFullscreen, editing, fitColumns]);

  // Arrow keys, for whoever is standing at the TV.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The day and its arrows. With the countdown running the header has four
  // controls on the right and runs out of room on the wall TV, so the day drops
  // down and shares the countdown's line instead of being squeezed.
  const dayDropped = countdownOpen && !!week;
  const dayNav = (
    <div className="flex items-center gap-4">
      <Button
        variant="ghost" size="icon"
        onClick={() => move(-1)}
        className="text-white/30 hover:text-white h-9 w-9"
        aria-label="Previous day"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <div>
        {/* The same small tag the Workout Plans wear, so one spot on every
            screen says which plan this is. */}
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] leading-none mb-1 text-white/45">
          Practice Plan
        </p>
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
  );

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
          {!dayDropped && dayNav}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Fullscreen — the biggest space win on the wall TV. Reclaims the
              browser chrome and the Android nav bar for the plan itself. */}
          <Button
            onClick={toggleFullscreen}
            variant="ghost" size="icon"
            className="text-white/40 hover:text-white hover:bg-white/10 h-9 w-9"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
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
          {/* Juniors practice on Tuesdays: the line-up and the setup checklist, only that day. */}
          {isTuesdayToday && (
            <Button
              onClick={() => setJuniorsOpen(true)}
              className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold"
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Juniors
            </Button>
          )}
          <Button
            onClick={() => setDutiesOpen(true)}
            className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Daily Duties
          </Button>
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

      <DailyDutiesBoard open={dutiesOpen} onClose={() => setDutiesOpen(false)} />
      <JuniorsSessionBoard open={juniorsOpen} onClose={() => setJuniorsOpen(false)} />
      <VerseDiscussion day={verseDiscussion} onClose={() => setVerseDiscussion(null)} />

      {/* Practice starts at 5:15 — except on a holiday. Sits in Edit tonight
          because that is where you are standing when you realise. It is set
          against the DATE, so it can never leak into next week. */}
      {editing && (
        <div className="flex items-center justify-center gap-3 px-6 py-2.5 border-b border-white/10 bg-white/[0.03] flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold">
            {day.long} starts at
          </span>
          {/* A native time input only opens its picker from the small clock
              icon at the right edge, which nobody finds first time. showPicker()
              makes the whole box the target. */}
          <input
            type="time"
            value={startTime.slice(0, 5)}
            onChange={(e) => e.target.value && saveDayStart.mutate(e.target.value)}
            onClick={(e) => {
              try {
                (e.currentTarget as HTMLInputElement & { showPicker?: () => void })
                  .showPicker?.();
              } catch {
                // Older browsers just use the icon — no worse than before.
              }
            }}
            className="cursor-pointer rounded-lg bg-black border border-white/20 px-3 py-1.5 text-base font-bold text-white outline-none focus:border-white/50 hover:border-white/40"
          />
          {startIsOverridden ? (
            <button
              type="button"
              onClick={() => saveDayStart.mutate(null)}
              className="text-xs text-white/45 hover:text-white underline"
            >
              back to {formatStartTime(defaultStart)}
            </button>
          ) : (
            <span className="text-xs text-white/30">the usual time</span>
          )}
        </div>
      )}

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
        /* On the wall this never scrolls: the columns fit themselves to the
           height. While editing the fit is off and the textareas want their
           natural size, so the page has to be allowed to scroll -- otherwise
           a long column is clipped with no way to reach the lower blocks. */
        <main className={`flex-1 min-h-0 flex flex-col px-6 py-3 gap-3 overflow-y-auto ${editing ? "" : "md:overflow-hidden"}`}>
          {/* Logo removed to hand its space to the group tiles. The live
              countdown, when running, sits on its own slim row on the right. */}
          {countdownOpen && (
            <div className="flex items-center justify-between gap-4 shrink-0">
              {dayNav}
              <CountdownBar startTime={startTime} onClose={() => setCountdownOpen(false)} />
            </div>
          )}

          {/* The five minutes that open practice. Always shown — the meeting
              happens every day whether or not anyone wrote points for it. */}
          <section
            className="rounded-2xl border p-2.5 md:p-3 shrink-0"
            style={{
              borderColor: `${TOGETHER_GRAY}55`,
              background: `${TOGETHER_GRAY}12`,
            }}
          >
            {/* Verse of the Day is the flexible (widest) column — verses run
                longer than the notes on either side of it. */}
            {/* First column is wide enough for "Everybody · together" on one
                line — at 11rem the nowrap ran under the divider. */}
            <div className="grid board-banner-grid gap-3 md:gap-5">
              {/* Same shape as the spiritual band under the columns — eyebrow,
                  name, who leads it — because it is the other thing the whole
                  academy does together. */}
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 mt-0.5 shrink-0" style={{ color: TOGETHER_GRAY }} />
                <div>
                  <p
                    className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 whitespace-nowrap"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    Everybody · together
                  </p>
                  {day.n === 2 ? (
                    /* Tuesday is Junior Boxers night — the room is split, so
                       there is no whole-academy meeting. Say so plainly. */
                    <h2
                      className="text-sm md:text-base font-bold leading-tight"
                      style={{ color: TOGETHER_GRAY }}
                    >
                      No team meeting on Tuesdays
                    </h2>
                  ) : (
                    <>
                      <h2
                        className="text-sm md:text-base font-bold leading-tight"
                        style={{ color: TOGETHER_GRAY }}
                      >
                        Team Meeting
                        {/* nowrap so it never breaks into "5" and "min" when the
                            column is narrow */}
                        <span className="ml-2 text-[11px] md:text-xs font-medium opacity-60 whitespace-nowrap">
                          5 min
                        </span>
                      </h2>
                      {meetingLeader && (
                        <p
                          className="text-[11px] md:text-xs font-medium opacity-75"
                          style={{ color: TOGETHER_GRAY }}
                        >
                          with {meetingLeader}
                        </p>
                      )}
                    </>
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
                  <ul className="space-y-2.5">
                    {points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2.5 group/pt">
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                          style={{ backgroundColor: TOGETHER_GRAY }}
                        />
                        <span className="flex-1 text-xs md:text-sm leading-snug text-white/50">
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

              {/* The day's verse. A PUBLISHED themed verse (tappable — opens the
                  team-meeting discussion) wins; else the classic daily verse;
                  and an admin with no theme set sees a quiet nudge to make one.
                  Clean sans, muted, so it never competes with the group tiles. */}
              {(() => {
                const themedDay = themed?.published ? themed.day : null;
                if (themedDay) {
                  return (
                    <button
                      onClick={() => setVerseDiscussion(themedDay)}
                      className="md:border-l md:pl-7 text-left w-full group md:order-last"
                      style={{ borderColor: `${TOGETHER_GRAY}33` }}
                    >
                      <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-2 flex items-center gap-1.5" style={{ color: TOGETHER_GRAY }}>
                        Verse of the day
                        <span className="text-[9px] rounded-full px-1.5 py-0.5 font-semibold" style={{ color: "#2dd4bf", background: "#2dd4bf1a" }}>
                          Tap to discuss
                        </span>
                      </p>
                      <p className="text-sm md:text-base leading-relaxed text-white/60 group-hover:text-white/85 transition-colors">
                        &ldquo;{themedDay.text}&rdquo;
                      </p>
                      <p className="mt-1.5 text-xs font-semibold tracking-wide" style={{ color: TOGETHER_GRAY }}>
                        &mdash; {themedDay.reference}
                      </p>
                    </button>
                  );
                }
                if (isAdmin && !themed?.published) {
                  return (
                    <button
                      onClick={() => navigate("/admin/operations/practice-plan")}
                      className="md:border-l md:pl-7 text-left w-full md:order-last"
                      style={{ borderColor: `${TOGETHER_GRAY}33` }}
                    >
                      <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-2" style={{ color: TOGETHER_GRAY }}>
                        Verse of the day
                      </p>
                      <p className="text-xs md:text-sm text-amber-300/80 leading-snug">
                        No theme set this week — tap to generate this week's Bible topic.
                      </p>
                    </button>
                  );
                }
                if (verse) {
                  return (
                    <div className="md:border-l md:pl-7 md:order-last" style={{ borderColor: `${TOGETHER_GRAY}33` }}>
                      <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 mb-2" style={{ color: TOGETHER_GRAY }}>
                        Verse of the day
                      </p>
                      <p className="text-sm md:text-base leading-relaxed text-white/50">
                        &ldquo;{verse.text}&rdquo;
                      </p>
                      <p className="mt-1.5 text-xs font-semibold tracking-wide" style={{ color: TOGETHER_GRAY }}>
                        &mdash; {verse.reference}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Special Reminders as the fourth column — they belong with the
                  "everybody together" open, and moving them here frees the whole
                  bottom of the board for the group tiles. */}
              <div
                className="md:border-l md:pl-7"
                style={{ borderColor: `${TOGETHER_GRAY}33` }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Megaphone className="w-3.5 h-3.5" style={{ color: TOGETHER_GRAY }} />
                  <p
                    className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] opacity-70"
                    style={{ color: TOGETHER_GRAY }}
                  >
                    Special Reminders
                  </p>
                </div>

                {standingToday.length === 0 && weekReminders.length === 0 ? (
                  <p className="text-white/25 italic text-xs">Nothing special tonight.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {standingToday.map((r) => (
                      <li key={`std-${r}`} className="flex items-start gap-2">
                        <span
                          className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: TOGETHER_GRAY }}
                        />
                        <span className="flex-1 text-xs md:text-sm leading-snug text-white/70">
                          {r}
                        </span>
                        {editing && (
                          <span className="text-[9px] uppercase tracking-wider text-white/25 mt-1 shrink-0">
                            every week
                          </span>
                        )}
                      </li>
                    ))}
                    {weekReminders.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 group/rm">
                        <span
                          className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: TOGETHER_GRAY }}
                        />
                        <span className="flex-1 text-xs md:text-sm leading-snug text-white/70">
                          {r}
                        </span>
                        {editing && (
                          <button
                            type="button"
                            onClick={() =>
                              saveReminders.mutate(weekReminders.filter((_, x) => x !== i))
                            }
                            className="text-white/25 hover:text-red-400 shrink-0 mt-0.5"
                            aria-label="Remove this reminder"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {editing && (
                  <div className="mt-2 flex gap-2">
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
                      className="flex-1 rounded-lg bg-black/60 border border-white/15 px-2 py-1.5 text-xs text-white outline-none focus:border-white/40"
                    />
                    <Button
                      onClick={() => {
                        if (!reminderDraft.trim()) return;
                        saveReminders.mutate([...weekReminders, reminderDraft.trim()]);
                        setReminderDraft("");
                      }}
                      disabled={!reminderDraft.trim()}
                      size="sm"
                      className="font-bold text-black"
                      style={{ backgroundColor: TOGETHER_GRAY }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Junior Boxers strip — above the three tiles, only on a night a
              group is coaching them. Teal so it pops: the night as a timeline,
              practice → 6:00 → home, or aftercare in one of the two labs. */}
          {juniorLanes.map(({ lane, group }, i) => {
            const coachedBy = lane.who.trim() || GROUPS.find((x) => x.key === group)?.label || "";
            const lines = lane.text.split("\n").map((s) => s.trim().replace(/^[-*>•]\s*/, "")).filter(Boolean);
            return (
              <section
                key={i}
                className="shrink-0 rounded-xl border px-4 py-2 flex items-start gap-5"
                style={{ borderColor: "#14b8a6aa", background: "#14b8a61f", boxShadow: "0 0 24px #14b8a622" }}
              >
                <div className="shrink-0 min-w-[11rem]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>
                    Junior Boxers · ages 7–10
                  </p>
                  <p className="text-xs leading-snug" style={{ color: "#99f6e4" }}>coached by {coachedBy}</p>
                </div>
                {/* Three stops a kid can read left to right: practice → home,
                    or aftercare. One accent (teal) for the times and labels,
                    plain white for the words — nothing else competes. */}
                <div className="flex-1 flex items-stretch gap-2 flex-wrap text-sm leading-snug">
                  <div className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>
                      {formatStartTime(startTime)} · Practice
                    </p>
                    {/* Juniors' practice is boxing stations unless the lane says otherwise. */}
                    <p className="text-white/90 truncate">{lines.length ? lines.join(" · ") : "Boxing stations"}</p>
                  </div>
                  <span className="self-center text-white/35 text-lg" aria-hidden="true">→</span>
                  <div className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>6:00</p>
                    <p className="text-white/90">Go home</p>
                  </div>
                  <span className="self-center text-white/40 text-[11px] uppercase tracking-wider">or</span>
                  <div className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>Aftercare</p>
                    <p className="text-white/90">
                      Smile Lab <span className="text-white/40 mx-1">⇄</span> Life Lab
                    </p>
                  </div>
                  <span className="self-center text-white/35 text-lg" aria-hidden="true">→</span>
                  <div className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>Then</p>
                    <p className="text-white/90">Dinner</p>
                  </div>
                </div>
              </section>
            );
          })}

          {/* Three groups, side by side. On the wall they fill the space left
              under the meeting banner and each column scrolls inside itself, so
              the plan is always on screen and never pushes the tiles off. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:flex-1 md:min-h-0 md:grid-rows-1">
            {GROUPS.map((g, gi) => {
              const gb = blocks
                .filter((b) => b.group === g.key && b.weekday === day.n)
                .sort((a, b) => a.position - b.position);
              return (
                <section
                  key={g.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col md:min-h-0"
                >
                  <div
                    className="px-5 py-2.5 border-b shrink-0"
                    style={{ borderColor: `${g.accent}44`, background: `${g.accent}18` }}
                  >
                    <h2
                      className="text-base md:text-lg font-black uppercase tracking-wide leading-tight"
                      style={{ color: g.accent }}
                    >
                      {g.label}
                    </h2>
                    <p className="text-[10px] md:text-[11px] text-white/40 mt-0.5">
                      {g.blurb}
                    </p>
                  </div>
                  <div
                    ref={(el) => {
                      colRefs.current[gi] = el;
                    }}
                    className={`p-4 space-y-4 flex-1 min-h-0 ${editing ? "overflow-y-auto" : "overflow-hidden"}`}
                  >
                    {gb.length === 0 && !editing ? (
                      <p className="text-white/25 italic text-[0.85em]">Nothing scheduled</p>
                    ) : (
                      gb.map((b, bi) => {
                        // Weights day: the workout is one tap away, shown over
                        // the board rather than on another page, so the board is
                        // never navigated away from.
                        //
                        // BATTLE TEAM ONLY. This button opens the Battle Team's
                        // 5×5 barbell session, so it must never appear for
                        // anyone else: the Non-Battle Team has its own board,
                        // and the Littles are ten-year-olds who have no business
                        // being pointed at a barbell programme.
                        //
                        // It used to exclude Non-Battle by name while allowing
                        // everyone else, which meant the Littles column — titled
                        // "Strength" — matched the weights test and offered the
                        // button. Named groups in, not named groups out.
                        // Non-Battle Team gets the same button on the days NBT
                        // trains (Mon / Tue / Thu), opening their S&C instead.
                        const isNbtLift =
                          isWeightsBlock(b.category) && g.key === "non_battle_team" && !!nbtDayKey;
                        const showPrep =
                          (isWeightsBlock(b.category) && g.key === "battle_team") || isNbtLift;
                        // One tap opens that team's full Workout Plan — the
                        // same page the wall shows — with its prep line on top,
                        // and its back arrow returns here. (Josh, 2026-10-02.)
                        // The week and day ride along so the wall opens on
                        // the same night, and "back" lands exactly here.
                        const here = `week=${weekStart}&wd=${day.n}`;
                        const workoutHref = isNbtLift
                          ? `/nbt-board?day=${nbtDayKey}&from=practice&${here}`
                          : `/strength-board?from=practice&${here}${STRENGTH_DAY_KEY[day.n] ? `&day=${STRENGTH_DAY_KEY[day.n]}` : ""}`;
                        const prepButton = (
                          <button
                            type="button"
                            onClick={() => navigate(workoutHref)}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.7em] font-bold transition-colors hover:bg-white/10 shrink-0"
                            style={{ borderColor: `${g.accent}77`, color: g.accent }}
                          >
                            <Dumbbell className="w-4 h-4" />
                            Workout Plan
                          </button>
                        );
                        return (
                        <div key={b.id}>
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className="text-[0.62em] font-bold uppercase tracking-[0.15em] mb-1"
                              style={{ color: blockAccent(b.category, g.accent) }}
                            >
                              {b.category}
                            </p>
                            {editing && (
                              <span className="flex items-center gap-1 shrink-0">
                                {/* Arrows rather than drag: this is a wall-
                                    mounted screen operated with a finger, and
                                    dragging a small target on a touch TV is a
                                    fight. Disabled at the ends so the buttons
                                    tell you where the block already is. */}
                                <button
                                  type="button"
                                  onClick={() => moveBlock.mutate({ id: b.id, dir: -1 })}
                                  disabled={bi === 0 || moveBlock.isPending}
                                  className="text-white/25 hover:text-white disabled:opacity-20 disabled:hover:text-white/25"
                                  aria-label={`Move ${b.category} up`}
                                  title="Move up"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveBlock.mutate({ id: b.id, dir: 1 })}
                                  disabled={bi === gb.length - 1 || moveBlock.isPending}
                                  className="text-white/25 hover:text-white disabled:opacity-20 disabled:hover:text-white/25"
                                  aria-label={`Move ${b.category} down`}
                                  title="Move down"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                              <button
                                type="button"
                                onClick={() => removeBlock.mutate(b.id)}
                                className="text-white/25 hover:text-red-400 shrink-0"
                                aria-label={`Remove ${b.category}`}
                                title="Remove this block"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              </span>
                            )}
                          </div>
                          {hasLanes(b.category) && editing ? (
                            <SplitLanesEditor
                              key={`${b.id}-${b.detail ?? ""}`}
                              detail={b.detail}
                              category={b.category}
                              accent={blockAccent(b.category, g.accent)}
                              dark
                              onSave={(v) => saveDetail.mutate({ id: b.id, detail: v })}
                            />
                          ) : isBibleStudyBlock(b.category) ? (
                            /* The lanes print once, in the strip under the
                               tiles — the tile just holds the slot's place. */
                            <p className="text-[0.85em] leading-snug" style={{ color: "#99f6e4" }}>
                              Boys &amp; Girls separated · see below ↓
                            </p>
                          ) : isSplitBlock(b.category) ? (
                            <SplitLanesView detail={b.detail} accent={g.accent} />
                          ) : editing ? (
                            <textarea
                              key={`${b.id}-${b.detail ?? ""}`}
                              defaultValue={b.detail ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim() || null;
                                if (v !== (b.detail || null))
                                  saveDetail.mutate({ id: b.id, detail: v });
                              }}
                              onKeyDown={handleIndentKey}
                              rows={2}
                              className="w-full rounded-lg bg-black/60 border border-white/15 px-3 py-2 text-lg text-white outline-none focus:border-white/40"
                            />
                          ) : (
                            /* The drills and the Workout Prep button share a
                               line — the button belongs beside "Bench", not
                               stacked under it eating a row of the column. */
                            <div className="flex items-start gap-x-3 gap-y-1 flex-wrap">
                              {b.detail?.trim() ? (
                                /* One bullet per line. A coach types a drill per
                                   line, and from the floor a list of bullets reads
                                   as separate jobs where a wrapped paragraph reads
                                   as one. Sized in em so the fit pass scales it.

                                   Start a line with a dash (or just indent it)
                                   and it nests under the line above — so "If
                                   you're not coming to sparring…" owns the three
                                   drills beneath it instead of reading as a
                                   fourth instruction.

                                   A dash is offered because leading spaces are
                                   invisible in a textarea: a coach cannot see
                                   whether the convention took. */
                                <ul className="text-[1em] leading-snug text-white space-y-0.5">
                                  {b.detail
                                    .split("\n")
                                    .map((raw) => ({
                                      nested: /^([ \t]+|\s*[-*>•])/.test(raw),
                                      // Strip the marker itself — it did its job.
                                      text: raw.trim().replace(/^[-*>•]\s*/, ""),
                                    }))
                                    .filter((l) => l.text)
                                    .map((l, li) => (
                                      <li
                                        key={li}
                                        className="flex items-start gap-[0.5em]"
                                        style={l.nested ? { marginLeft: "1.15em" } : undefined}
                                      >
                                        <span
                                          className="shrink-0 rounded-full mt-[0.55em]"
                                          style={{
                                            width: l.nested ? "0.2em" : "0.3em",
                                            height: l.nested ? "0.2em" : "0.3em",
                                            marginTop: l.nested ? "0.6em" : "0.55em",
                                            backgroundColor: g.accent,
                                            opacity: l.nested ? 0.55 : 1,
                                          }}
                                        />
                                        <span
                                          className="flex-1"
                                          style={l.nested ? { opacity: 0.85 } : undefined}
                                        >
                                          {l.text}
                                        </span>
                                      </li>
                                    ))}
                                </ul>
                              ) : (
                                <p className="text-white/25 italic text-[0.85em]">
                                  Coach&apos;s call
                                </p>
                              )}
                              {showPrep && prepButton}
                            </div>
                          )}

                          {/* While editing the textarea takes the full width, so
                              the button drops beneath it. */}
                          {editing && showPrep && <div className="mt-1.5">{prepButton}</div>}
                        </div>
                        );
                      })
                    )}

                    {/* Bible study is one study for both teams but lives as
                        one block in one column. The other team's tile mirrors
                        the slot so both read the same way; the strip below
                        carries the detail. */}
                    {bibleBlock && bibleBlock.group !== g.key && g.key !== "littles" && (
                      <div>
                        <p
                          className="text-[0.62em] font-bold uppercase tracking-[0.15em] mb-1"
                          style={{ color: blockAccent(bibleBlock.category, g.accent) }}
                        >
                          {bibleBlock.category}
                        </p>
                        <p className="text-[0.85em] leading-snug" style={{ color: "#99f6e4" }}>
                          Boys &amp; Girls separated · see below ↓
                        </p>
                      </div>
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

                  {/* Eat up · Clean up — the close of the night, as one band
                      under all three tiles. The verse is covered up top in the
                      meeting, so the foot of the board is the end: eat, clean,
                      assign the jobs. One tap opens Daily Duties. The Spiritual
                      template still exists; it just no longer draws here. */}
                  <button
                    type="button"
                    onClick={() => setDutiesOpen(true)}
                    className="border-t px-4 py-2 shrink-0 text-left w-full hover:bg-white/[0.05] transition-colors"
                    style={{ borderColor: `${TOGETHER_GRAY}55`, background: `${TOGETHER_GRAY}14` }}
                    title="Open Daily Duties"
                  >
                    <p
                      className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] opacity-70"
                      style={{ color: TOGETHER_GRAY }}
                    >
                      Nightly Wrap Up
                    </p>
                    <p
                      className="text-sm md:text-base font-bold leading-tight flex items-center gap-2"
                      style={{ color: TOGETHER_GRAY }}
                    >
                      {/* The Template's Wrap-up row for this weekday; the
                          default when none is set or the day is paused. */}
                      {sp?.label?.trim() || "Eat up · Clean up"}
                      {sp?.leader?.trim() && (
                        <span className="text-[11px] md:text-xs font-medium opacity-70">with {sp.leader}</span>
                      )}
                      {g.key === "non_battle_team" ? (
                        <span className="text-[11px] md:text-xs font-medium opacity-70">
                          {!isTonight
                            ? "· tap to assign the jobs"
                            : !dutyProgress
                              ? ""
                              : dutyProgress.total > 0 && dutyProgress.done >= dutyProgress.total
                                ? "· all jobs assigned ✓"
                                : `· ${dutyProgress.done} of ${dutyProgress.total} jobs assigned`}
                        </span>
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </p>
                  </button>
                </section>
              );
            })}
          </div>

          {/* Bible study strip — under the tiles, only on a night the plan
              carries one. Teal like the Junior strip: the same three columns
              as the tiles, so the Littles' note sits under the Littles. */}
          {bibleBlock && (
            <section
              className="shrink-0 rounded-xl border px-4 py-2 grid grid-cols-1 md:grid-cols-3 gap-4"
              style={{ borderColor: "#14b8a6aa", background: "#14b8a61f", boxShadow: "0 0 24px #14b8a622" }}
            >
              {/* One study across both teams: the name once, then a single
                  "Boys & Girls · separated" cell with whatever was typed on
                  the block (or the week's published Bible topic). */}
              <div className="md:col-span-2 min-w-0 flex items-start gap-4">
                <div className="shrink-0 min-w-[7.5rem]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>
                    {bibleBlock.category}
                  </p>
                  <p className="text-xs leading-snug" style={{ color: "#99f6e4" }}>Battle Team + Non-Battle Team</p>
                </div>
                <div className="flex-1 min-w-0 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#5eead4" }}>
                    Boys &amp; Girls · separated
                  </p>
                  {bibleTopic && (
                    <p className="text-white/90 text-sm leading-snug">{bibleTopic}</p>
                  )}
                </div>
              </div>
              <div className="min-w-0 rounded-lg border border-white/10 px-3 py-1 self-start">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Littles</p>
                <p className="text-white/60 text-sm leading-snug">Keep going with the plan above</p>
              </div>
            </section>
          )}

        </main>
      )}

      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-center gap-2">
        {days.map((d) => (
          <button
            key={d.n}
            onClick={() => { userPicked.current = true; setWeekday(d.n); }}
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
