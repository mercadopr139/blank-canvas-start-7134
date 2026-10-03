// Battle Team S&C — the gym screen.
//
// The coach's working page (/strength-coach) generates, revises, locks and
// logs. This is the read-only wall view of the same week, built on the
// Practice Board's wall-TV specs exactly as the NBT board is: the page never
// scrolls, fullscreen reclaims the browser chrome, and the two columns shrink
// their text until everything fits the height available.
//
// One clock, for the session — the Battle Team's whole block is twenty
// minutes, warm-up to finisher. It sits at the foot of the bar, bigger than
// the text around it.
//
// The demo videos are here too, beside each extra-work movement, the same
// ones the coach's page shows. The screen is a touch display, so a kid can
// tap one and the board stays underneath the player.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ClipboardList, Dumbbell, Maximize, Minimize,
} from "lucide-react";
import TrackTimer from "@/components/nbt/TrackTimer";
import ExerciseVideo from "@/components/strength/ExerciseVideo";
import { PrepStrip } from "@/components/practice/PrepStrip";
import { equipmentItems } from "@/lib/practicePlan";
import { fetchLiftNote } from "@/lib/liftNote";
import {
  DAYS, type DayKey, type WeekRow, SESSION_MINUTES, addDays, isoDate, toMonday, prettyRange,
} from "@/lib/strength";

const NLA_RED = "#bf0f3e";
/** The extra work, a lighter rose so the column reads apart from the bar
    while the whole page stays Battle Team red. Amber belongs to NBT. */
const EXTRA = "#fb7185";

const StrengthBoard = () => {
  const navigate = useNavigate();
  // Opened from the Gym Board? `?day=monday&from=practice` lands on that day
  // and turns the back arrow into "back to the Gym Board", so the two round-trip.
  const [params] = useSearchParams();
  const fromPractice = params.get("from") === "practice";
  const linkedDay = DAYS.find((d) => d.key === params.get("day"))?.key ?? null;
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : null;
  // Where to land when going back to the Gym Board: the night it was left on.
  const backToBoard = `/practice-board?${linkedWeek ? `week=${linkedWeek}&` : ""}${params.get("wd") ? `wd=${params.get("wd")}` : ""}`;
  const todayMonday = useMemo(() => toMonday(new Date()), []);
  const [weekMonday, setWeekMonday] = useState<Date>(
    () => (linkedWeek ? toMonday(new Date(`${linkedWeek}T12:00:00`)) : todayMonday),
  );
  const weekStart = isoDate(weekMonday);
  const isCurrentWeek = weekStart === isoDate(todayMonday);

  // Today's lift when we're on this week, else Monday.
  const defaultDay = useMemo<DayKey>(() => {
    if (isCurrentWeek) {
      const hit = DAYS.find((d) => d.weekday === new Date().getDay());
      if (hit) return hit.key;
    }
    return "monday";
  }, [isCurrentWeek]);
  const [dayKey, setDayKey] = useState<DayKey>(linkedDay ?? defaultDay);
  useEffect(() => { setDayKey(linkedDay ?? defaultDay); }, [defaultDay, weekStart, linkedDay]);

  const { data: week, isLoading } = useQuery({
    queryKey: ["strength-week", weekStart],
    queryFn: async (): Promise<WeekRow | null> => {
      const { data, error } = await (supabase.from("strength_weeks" as never) as never as {
        select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown; error: unknown }> } };
      })
        .select("*").eq("week_start", weekStart).maybeSingle();
      if (error) throw error;
      return (data as WeekRow) ?? null;
    },
  });

  const day = week?.days?.[dayKey];
  const meta = DAYS.find((d) => d.key === dayKey)!;

  // The coach's note from the Practice Plan's Strength block for this night.
  const { data: liftNote } = useQuery({
    queryKey: ["lift-note", weekStart, meta.weekday, "battle_team"],
    refetchInterval: 60_000,
    queryFn: () => fetchLiftNote(weekStart, meta.weekday, "battle_team"),
  });
  const equipment = useMemo(
    () => (day
      ? equipmentItems([
          day.main?.lift,
          ...(day.warmup ?? []).map((w) => w.name),
          ...(day.accessories ?? []).flatMap((a) => [a.name, a.equipment]),
          day.finisher?.name,
        ])
      : []),
    [day],
  );

  // Arrow keys, for whoever is standing at the TV.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = DAYS.findIndex((d) => d.key === dayKey);
      if (e.key === "ArrowRight" && i < DAYS.length - 1) setDayKey(DAYS[i + 1].key);
      if (e.key === "ArrowLeft" && i > 0) setDayKey(DAYS[i - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayKey]);

  /* ───── The wall-TV specs, lifted from the Practice Board ───── */

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

  // Fit both columns to the height available instead of letting them scroll.
  // One shared size, because two text sizes side by side looks broken.
  // Everything inside a column is sized in em, so one number scales it all.
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fitColumns = useCallback(() => {
    const els = colRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    const MAX = 24;
    const MIN = 10;
    const apply = (px: number) => els.forEach((el) => { el.style.fontSize = `${px}px`; });
    const fits = () => els.every((el) => el.scrollHeight <= el.clientHeight + 2);
    let px = MAX;
    apply(px);
    while (px > MIN && !fits()) {
      px -= 1;
      apply(px);
    }
  }, []);

  useLayoutEffect(() => {
    fitColumns();
    const ro = new ResizeObserver(() => fitColumns());
    colRefs.current.forEach((el) => el && ro.observe(el));
    window.addEventListener("resize", fitColumns);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fitColumns);
    };
  }, [fitColumns, day, dayKey, weekStart, isFullscreen]);

  // Fullscreen resizes a beat after the event; measure again once settled.
  useEffect(() => {
    const frame = requestAnimationFrame(fitColumns);
    const timers = [150, 500].map((ms) => setTimeout(fitColumns, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [isFullscreen, fitColumns]);

  return (
    /* Charcoal, not black, with the team's colour cast: the Gym Board is
       black, so the moment a kid taps in the whole screen reads "a different
       place". Labelled the same way the Gym Board is. (Josh, 2026-10-02.) */
    <div
      className="h-screen overflow-hidden text-white flex flex-col"
      style={{ background: `linear-gradient(180deg, ${NLA_RED}14, transparent 40%), #1c1c1e` }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-5 md:px-8 py-3 border-b border-white/10 flex-wrap">
        <Button
          variant="ghost"
          onClick={() => navigate(fromPractice ? backToBoard : "/strength-coach")}
          className="text-white/50 hover:text-white hover:bg-white/5 h-9 px-2 -ml-2"
          aria-label={fromPractice ? "Back to the Practice Plan" : "Back to the S&C Coach"}
          title={fromPractice ? "Back to the Practice Plan" : "Back to the S&C Coach"}
        >
          <ArrowLeft className="w-5 h-5" />
          {fromPractice && <span className="ml-1 text-sm font-semibold">Practice Plan</span>}
        </Button>
        <Dumbbell className="w-5 h-5" style={{ color: NLA_RED }} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] leading-none mb-0.5" style={{ color: NLA_RED }}>
            Workout Plan · Battle Team
          </p>
          <h1 className="text-lg md:text-xl font-black tracking-tight uppercase">Battle Team</h1>
          <p className="text-[11px] text-white/35">
            {prettyRange(weekStart)}{isCurrentWeek ? " · this week" : ""}
            {week?.status === "draft" ? " · draft" : ""}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekMonday((w) => addDays(w, -7))}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-xs text-white/35 tabular-nums">{weekStart}</span>
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekMonday((w) => addDays(w, 7))}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <Button
            onClick={toggleFullscreen}
            variant="ghost" size="icon"
            className="ml-1 text-white/40 hover:text-white hover:bg-white/10 h-9 w-9"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
          {/* Logging lives on the coach's page, under the day. */}
          <Button
            onClick={() => navigate("/strength-coach")}
            disabled={!day}
            className="ml-2 font-bold text-white"
            style={{ backgroundColor: NLA_RED }}
          >
            <ClipboardList className="w-4 h-4 mr-1.5" /> Log sets
          </Button>
        </div>
      </header>

      {/* Day tabs */}
      <div className="flex items-stretch border-b border-white/10">
        {DAYS.map((d) => {
          const on = d.key === dayKey;
          const isToday = isCurrentWeek && d.weekday === new Date().getDay();
          return (
            <button
              key={d.key}
              onClick={() => setDayKey(d.key)}
              className={`flex-1 px-3 py-2.5 text-left transition-colors border-r border-white/[0.06] last:border-r-0 ${
                on ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
              }`}
            >
              <p className={`text-sm md:text-base font-black uppercase tracking-wide ${on ? "text-white" : "text-white/35"}`}>
                {d.label}
                {isToday && <span className="ml-2 text-[10px] font-bold text-white/40">TODAY</span>}
              </p>
              <p className={`text-[11px] ${on ? "text-white/50" : "text-white/20"}`}>{d.lift}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-white/30 text-center py-24">Loading…</p>
      ) : !day ? (
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <Dumbbell className="w-10 h-10 mx-auto mb-3 text-white/15" />
            <p className="text-white/40">Nothing built for {meta.label} yet.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/strength-coach")}
              className="mt-4 bg-transparent border-white/15 text-white/70 hover:text-white"
            >
              Build this week
            </Button>
          </div>
        </div>
      ) : (
        /* Fills the screen between the header and the foot, and scrolls INSIDE
           itself only on a phone — on the wall it never page-scrolls. */
        <main className="flex-1 min-h-0 flex flex-col px-4 md:px-6 py-3 gap-3 overflow-y-auto md:overflow-hidden">
          {/* What to drag out first, and the coach's note from the plan. */}
          <PrepStrip equipment={equipment} note={liftNote} accent={NLA_RED} />

          {/* Kids read this from across the room, so the wall carries the
              prep, the bar and the extra work — names and doses. Guidance,
              cues, how-tos and scaling stay on the coach's page. (Josh, 2026-10-03.) */}
          {/* Two columns that take whatever height is left and fit themselves
              to it: the bar on the left, the extra work on the right. */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr] gap-4 flex-1 md:min-h-0">
            {/* ── The bar ── */}
            <section
              className="rounded-2xl border-2 overflow-hidden flex flex-col md:min-h-0"
              style={{ borderColor: `${NLA_RED}55` }}
            >
              <div className="px-4 py-2.5" style={{ backgroundColor: `${NLA_RED}1f` }}>
                <h2 className="text-lg md:text-2xl font-black uppercase tracking-wide" style={{ color: NLA_RED }}>
                  Working sets
                </h2>
              </div>
              <div
                ref={(el) => { colRefs.current[0] = el; }}
                className="flex-1 min-h-0 overflow-hidden flex flex-col"
              >
                {/* The warm-up ramp as one quiet line — it is how the bar gets loaded. */}
                {day.warmup?.length ? (
                  <div className="px-[0.9em] pt-[0.8em]">
                    <ColLabel color={NLA_RED}>Warm-up</ColLabel>
                    <p className="mt-[0.25em] text-[0.85em] leading-snug text-white/70">
                      {day.warmup.map((w) => (w.detail ? `${w.name} — ${w.detail}` : w.name)).join("  ·  ")}
                    </p>
                  </div>
                ) : null}

                {day.main ? (
                  <>
                    <div className="px-[0.9em] pt-[0.7em] flex-1">
                      <ColLabel color={NLA_RED}>
                        Lift{day.main.rest ? ` · rest ${day.main.rest}` : ""}
                      </ColLabel>
                      <div className="flex items-start justify-between gap-[0.6em] mt-[0.3em]">
                        <p className="text-[1.6em] font-bold leading-tight">{day.main.lift}</p>
                        <span
                          className="shrink-0 rounded-lg px-[0.55em] py-[0.2em] text-[1.1em] font-black tabular-nums"
                          style={{ backgroundColor: `${NLA_RED}26`, color: NLA_RED }}
                        >
                          {day.main.scheme}
                        </span>
                      </div>
                    </div>
                  </>
                ) : null}

                {/* The session clock, at the foot of the bar and bigger than
                    the text around it — twenty minutes, warm-up to finisher.
                    Inside the column so it scales with it. */}
                <div className="mt-auto px-[0.8em] pb-[0.8em] text-[1.3em]">
                  <TrackTimer
                    storageKey={`bt-timer:${weekStart}:${dayKey}`}
                    minutes={SESSION_MINUTES}
                    color={NLA_RED}
                  />
                </div>
              </div>
            </section>

            {/* ── The extra work ── */}
            <section
              className="rounded-2xl border-2 overflow-hidden flex flex-col md:min-h-0"
              style={{ borderColor: `${EXTRA}55` }}
            >
              <div className="px-4 py-2.5" style={{ backgroundColor: `${EXTRA}1f` }}>
                <h2 className="text-lg md:text-2xl font-black uppercase tracking-wide" style={{ color: EXTRA }}>
                  Extra work
                </h2>
              </div>
              <div
                ref={(el) => { colRefs.current[1] = el; }}
                className="flex-1 min-h-0 overflow-hidden flex flex-col"
              >
                <div className="p-[0.8em] flex-1">
                  {day.accessories?.length ? (
                    <ul className="space-y-[1.4em]">
                      {day.accessories.map((a, i) => (
                        /* The demo video under each movement's text, centred —
                           the same one the coach's page shows, sized in em so
                           it shrinks with the column. Tap and it plays right
                           there at that size; nothing covers the workout. */
                        <li key={i}>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-[0.6em]">
                              <p className="text-[1.15em] font-bold leading-tight">{a.name}</p>
                              <span
                                className="shrink-0 rounded-lg px-[0.5em] py-[0.15em] text-[0.9em] font-black tabular-nums whitespace-nowrap"
                                style={{ backgroundColor: `${EXTRA}22`, color: EXTRA }}
                              >
                                {a.sets}
                              </span>
                            </div>
                          </div>
                          <div className="mx-auto mt-[0.8em] w-[12em] max-w-full">
                            <ExerciseVideo name={a.name} compact inline />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-white/25 italic text-[0.85em]">No extra work today.</p>
                  )}

                  {day.finisher ? (
                    <div className="mt-[0.9em] pt-[0.7em] border-t" style={{ borderColor: `${EXTRA}33` }}>
                      <ColLabel color={EXTRA}>Finisher</ColLabel>
                      <p className="mt-[0.25em] text-[1em] leading-snug">
                        <span className="font-bold">{day.finisher.name}</span>
                        {day.finisher.detail ? <span className="text-white/70"> — {day.finisher.detail}</span> : null}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

        </main>
      )}
    </div>
  );
};

/** Section heading inside a column — in em, so it scales with the column. */
const ColLabel = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <p className="text-[0.55em] uppercase tracking-[0.18em] font-bold" style={{ color: `${color}cc` }}>
    {children}
  </p>
);

export default StrengthBoard;
