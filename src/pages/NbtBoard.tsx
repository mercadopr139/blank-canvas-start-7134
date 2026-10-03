// Non-Battle Team S&C board — the screen on the gym wall.
//
// Board Mode from the programming rules: read from across the room, no coaching
// prose, two tracks side by side. Bravo is presented exactly as prominently
// as Alpha, because a beginner should never be able to tell they have been
// given "the lesser workout".
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Dumbbell, ChevronLeft, ChevronRight, Maximize, Minimize, Pencil, Check,
} from "lucide-react";
import { NbtEditTonight } from "@/components/nbt/NbtEditTonight";
import { VerseOfTheDayStrip } from "@/components/verse/VerseOfTheDayStrip";
import { todayNY } from "@/lib/programYear";
import TrackTimer from "@/components/nbt/TrackTimer";
import {
  DAYS, DayKey, TRACKS, TRACK_META, NbtDay, NbtWeek, NbtBlock,
  toDateString, mondayOf, firstOfMonth, dateOfDay, todayDayKey, weekInBlock,
  SESSION_CAP_MINUTES, readableLines, NBT_AMBER,
} from "@/lib/nbt";
import { PrepStrip } from "@/components/practice/PrepStrip";
import { equipmentItems } from "@/lib/practicePlan";
import { fetchLiftNote } from "@/lib/liftNote";

const NbtBoard = () => {
  const navigate = useNavigate();
  // Opened from the Gym Board? `?day=tuesday&from=practice` lands on that day and
  // turns the back arrow into "back to the Gym Board", so the two round-trip.
  const [params] = useSearchParams();
  const fromPractice = params.get("from") === "practice";
  const dayParam = params.get("day");
  const linkedDay = DAYS.find((d) => d.key === dayParam)?.key ?? null;
  const linkedWeek = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? params.get("week")! : null;
  // Where to land when going back to the Gym Board: the night it was left on.
  const backToBoard = `/practice-board?${linkedWeek ? `week=${linkedWeek}&` : ""}${params.get("wd") ? `wd=${params.get("wd")}` : ""}`;
  const today = toDateString(new Date());
  const [weekStart, setWeekStart] = useState(() => (linkedWeek ? mondayOf(linkedWeek) : mondayOf(today)));
  // Land on today when today is a training day; otherwise open on Monday.
  const [dayKey, setDayKey] = useState<DayKey>(() => linkedDay ?? todayDayKey(today) ?? "monday");
  // Edit tonight — a signed-in coach fixes the plan where the kids read it.
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["nbt-week", weekStart],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: week } = await supabase
        .from("nbt_weeks" as never)
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();
      const w = (week as unknown as NbtWeek) ?? null;
      if (!w) return { week: null, block: null };
      const { data: block } = await supabase
        .from("nbt_blocks" as never)
        .select("*")
        .eq("id", w.block_id)
        .maybeSingle();
      return { week: w, block: (block as unknown as NbtBlock) ?? null };
    },
  });

  // A draft week is for the coach's eyes: the wall shows it only to a
  // signed-in admin, marked, so the kids never read a plan that isn't ready.
  const { isAdmin } = useAuth();
  const rawWeek = data?.week ?? null;
  const isDraft = !!rawWeek && rawWeek.status !== "locked";
  const week = rawWeek && (!isDraft || isAdmin) ? rawWeek : null;
  const block = data?.block ?? null;
  const day: NbtDay | undefined = week?.days?.[dayKey];
  const meta = DAYS.find((d) => d.key === dayKey)!;

  // The coach's note from the Practice Plan's S&C block for this night.
  const { data: liftNote } = useQuery({
    queryKey: ["lift-note", weekStart, meta.weekday, "non_battle_team"],
    refetchInterval: 60_000,
    queryFn: () => fetchLiftNote(weekStart, meta.weekday, "non_battle_team"),
  });
  const equipment = useMemo(
    () => (day
      ? equipmentItems([
          ...day.prep,
          ...TRACKS.map((t) => day.lift[t]?.name),
          ...TRACKS.flatMap((t) => day.work[t] ?? []),
          ...day.reset,
        ])
      : []),
    [day],
  );
  const date = dateOfDay(weekStart, dayKey);

  // Arrow keys, for whoever is standing at the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = DAYS.findIndex((d) => d.key === dayKey);
      if (e.key === "ArrowRight" && i < DAYS.length - 1) setDayKey(DAYS[i + 1].key);
      if (e.key === "ArrowLeft" && i > 0) setDayKey(DAYS[i - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayKey]);

  /* ───── The wall-TV specs, lifted from the Practice Board ─────
     That board is the one that already reads well on the Newline screen with
     the youth in front of it, so this one follows it exactly: the page never
     scrolls, fullscreen reclaims the browser chrome, and the three tracks
     shrink their text until everything fits the height available. */

  // Fullscreen hides the tabs, the address bar and the Android nav bar.
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

  // Fit the three track tiles to the height available instead of letting them
  // scroll. With the room in front of the board, anything that needs scrolling
  // is invisible. One shared size across all three, because three different
  // text sizes side by side looks broken. Everything inside a tile is sized in
  // em, so one number scales the lift, the clock and the circuit together.
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fitColumns = useCallback(() => {
    const els = colRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    const MAX = 24;
    const MIN = 10;
    const apply = (px: number) => els.forEach((el) => { el.style.fontSize = `${px}px`; });
    // Overflowing by a pixel or two is rounding, not a real overflow.
    // Height AND width: a clock row that runs off the side of the tile is as
    // much a miss as a list that runs off the bottom.
    const fits = () => els.every((el) => el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2);
    let px = MAX;
    apply(px);
    while (px > MIN && !fits()) {
      px -= 1;
      apply(px);
    }
  }, []);

  // Re-fit whenever the content, the day or the window changes. Runs before
  // paint so the board never flashes at the wrong size.
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

  // Entering or leaving fullscreen resizes the board a beat AFTER the event
  // fires, so the re-fit above measures the old height and picks a size that
  // then clips. Measure again once the browser has actually settled.
  useEffect(() => {
    const frame = requestAnimationFrame(fitColumns);
    const timers = [150, 500].map((ms) => setTimeout(fitColumns, ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [isFullscreen, fitColumns]);

  return (
    /* Charcoal with the team's gold cast — the Gym Board is black, so this
       reads as a different place the moment a kid taps in. */
    <div
      className="h-screen overflow-hidden text-white flex flex-col"
      style={{ background: `linear-gradient(180deg, ${NBT_AMBER}14, transparent 40%), #1c1c1e` }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 md:px-8 py-3 border-b flex-wrap"
        style={{ background: `linear-gradient(90deg, ${NBT_AMBER}3d, ${NBT_AMBER}14)`, borderColor: `${NBT_AMBER}66` }}
      >
        {/* Back to the board this screen was opened from, not up to Operations.
            The coach's side has "Open gym board", so the two now round-trip:
            landing on the Operations hub meant finding the NBT board again by
            hand every time. */}
        <Button
          variant="ghost"
          onClick={() => navigate(fromPractice ? backToBoard : "/admin/operations/nbt-board")}
          className="text-white/50 hover:text-white hover:bg-white/5 h-9 px-2 -ml-2"
          aria-label={fromPractice ? "Back to the Practice Plan" : "Back to the NBT S&C Board"}
          title={fromPractice ? "Back to the Practice Plan" : "Back to the NBT S&C Board"}
        >
          <ArrowLeft className="w-5 h-5" />
          {fromPractice && <span className="ml-1 text-sm font-semibold">Practice Plan</span>}
        </Button>
        <Dumbbell className="w-5 h-5" style={{ color: NBT_AMBER }} />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] leading-none mb-0.5" style={{ color: NBT_AMBER }}>
            Workout Plan · NBT
            {isDraft && week && <span className="ml-2 text-amber-300">· Draft · not on the board yet</span>}
            {day?.editedOn === todayNY() && <span className="ml-2 text-white/60">· Changed tonight</span>}
          </p>
          <h1 className="text-lg md:text-xl font-black tracking-tight uppercase text-white">Non-Battle Team</h1>
          <p className="text-[11px] text-white/35">
            {block?.focus ? `${block.focus} · ` : ""}
            Week {week ? weekInBlock(firstOfMonth(weekStart), weekStart) : "—"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekStart((w) => addWeek(w, -1))}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-xs text-white/35 tabular-nums">{weekStart}</span>
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekStart((w) => addWeek(w, 1))}
            className="text-white/30 hover:text-white h-9 w-9"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          {/* Fullscreen — the biggest space win on the wall TV. */}
          <Button
            onClick={toggleFullscreen}
            variant="ghost" size="icon"
            className="ml-1 text-white/40 hover:text-white hover:bg-white/10 h-9 w-9"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
          {isAdmin && week && day && (
            <Button
              variant="outline"
              onClick={() => setEditing((e) => !e)}
              className={
                editing
                  ? "ml-2 bg-white/10 border-white/30 text-white font-bold"
                  : "ml-2 bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:text-white"
              }
            >
              {editing ? <><Check className="w-4 h-4 mr-1.5" /> Done editing</> : <><Pencil className="w-4 h-4 mr-1.5" /> Edit tonight</>}
            </Button>
          )}
        </div>
      </header>

      {/* Day tabs */}
      <div className="flex items-stretch border-b border-white/10">
        {DAYS.map((d) => {
          const on = d.key === dayKey;
          const isToday = dateOfDay(weekStart, d.key) === today;
          return (
            <button
              key={d.key}
              onClick={() => setDayKey(d.key)}
              className={`flex-1 px-3 py-2.5 text-left transition-colors border-r border-white/[0.06] last:border-r-0 ${
                on ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"
              }`}
              style={on ? { boxShadow: `inset 0 -3px 0 ${NBT_AMBER}` } : undefined}
            >
              <p className={`text-sm md:text-base font-black uppercase tracking-wide ${on ? "text-white" : "text-white/35"}`}>
                {d.label}
                {isToday && <span className="ml-2 text-[10px] font-bold text-white/40">TODAY</span>}
              </p>
              <p className={`text-[11px] ${on ? "text-white/50" : "text-white/20"}`}>{d.title}</p>
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
            <p className="text-white/40">Nothing written for {meta.label} yet.</p>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/operations/nbt-board")}
              className="mt-4 bg-transparent border-white/15 text-white/70 hover:text-white"
            >
              Build this month
            </Button>
          </div>
        </div>
      ) : editing && week ? (
        <NbtEditTonight
          key={`${week.id}-${dayKey}`}
          week={week}
          block={block}
          dayKey={dayKey}
          day={day}
          onSaved={() => qc.invalidateQueries({ queryKey: ["nbt-week", weekStart] })}
        />
      ) : (
        /* Fills the screen between the header and the foot, and scrolls INSIDE
           itself only on a phone — on the wall it never page-scrolls. */
        <main className="flex-1 min-h-0 flex flex-col px-4 md:px-6 py-3 gap-3 overflow-y-auto md:overflow-hidden">
          {/* Kids read this from across the room, so the wall carries three
              things only: what to drag out, the lift, the work. The focus
              sentence, the minutes, the cues and the rack reminders stay on
              the coach's plan page. (Josh, 2026-10-03.) */}
          {/* Tuesday has no team meeting, so the verse opens the night here.
              Same verse and the same discussion pop-up as the Gym Board. */}
          {dayKey === "tuesday" && <VerseOfTheDayStrip weekStart={weekStart} weekday={2} />}

          <PrepStrip equipment={equipment} note={liftNote} accent={NBT_AMBER} />

          {/* The two tracks, equal width and equal weight. This row takes
              whatever height is left and the tiles fit themselves to it. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 md:min-h-0">
            {TRACKS.map((t, ti) => {
              const m = TRACK_META[t];
              const lift = day.lift[t];
              const work = day.work[t];
              return (
                <section
                  key={t}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col md:min-h-0"
                >
                  {/* The one place the colour is solid: a kid finds their lane
                      by this bar from across the room. */}
                  <div className="px-4 py-2" style={{ backgroundColor: m.color }}>
                    <h2
                      className="text-xl md:text-2xl font-black uppercase tracking-[0.2em]"
                      style={{ color: "#0a0a0a" }}
                    >
                      {m.label}
                    </h2>
                  </div>

                  {/* Everything below is sized in em against this div, which is
                      the one fitColumns resizes. */}
                  <div
                    ref={(el) => { colRefs.current[ti] = el; }}
                    className="flex-1 min-h-0 overflow-hidden flex flex-col"
                  >
                    {/* The lift: the name is what they read, the dose sits
                        beside it in a chip. */}
                    <div className="px-[0.9em] pt-[0.8em] pb-[0.6em]">
                      <TrackLabel color="#ffffff">Lift</TrackLabel>
                      {/* The name gets the whole width; the dose sits under it
                          and wraps, so a long note from the generator never
                          squeezes "Back Squat / Bench Press" into one word a
                          line or runs off the tile. */}
                      <p className="text-[1.45em] font-bold leading-tight mt-[0.25em]">{lift?.name}</p>
                      {lift?.detail && (
                        <p
                          className="inline-block mt-[0.4em] rounded-lg px-[0.55em] py-[0.25em] text-[0.95em] font-black leading-snug"
                          style={{ backgroundColor: `${m.color}26`, color: m.color }}
                        >
                          {lift.detail}
                        </p>
                      )}
                    </div>

                    {work.length > 0 && (
                      <>
                        <div className="h-px mx-[0.9em] bg-white/10" />
                        <div className="px-[0.9em] pt-[0.6em] pb-[0.8em] flex-1 flex flex-col">
                          <TrackLabel color="#ffffff">Work</TrackLabel>

                          {/* The structure line ("4 rounds — rest 45 sec") reads
                              as a header; every station underneath is one
                              complete line with a dot, so four rows of text
                              never become a wall. */}
                          <ul className="mt-[0.4em] space-y-[0.45em]">
                            {readableLines(work).map((line, i) =>
                              line.kind === "rounds" ? (
                                <li
                                  key={i}
                                  className="text-[0.75em] font-black uppercase tracking-wide"
                                  style={{ color: m.color }}
                                >
                                  {line.text}
                                </li>
                              ) : (
                                <li key={i} className="flex items-start gap-[0.5em]">
                                  <span
                                    className="w-[0.3em] h-[0.3em] rounded-full shrink-0 mt-[0.5em]"
                                    style={{ backgroundColor: m.color }}
                                  />
                                  <span className="text-[1.05em] leading-snug text-white/90">{line.text}</span>
                                </li>
                              )
                            )}
                          </ul>

                          {/* Each track has its own clock, in its own colour,
                              because the tracks do not start together — Alpha
                              is often into the work while Bravo is still on
                              the bar. It counts the WHOLE session, prep to
                              reset — the 40-minute block, always: when it
                              hits zero, you box.
                              (Josh, 2026-10-03.) Under the work, out of the
                              way of the reading. */}
                          <div className="mt-auto pt-[0.6em]">
                            <p className="text-[0.55em] uppercase tracking-[0.18em] font-bold mb-[0.3em] text-white/45">
                              {m.label}&apos;s session · {SESSION_CAP_MINUTES} min
                            </p>
                            <TrackTimer
                              storageKey={`nbt-timer:${weekStart}:${dayKey}:${t}`}
                              minutes={SESSION_CAP_MINUTES}
                              color={m.color}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      )}

    </div>
  );
};

const addWeek = (weekStart: string, n: number) => {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + n * 7);
  return toDateString(d);
};

/** The same, tinted to its track, inside a column — in em, so it scales with the tile. */
const TrackLabel = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <p
    className="text-[0.55em] uppercase tracking-[0.18em] font-bold"
    style={{ color: `${color}73` }}
  >
    {children}
  </p>
);

export default NbtBoard;
