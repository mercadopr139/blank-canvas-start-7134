// Non-Battle Team S&C board — the screen on the gym wall.
//
// Board Mode from the programming rules: read from across the room, no coaching
// prose, three tracks side by side. Charlie is presented exactly as prominently
// as Alpha, because a beginner should never be able to tell they have been
// given "the lesser workout".
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Dumbbell, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import TrackTimer from "@/components/nbt/TrackTimer";
import {
  DAYS, DayKey, TRACKS, TRACK_META, NbtDay, NbtWeek, NbtBlock,
  toDateString, mondayOf, firstOfMonth, dateOfDay, todayDayKey, weekInBlock,
  minutesOf, totalMinutes, readableLines,
} from "@/lib/nbt";
import NbtLogSheet from "@/components/nbt/NbtLogSheet";

const NbtBoard = () => {
  const navigate = useNavigate();
  const today = toDateString(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  // Land on today when today is a training day; otherwise open on Monday.
  const [dayKey, setDayKey] = useState<DayKey>(() => todayDayKey(today) ?? "monday");
  const [logging, setLogging] = useState(false);

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

  const week = data?.week ?? null;
  const block = data?.block ?? null;
  const day: NbtDay | undefined = week?.days?.[dayKey];
  const meta = DAYS.find((d) => d.key === dayKey)!;
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 md:px-8 py-3 border-b border-white/10 flex-wrap">
        {/* Back to the board this screen was opened from, not up to Operations.
            The coach's side has "Open gym board", so the two now round-trip:
            landing on the Operations hub meant finding the NBT board again by
            hand every time. */}
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate("/admin/operations/nbt-board")}
          className="text-white/25 hover:text-white hover:bg-white/5 h-9 w-9"
          aria-label="Back to the NBT S&C Board"
          title="Back to the NBT S&C Board"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Dumbbell className="w-5 h-5" style={{ color: TRACK_META.alpha.color }} />
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-black tracking-tight uppercase">Non-Battle Team</h1>
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
          <Button
            onClick={() => setLogging(true)}
            disabled={!day}
            className="ml-2 font-bold text-white"
            style={{ backgroundColor: TRACK_META.alpha.color }}
          >
            <ClipboardList className="w-4 h-4 mr-1.5" /> Log it
          </Button>
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
      ) : (
        <main className="flex-1 min-h-0 flex flex-col px-4 md:px-8 py-5 gap-5 overflow-y-auto">
          {/* Today's focus, and the name of the circuit under it — the circuit
              is shared by all three tracks, so it is said once here rather than
              repeated in a footer panel. */}
          <div className="text-center">
            {day.focus && (
              <p className="text-3xl md:text-5xl font-black tracking-tight leading-tight">{day.focus}</p>
            )}
            <p className="text-sm md:text-base text-white/35 mt-1.5">
              {day.work.title}
              {day.work.title && day.work.emphasis ? " · " : ""}
              {day.work.emphasis}
              {(day.work.title || day.work.emphasis) && " · "}
              <span className="text-white/50 font-semibold">{totalMinutes(day)} min</span>
            </p>
          </div>

          {/* Prep — one card per movement, numbered. As a single wrapping line
              a warm-up is unreadable: a kid can't tell where one exercise ends
              and the next begins, and a group can't be walked through it. */}
          {day.prep.length > 0 && (
            <section>
              <SectionLabel>Prep · {minutesOf(day).prep} min</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {day.prep.map((p, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-start gap-2.5"
                  >
                    <span className="w-6 h-6 rounded-lg bg-white/10 grid place-items-center text-xs font-black text-white/50 shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-base md:text-lg leading-snug text-white/85">{p}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* The three tracks, equal width and equal weight. */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TRACKS.map((t) => {
              const m = TRACK_META[t];
              const lift = day.lift[t];
              const work = day.work[t];
              return (
                <section
                  key={t}
                  className="rounded-2xl border-2 overflow-hidden flex flex-col"
                  style={{ borderColor: `${m.color}55` }}
                >
                  <div className="px-4 py-2.5" style={{ backgroundColor: `${m.color}1f` }}>
                    <h2 className="text-lg md:text-2xl font-black uppercase tracking-wide" style={{ color: m.color }}>
                      {m.label} <span className="opacity-55">— {m.word}</span>
                    </h2>
                  </div>

                  <div className="flex-1 flex flex-col">
                    {/* Strength: the movement is what they read, the dose is
                        secondary — so the name is big and the sets sit in a
                        chip beside it rather than under it as more prose. */}
                    <div className="px-4 pt-4 pb-4">
                      <TrackLabel color={m.color}>
                        Strength · {minutesOf(day).lift} min{day.lift.pattern ? ` · ${day.lift.pattern}` : ""}
                      </TrackLabel>
                      <div className="flex items-start justify-between gap-3 mt-1.5">
                        <p className="text-2xl md:text-3xl font-bold leading-tight">{lift?.name}</p>
                        {lift?.detail && (
                          <span
                            className="shrink-0 rounded-lg px-2.5 py-1 text-base md:text-lg font-black tabular-nums"
                            style={{ backgroundColor: `${m.color}22`, color: m.color }}
                          >
                            {lift.detail}
                          </span>
                        )}
                      </div>
                    </div>

                    {work.length > 0 && (
                      <>
                        <div className="h-px" style={{ backgroundColor: `${m.color}33` }} />
                        <div className="px-4 pt-4 pb-4 flex-1">
                          <TrackLabel color={m.color}>
                            Conditioning · {minutesOf(day).work} min{day.work.emphasis ? ` · ${day.work.emphasis}` : ""}
                          </TrackLabel>

                          {/* Each track has its own clock, in its own colour,
                              because the tracks do not start together. */}
                          <TrackTimer
                            storageKey={`nbt-timer:${weekStart}:${dayKey}:${t}`}
                            minutes={minutesOf(day).work}
                            color={m.color}
                          />

                          {/* The structure line ("4 rounds — rest 45 sec") reads
                              as a header; every station underneath is one
                              complete line. A dot per line, and real space
                              between them — four rows of identical text is a
                              wall; the dots give the eye somewhere to land. */}
                          <ul className="mt-3 space-y-2.5">
                            {readableLines(work).map((line, i) =>
                              line.kind === "rounds" ? (
                                <li
                                  key={i}
                                  className="text-sm md:text-base font-black uppercase tracking-wide"
                                  style={{ color: m.color }}
                                >
                                  {line.text}
                                </li>
                              ) : (
                                <li key={i} className="flex items-start gap-2.5">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-2.5"
                                    style={{ backgroundColor: m.color }}
                                  />
                                  <span className="text-lg md:text-xl leading-snug text-white/90">{line.text}</span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* Cues and the transition out, side by side at the foot. */}
          <div className="grid gap-4 md:grid-cols-2">
            {day.lift.cues.length > 0 && (
              <section>
                <SectionLabel>Cues</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {day.lift.cues.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-base md:text-lg text-white/85"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {day.reset.length > 0 && (
              <section>
                <SectionLabel>Reset · {minutesOf(day).reset} min · boxing next</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {day.reset.map((r, i) => (
                    <span
                      key={i}
                      className="rounded-xl border border-white/[0.06] px-3 py-2 text-base md:text-lg text-white/55"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      )}

      <NbtLogSheet
        open={logging}
        onClose={() => setLogging(false)}
        day={day}
        dayKey={dayKey}
        date={date}
        weekId={week?.id ?? null}
      />
    </div>
  );
};

const addWeek = (weekStart: string, n: number) => {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + n * 7);
  return toDateString(d);
};

/** Section heading. Bright enough to actually be seen from the floor — the
    old ones were 10px at 30% white and effectively invisible. */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-white/45 font-bold mb-2">
    {children}
  </p>
);

/** The same, tinted to its track, inside a column. */
const TrackLabel = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <p
    className="text-[11px] uppercase tracking-[0.18em] font-bold"
    style={{ color: `${color}cc` }}
  >
    {children}
  </p>
);

export default NbtBoard;
