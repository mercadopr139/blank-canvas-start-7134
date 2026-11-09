// Non-Battle Team S&C board — the screen on the gym wall.
//
// Board Mode from the programming rules: read from across the room, no coaching
// prose. One group since 2026-11-09 (Rev): the warm-up, the one lift everyone
// does with its easier and harder versions, then the Cardio Stations. The
// easier version is the same lift fitted to the athlete, never "the lesser
// workout".
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { levelIndent, levelDot, levelText } from "@/lib/bulletText";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CoachUnlock from "@/components/board/CoachUnlock";
import { useBoardSession } from "@/hooks/useBoardSession";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Dumbbell, ChevronLeft, ChevronRight, Maximize, Minimize, Pencil, Check, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { NbtEditTonight } from "@/components/nbt/NbtEditTonight";
import { VerseOfTheDayStrip } from "@/components/verse/VerseOfTheDayStrip";
import { todayNY } from "@/lib/programYear";
import TrackTimer from "@/components/nbt/TrackTimer";
import StationClock from "@/components/nbt/StationClock";
import {
  DayKey, NbtDay, NbtWeek, NbtBlock, toDateString, mondayOf, firstOfMonth, dateOfDay, todayDayKey, weekInBlock, SESSION_CAP_MINUTES, readableLines, NBT_AMBER, WEEKDAY_KEYS, DAY_LABELS, dayMeta, weekDays, liftOf, workLines,
} from "@/lib/nbt";
import { PrepStrip } from "@/components/practice/PrepStrip";
import { equipmentItems } from "@/lib/practicePlan";
import { fetchLiftNote } from "@/lib/liftNote";
import ExercisePictures from "@/components/strength/ExercisePictures";
import StationPictures from "@/components/strength/StationPictures";
import { stationPictures } from "@/lib/nbtStations";
import { stationLines } from "@/lib/nbt";

const NbtBoard = () => {
  const navigate = useNavigate();
  // Opened from the Gym Board? `?day=tuesday&from=practice` lands on that day and
  // turns the back arrow into "back to the Gym Board", so the two round-trip.
  const [params] = useSearchParams();
  const fromPractice = params.get("from") === "practice";
  // Opened from the Practice Plan's NBT tab: the back arrow goes home there, same week.
  const fromPlan = params.get("from") === "plan";
  const dayParam = params.get("day");
  const linkedDay = (Object.values(WEEKDAY_KEYS) as string[]).includes(dayParam ?? "") ? (dayParam as DayKey) : null;
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
  const { isAdmin, lock, isBoardSession } = useBoardSession();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const rawWeek = data?.week ?? null;
  const isDraft = !!rawWeek && rawWeek.status !== "locked";
  const week = rawWeek && (!isDraft || isAdmin) ? rawWeek : null;
  const block = data?.block ?? null;
  const day: NbtDay | undefined = week?.days?.[dayKey];
  const meta = dayMeta(dayKey);
  // The programme's days plus any night a workout was moved onto.
  const tabs = useMemo(() => weekDays(week?.days, week?.nights), [week]);
  // Where this day's workout went, if a coach pushed it to another night.
  const movedTo = (Object.keys(week?.days ?? {}) as DayKey[]).find((k) => week?.days?.[k]?.movedFrom === dayKey) ?? null;
  // Land on today's workout wherever it sits — a coach may have pushed it a
  // night — once the week arrives and nothing linked us to a day.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || linkedDay || !week) return;
    landed.current = true;
    const dow = new Date(`${today}T12:00:00`).getDay();
    const k = WEEKDAY_KEYS[dow];
    if (k && mondayOf(today) === weekStart && week.days?.[k]) setDayKey(k);
  }, [week, linkedDay, today, weekStart]);

  // Tonight only (Josh, 2026-10-22): a signed-in coach hides a station, or the
  // whole Cardio Stations card, right on the wall. Nothing is deleted.
  const saveWork = async (work: Partial<NbtDay["work"]>) => {
    if (!week || !day) return;
    const next: NbtDay = { ...day, work: { ...day.work, ...work } };
    qc.setQueryData(["nbt-week", weekStart], (old: { week: NbtWeek | null } | undefined) =>
      old?.week ? { ...old, week: { ...old.week, days: { ...old.week.days, [dayKey]: next } } } : old);
    const { error } = await supabase
      .from("nbt_weeks" as never)
      .update({ days: { ...week.days, [dayKey]: next } } as never)
      .eq("id", week.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["nbt-week", weekStart] });
  };
  const toggleStation = (index: number) => {
    if (!day) return;
    const hidden = new Set(day.work.hiddenStations ?? []);
    if (hidden.has(index)) hidden.delete(index); else hidden.add(index);
    saveWork({ hiddenStations: [...hidden].sort((a, b) => a - b) });
  };

  // The coach's note from the Practice Plan's S&C block for this night.
  const { data: liftNote } = useQuery({
    queryKey: ["lift-note", weekStart, meta.weekday, "non_battle_team"],
    refetchInterval: 60_000,
    queryFn: () => fetchLiftNote(weekStart, meta.weekday, "non_battle_team"),
  });
  // The one lift, as everyone reads it: the dose in a chip, the run-it cue under it.
  const lift = liftOf(day);
  const [dose, ...cue] = lift.detail.split(" — ");
  const hasStations = !!day && stationLines(day).length > 0;
  // A week written before the stations keeps its circuit.
  const oldCircuit = day && !hasStations ? workLines(day) : [];
  const equipment = useMemo(
    () => (day
      ? equipmentItems([
          ...day.prep,
          liftOf(day).name,
          liftOf(day).easier,
          // The stations, or an older week's circuit.
          ...workLines(day),
          ...day.reset,
        ])
      : []),
    [day],
  );
  const date = dateOfDay(weekStart, dayKey);

  // Arrow keys, for whoever is standing at the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = tabs.findIndex((d) => d.key === dayKey);
      if (e.key === "ArrowRight" && i < tabs.length - 1) setDayKey(tabs[i + 1].key);
      if (e.key === "ArrowLeft" && i > 0) setDayKey(tabs[i - 1].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayKey, tabs]);

  /* ───── The wall-TV specs, lifted from the Practice Board ─────
     That board is the one that already reads well on the Newline screen with
     the youth in front of it, so this one follows it exactly: the page never
     scrolls, fullscreen reclaims the browser chrome, and the board
     shrinks its text until everything fits the height available. */

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

  // Fit the board to the height available instead of letting it scroll. With
  // the room in front of the board, anything that needs scrolling is
  // invisible. Everything inside is sized in em, so one number scales the
  // warm-up, the lift, the clock and the stations together.
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fitColumns = useCallback(() => {
    const els = colRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!els.length) return;
    const MAX = Math.max(24, ...els.map((el) => Number(el.dataset.maxPx) || 0));
    const MIN = 10;
    const apply = (px: number) => els.forEach((el) => { el.style.fontSize = `${px}px`; });
    // Overflowing by a pixel or two is rounding, not a real overflow.
    // Height AND width: a clock row that runs off the side of the tile is as
    // much a miss as a list that runs off the bottom.
    // Any part marked data-fit must hold its own text too — a station tile
    // whose words run out of the tile into the clock is a miss the outer
    // box alone would not see (Josh, 2026-10-20).
    const fits = () => els.every((el) =>
      el.scrollHeight <= el.clientHeight + 2 && el.scrollWidth <= el.clientWidth + 2 &&
      Array.from(el.querySelectorAll<HTMLElement>("[data-fit]")).every((c) => c.scrollHeight <= c.clientHeight + 2 && c.scrollWidth <= c.clientWidth + 2));
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
          onClick={() => navigate(fromPractice ? backToBoard : fromPlan ? `/admin/operations/practice-plan?week=${weekStart}&tab=nbt` : "/admin/operations/nbt-board")}
          className="text-white/70 hover:text-white hover:bg-white/10 h-9 px-2 -ml-2"
          aria-label={fromPractice ? "Back to the Gym Board" : "Back to the Practice Plan"}
          title={fromPractice ? "Back to the Gym Board" : "Back to the Practice Plan"}
        >
          <ArrowLeft className="w-5 h-5" />
          {(fromPractice || fromPlan) && <span className="ml-1 text-sm font-semibold">{fromPractice ? "Gym Board" : "Practice Plan"}</span>}
        </Button>
        <Dumbbell className="w-7 h-7" style={{ color: NBT_AMBER }} />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] leading-none mb-0.5" style={{ color: NBT_AMBER }}>
            Workout Plan · NBT
            {isDraft && week && <span className="ml-2 text-amber-200">· Draft · not on the board yet</span>}
            {day?.editedOn === todayNY() && <span className="ml-2 text-white/60">· Changed tonight</span>}
          </p>
          <h1 className="text-lg md:text-xl font-black tracking-tight uppercase text-white">Non-Battle Team</h1>
          <p className="text-[11px] text-white/50">
            {block?.focus ? `${block.focus} · ` : ""}
            Week {week ? weekInBlock(firstOfMonth(weekStart), weekStart) : "—"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekStart((w) => addWeek(w, -1))}
            className="text-white/50 hover:text-white h-9 w-9"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-xs text-white/60 tabular-nums font-semibold">{weekStart}</span>
          <Button
            variant="ghost" size="icon"
            onClick={() => setWeekStart((w) => addWeek(w, 1))}
            className="text-white/50 hover:text-white h-9 w-9"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          {/* Fullscreen — the biggest space win on the wall TV. */}
          <Button
            onClick={toggleFullscreen}
            variant="ghost" size="icon"
            className="ml-1 text-white/60 hover:text-white hover:bg-white/10 h-9 w-9"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
          {!isAdmin && week && day && (
            <Button variant="outline" onClick={() => setUnlockOpen(true)} className="ml-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-semibold">
              <Pencil className="w-4 h-4 mr-1.5" /> Edit tonight
            </Button>
          )}
          <CoachUnlock open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlocked={() => setEditing(true)} what="edit tonight's workout" />
          {isAdmin && week && day && (
            <Button
              variant="outline"
              onClick={() => { if (editing && isBoardSession) { setEditing(false); lock(); } else setEditing((e) => !e); }}
              className={
                editing
                  ? "ml-2 bg-white text-black border-white font-bold hover:bg-white/90 hover:text-black"
                  : "ml-2 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white font-semibold"
              }
            >
              {editing ? <><Check className="w-4 h-4 mr-1.5" /> Done editing</> : <><Pencil className="w-4 h-4 mr-1.5" /> Edit tonight</>}
            </Button>
          )}
        </div>
      </header>

      {/* Day tabs — the programme's three, plus any night a workout was moved onto. */}
      <div className="flex items-stretch border-b border-white/10 bg-black">
        {tabs.map((d) => {
          const on = d.key === dayKey;
          const isToday = dateOfDay(weekStart, d.key) === today;
          return (
            <button
              key={d.key}
              onClick={() => setDayKey(d.key)}
              className={`flex-1 px-3 py-2.5 text-left transition-colors border-r border-white/[0.06] last:border-r-0 ${
                on ? "bg-black" : "bg-black hover:bg-white/[0.03]"
              }`}
              style={on ? { boxShadow: `inset 0 -3px 0 ${NBT_AMBER}` } : undefined}
            >
              <p className={`text-sm md:text-base font-black uppercase tracking-wide ${on ? "text-white" : "text-white/35"}`}>
                {d.label}
                {isToday && <span className="ml-2 text-[10px] font-bold text-white/40">TODAY</span>}
              </p>
              <p className={`text-[11px] ${on ? "text-white/50" : "text-white/20"}`}>
                {week?.days?.[d.key]?.movedFrom
                  ? `${dayMeta(week.days[d.key]!.movedFrom!).title} · moved from ${DAY_LABELS[week.days[d.key]!.movedFrom!]}`
                  : d.title}
              </p>
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
            <p className="text-white/40">
              {movedTo ? `${meta.label}'s workout was moved to ${DAY_LABELS[movedTo]}.` : `Nothing written for ${meta.label} yet.`}
            </p>
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
          {/* Kids read this from across the room, so the wall carries only what
              they act on: what to drag out, the warm-up, the lift, the work.
              The focus sentence, the cues and the rack reminders stay on the
              coach's plan page. (Josh, 2026-10-03; the warm-up, 2026-11-09.) */}
          {/* Tuesday has no team meeting, so the verse opens the night here.
              Same verse and the same discussion pop-up as the Gym Board. */}
          {dayKey === "tuesday" && <VerseOfTheDayStrip weekStart={weekStart} weekday={2} />}

          <PrepStrip equipment={equipment} note={liftNote} accent={NBT_AMBER} />

          {/* ONE group since 2026-11-09 (Rev): the warm-up for the lift, the one
              lift everyone does with its easier and harder versions, then the
              Cardio Stations. Built like the Gym Board: ONE container, every
              size in em, and fitColumns sets its font-size so it fills the
              screen exactly, on the Newline or a laptop. Nothing scrolls,
              nothing clips. */}
          <div
            ref={(el) => { colRefs.current[0] = el; }}
            data-max-px="44"
            className="flex-1 min-h-0 overflow-hidden flex flex-col gap-[0.75em]"
          >
              {/* The lift, hidden for tonight: the kids see nothing; a signed-in coach gets the way back. */}
              {day.work.liftHidden ? (
                isAdmin ? (
                  <div className="shrink-0 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveWork({ liftHidden: false })}
                    className="inline-flex items-center gap-[0.3em] rounded-[0.4em] border border-white/20 px-[0.7em] py-[0.25em] text-[0.45em] font-bold uppercase tracking-wide text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <Eye className="w-[1.2em] h-[1.2em]" /> Unhide Lift Section
                  </button>
                  </div>
                ) : null
              ) : (<>
              {/* The warm-up and the lift: two cards, one row. */}
              <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-[0.5em]">
                <section className="rounded-[0.8em] border border-white/15 bg-[#141416] overflow-hidden shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]">
                  <div className="px-[0.9em] py-[0.4em] border-b" style={{ background: "#3c3527", borderColor: `${NBT_AMBER}66` }}>
                    <h2 className="text-[0.85em] font-black uppercase tracking-wide leading-tight text-white">
                      Warm-up <span className="text-white/40 text-[0.6em] tracking-normal font-bold">· {day.minutes?.prep ?? 5} min · everyone</span>
                    </h2>
                  </div>
                  <ul className="px-[0.9em] pt-[0.45em] pb-[0.6em] space-y-[0.15em]">
                    {day.prep.map((line, k) => (
                      <li key={k} className="flex items-start gap-[0.4em]">
                        <span className="shrink-0 rounded-full mt-[0.5em]" style={{ width: "0.3em", height: "0.3em", backgroundColor: NBT_AMBER }} />
                        <span className="text-[0.75em] leading-snug text-white">{line}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-[0.8em] border border-white/15 bg-[#141416] overflow-hidden shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]">
                  <div className="px-[0.9em] py-[0.4em] border-b" style={{ background: "#3c3527", borderColor: `${NBT_AMBER}66` }}>
                    <h2 className="text-[0.85em] font-black uppercase tracking-wide leading-tight text-white">
                      Lift <span className="text-white/40 text-[0.6em] tracking-normal font-bold">· everyone</span>
                    </h2>
                  </div>
                  <div className="px-[0.9em] pt-[0.45em] pb-[0.6em]">
                    {/* The name is what they read; the dose sits beside it in a chip and the run-it cue in grey under it. */}
                    <div className="flex items-baseline gap-[0.6em] flex-wrap">
                      <p className="text-[1.35em] font-bold leading-tight" style={{ color: NBT_AMBER }}>{lift.name}</p>
                      {dose && (
                        <p className="rounded-[0.35em] px-[0.5em] py-[0.1em] text-[0.85em] font-black leading-snug" style={{ backgroundColor: `${NBT_AMBER}26`, color: NBT_AMBER }}>{dose}</p>
                      )}
                      {lift.name && <ExercisePictures name={lift.name} color={NBT_AMBER} compact />}
                    </div>
                    {cue.length > 0 && <p className="mt-[0.3em] text-[0.65em] text-white/65 leading-snug">{cue.join(" — ")}</p>}
                    {/* The modification: the same lift, fitted to the athlete. The coach says who takes which. */}
                    {(lift.easier || lift.harder) && (
                      <dl className="mt-[0.4em] pt-[0.35em] border-t border-white/10 space-y-[0.15em]">
                        {([["Easier", lift.easier], ["Harder", lift.harder]] as const).filter(([, text]) => text).map(([label, text]) => (
                          <div key={label} className="flex items-baseline gap-[0.6em]">
                            <dt className="shrink-0 w-[4.6em] text-[0.5em] font-bold uppercase tracking-[0.18em]" style={{ color: `${NBT_AMBER}b3` }}>{label}</dt>
                            <dd className="text-[0.7em] leading-snug text-white/85">{text}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </section>
              </div>

              {/* One clock for the lift, under the cards. */}
              {hasStations && (
              <div className="shrink-0 text-[0.8em]">
                <StationClock
                  storageKey={`nbt-lift:${weekStart}:${dayKey}`}
                  stations={1}
                  seconds={(day.minutes?.lift ?? 15) * 60}
                  words={{ title: `Lift · ${day.minutes?.lift ?? 15} min · everyone`, idle: "Tap Start after the warm-up.", running: "On the bar. Groups rotate.", rang: "Time — rack it. Stations next.", done: "Lift done" }}
                  color={NBT_AMBER}
                />
                {/* Coach only: the lift off the wall for tonight, once it's done. */}
                {isAdmin && (
                  <div className="mt-[0.4em] flex justify-end text-[1.25em]">
                  <button
                    type="button"
                    onClick={() => saveWork({ liftHidden: true })}
                    className="inline-flex items-center gap-[0.3em] rounded-[0.4em] border border-white/20 px-[0.7em] py-[0.25em] text-[0.45em] font-bold uppercase tracking-wide text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <EyeOff className="w-[1.2em] h-[1.2em]" /> Hide Lift Section
                  </button>
                  </div>
                )}
              </div>
              )}
              </>)}

              {/* A week written before the stations: its circuit as one list, and the
                  session clock — prep to reset, the 40-minute block: when it hits zero, you box. */}
              {!hasStations && oldCircuit.length > 0 && (
                <section className="rounded-[0.8em] border border-white/15 bg-[#141416] overflow-hidden flex-1 min-h-0 flex flex-col shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]">
                  <div className="px-[0.9em] py-[0.4em] border-b shrink-0" style={{ background: "#3c3527", borderColor: `${NBT_AMBER}66` }}>
                    <h2 className="text-[0.85em] font-black uppercase tracking-wide leading-tight text-white">
                      Cardio <span className="text-white/40 text-[0.6em] tracking-normal font-bold">· everyone</span>
                    </h2>
                  </div>
                  <div className="px-[0.9em] pt-[0.5em] pb-[0.6em] flex-1 min-h-0 flex flex-col">
                    <ul className="space-y-[0.3em]">
                      {readableLines(oldCircuit).map((line, i) =>
                        line.kind === "rounds" ? (
                          <li key={i} className="text-[0.65em] font-black uppercase tracking-wide" style={{ color: NBT_AMBER }}>{line.text}</li>
                        ) : (
                          <li key={i} className="flex items-start gap-[0.5em]" style={{ marginLeft: levelIndent(line.level) }}>
                            <span
                              className="rounded-full shrink-0"
                              style={{
                                width: levelDot(line.level, 0.3).size,
                                height: levelDot(line.level, 0.3).size,
                                marginTop: line.level ? "0.55em" : "0.5em",
                                backgroundColor: NBT_AMBER,
                                opacity: levelDot(line.level, 0.3).opacity,
                              }}
                            />
                            <span className="text-[0.8em] leading-snug" style={{ ...levelText(line.level), fontWeight: 400, color: line.level ? levelText(line.level).color : "rgba(255,255,255,0.88)" }}>{line.text}</span>
                          </li>
                        )
                      )}
                    </ul>
                    <div className="mt-auto pt-[0.6em] text-[0.8em]">
                      <p className="text-[0.55em] uppercase tracking-[0.18em] font-bold mb-[0.3em] text-white/45">
                        The session · {SESSION_CAP_MINUTES} min
                      </p>
                      <TrackTimer
                        storageKey={`nbt-timer:${weekStart}:${dayKey}`}
                        minutes={SESSION_CAP_MINUTES}
                        color={NBT_AMBER}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Cardio Stations: the band takes what is left. */}
              {!hasStations ? null : day.work.stationsHidden ? (
                // Off the wall tonight. The kids see nothing; a signed-in coach gets the way back.
                isAdmin ? (
                  <div className="shrink-0 flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveWork({ stationsHidden: false })}
                      className="shrink-0 inline-flex items-center gap-[0.3em] rounded-[0.4em] border border-white/20 px-[0.7em] py-[0.25em] text-[0.45em] font-bold uppercase tracking-wide text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <Eye className="w-[1.2em] h-[1.2em]" /> Unhide Cardio Station Section
                    </button>
                  </div>
                ) : null
              ) : (() => {
                // A station hidden for tonight is off the wall, and the clock counts only the ones
                // showing. A signed-in coach still sees it, dimmed, with Show under it.
                const hidden = new Set(day.work.hiddenStations ?? []);
                const all = stationLines(day);
                const lines = all.filter((_, i) => i === 0 || !hidden.has(i));
                const header = lines[0] ?? "5 stations · 2 min each · rotate on the whistle";
                const parse = (l: string) => {
                  const m = l.match(/^Station\s+(\d)\s*·\s*([^—]+?)\s*—\s*(.*)$/);
                  return m ? { n: m[1], name: m[2].trim(), rest: m[3].trim() } : { n: "", name: "", rest: l };
                };
                const tiles = all
                  .map((l, i) => ({ ...parse(l), line: i, off: hidden.has(i) }))
                  .slice(1)
                  .filter((t) => isAdmin || !t.off);
                const showing = tiles.filter((t) => !t.off).length;
                return (
                  <section className="rounded-[0.8em] border border-white/15 bg-white/[0.06] overflow-hidden flex-1 min-h-0 flex flex-col shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]">
                    <div className="px-[0.9em] py-[0.4em] border-b shrink-0 flex items-baseline justify-between gap-[1em]" style={{ background: "#3c3527", borderColor: `${NBT_AMBER}66` }}>
                      <h2 className="text-[0.85em] font-black uppercase tracking-wide leading-tight text-white">
                        Cardio Stations <span className="text-white/40 text-[0.6em] tracking-normal font-bold">· everyone</span>
                      </h2>
                      <div className="flex items-center gap-[0.8em]">
                        <p className="text-[0.5em] text-white/40">{header}</p>
                        <StationPictures stations={stationPictures(lines)} color={NBT_AMBER} />
                      </div>
                    </div>
                    <div className="grid gap-[0.5em] flex-1 min-h-0 px-[0.9em] pt-[0.6em] pb-[0.5em]" style={{ gridTemplateColumns: `repeat(${Math.max(1, tiles.length)}, minmax(0, 1fr))` }}>
                      {tiles.map((t, i) => (
                        <div key={t.line} className="min-h-0 flex flex-col gap-[0.3em]">
                        <div data-fit className={`rounded-[0.6em] border border-white/15 bg-[#141416] px-[0.7em] py-[0.5em] min-h-0 flex-1 overflow-hidden flex flex-col ${t.off ? "opacity-35" : ""}`}>
                          <p className="text-[0.5em] font-bold uppercase tracking-[0.18em] leading-tight" style={{ color: `${NBT_AMBER}b3` }}>
                            <span className="text-[1.7em] font-black tracking-normal mr-[0.3em] align-[-0.1em]" style={{ color: NBT_AMBER }}>{t.n || i + 1}</span>{t.name}
                          </p>
                          {/* The work as bullets a kid reads in order — "10 squat jumps",
                              "then 15 jumping jacks", "repeat" — and the cue in grey under
                              them (Josh, 2026-10-20). */}
                          {(() => {
                            const [work, ...cueParts] = t.rest.split(" — ");
                            // One bullet per exercise: "10 squat jumps", "15 jumping jacks". The
                            // "then" is the order the bullets already show; "repeat" joins the cue.
                            const raw = work.split(/,\s*(?=(?:then|repeat|and then)\b)/i).map((x) => x.trim()).filter(Boolean);
                            const repeats = raw.some((x) => /^repeat\b/i.test(x));
                            const items = raw.filter((x) => !/^repeat\b/i.test(x)).map((x) => x.replace(/^(?:and\s+)?then\s+/i, ""));
                            const cue = [repeats ? "Repeat" : "", cueParts.join(" — ").trim()].filter(Boolean).join(" · ");
                            return (
                              <>
                                <ul className="mt-[0.35em] space-y-[0.15em]">
                                  {items.map((it, k) => (
                                    <li key={k} className="flex items-start gap-[0.4em]">
                                      <span className="shrink-0 rounded-full mt-[0.5em]" style={{ width: "0.3em", height: "0.3em", backgroundColor: NBT_AMBER }} />
                                      <span className="text-[0.85em] leading-snug text-white">{it}</span>
                                    </li>
                                  ))}
                                </ul>
                                {cue && <p className="mt-[0.3em] text-[0.65em] leading-snug text-white/55">{cue}</p>}
                              </>
                            );
                          })()}
                        </div>
                        {/* Coach only: take this station off the wall for tonight, or put it back. */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => toggleStation(t.line)}
                            className={`shrink-0 inline-flex items-center justify-center gap-[0.3em] rounded-[0.4em] py-[0.25em] text-[0.45em] font-bold uppercase tracking-wide ${t.off ? "text-black" : "border border-white/20 text-white/70 hover:text-white hover:bg-white/10"}`}
                            style={t.off ? { backgroundColor: NBT_AMBER } : undefined}
                          >
                            {t.off ? <><Eye className="w-[1.2em] h-[1.2em]" /> Show tonight</> : <><EyeOff className="w-[1.2em] h-[1.2em]" /> Hide tonight</>}
                          </button>
                        )}
                        </div>
                      ))}
                    </div>
                    <div className="shrink-0 px-[0.9em] pb-[0.6em]">
                      <StationClock storageKey={`nbt-stations:${weekStart}:${dayKey}`} stations={Math.max(1, showing)} seconds={120} color={NBT_AMBER} />
                      {/* Coach only: the whole card off the wall for tonight. */}
                      {isAdmin && (
                        <div className="mt-[0.4em] flex justify-end">
                          <button
                            type="button"
                            onClick={() => saveWork({ stationsHidden: true })}
                            className="inline-flex items-center gap-[0.3em] rounded-[0.4em] border border-white/20 px-[0.7em] py-[0.25em] text-[0.45em] font-bold uppercase tracking-wide text-white/70 hover:text-white hover:bg-white/10"
                          >
                            <EyeOff className="w-[1.2em] h-[1.2em]" /> Hide Cardio Station Section
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                );
              })()}
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

export default NbtBoard;
