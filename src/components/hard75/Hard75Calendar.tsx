// The calendar, and the day behind each tile.
//
// A tile has to answer three things from arm's length: which day of the 75 this
// is, whether the strength and the cardio are done, and whether the day as a
// whole survived. So: the day number, two colour-coded bars, and a ring.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, getDay, getDaysInMonth, addMonths, subMonths } from "date-fns";
import {
  Hard75Run, Hard75Day, dayStatus, elapsedSeconds, formatClock, remainingSeconds,
  STRENGTH_COLOR, CARDIO_COLOR, MOBILITY_COLOR, isMobilityDay,
} from "@/lib/hard75";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const Hard75Calendar = ({
  run, days, today, onOpenDay,
}: {
  run: Hard75Run;
  days: Hard75Day[];
  today: string;
  onOpenDay: (d: Hard75Day) => void;
}) => {
  const [month, setMonth] = useState(() =>
    new Date(`${run.start_date ?? today}T12:00:00`)
  );

  // Only ticks while a session is actually running, so the grid isn't
  // re-rendering every second of a rest day.
  const anyRunning = days.some((d) => d.strength_started_at || d.cardio_started_at);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const byDate = useMemo(() => {
    const m: Record<string, Hard75Day> = {};
    days.forEach((d) => { m[d.date] = d; });
    return m;
  }, [days]);

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    const out: (number | null)[] = [];
    for (let i = 0; i < getDay(start); i++) out.push(null);
    for (let d = 1; d <= getDaysInMonth(month); d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost" size="icon"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="text-white/40 hover:text-white h-8 w-8"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="font-bold">{format(month, "MMMM yyyy")}</p>
          <Button
            variant="ghost" size="icon"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="text-white/40 hover:text-white h-8 w-8"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-[10px] text-white/25 text-center font-semibold">{w}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (n === null) return <div key={i} className="aspect-square" />;
            const date = `${format(month, "yyyy-MM")}-${String(n).padStart(2, "0")}`;
            const d = byDate[date];
            if (!d) {
              // A date outside the 75 — greyed, not clickable.
              return (
                <div key={i} className="aspect-square rounded-lg border border-white/[0.04] flex items-start justify-end p-1">
                  <span className="text-[10px] text-white/15">{n}</span>
                </div>
              );
            }
            const status = dayStatus(d, today);
            const live = runningTimer(d);
            return (
              <button
                key={i}
                onClick={() => onOpenDay(d)}
                className={`aspect-square rounded-lg border p-1 flex flex-col justify-between transition-colors ${
                  status === "complete"
                    ? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/15"
                    : status === "missed"
                    ? "border-red-500/40 bg-red-500/[0.07] hover:bg-red-500/10"
                    : status === "partial"
                    ? "border-amber-500/40 bg-amber-500/[0.07] hover:bg-amber-500/10"
                    : status === "today"
                    ? "border-white/50 bg-white/[0.06] hover:bg-white/10"
                    : "border-white/[0.07] hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-start justify-between w-full gap-1 leading-none">
                  {/* The calendar date, plain and where the eye expects it. */}
                  <span className="text-[11px] md:text-xs text-white/45">{n}</span>
                  {/* Day of the 75 — a badge, so it never reads as a date. */}
                  <span
                    className="text-[9px] md:text-[10px] font-black rounded px-1 py-px"
                    style={{ backgroundColor: `${STRENGTH_COLOR}26`, color: "#f2809f" }}
                  >
                    D{d.day_number}
                  </span>
                </div>

                {/* A running session takes over the middle of the tile — he
                    should be able to see the time left from the other side of
                    the gym without opening anything. */}
                {live && (
                  <span
                    className="text-[11px] md:text-sm font-black tabular-nums leading-none"
                    style={{ color: live.over ? "#f87171" : live.color }}
                  >
                    {live.over && "+"}{formatClock(live.left)}
                  </span>
                )}

                {/* The two sessions, always in the same order and the same
                    colours, so a glance reads as "red done, blue not". */}
                <div className="flex gap-0.5 w-full">
                  <Bar
                    done={d.strength_done}
                    color={isMobilityDay(d.day_number) ? MOBILITY_COLOR : STRENGTH_COLOR}
                  />
                  <Bar done={d.cardio_done} color={CARDIO_COLOR} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Two bars per tile: the strength slot on the left, cardio on the
            right. The strength bar turns violet on the sixth-day deload so the
            easy day is visible from across the room. */}
        <div className="mt-3 space-y-1 text-[11px] text-white/40">
          <div className="flex items-center gap-4 flex-wrap">
            <Legend color={STRENGTH_COLOR} label="Strength (left bar)" />
            <Legend color={MOBILITY_COLOR} label="Mobility — the deload, every 6th day" />
            <Legend color={CARDIO_COLOR} label="Cardio (right bar)" />
          </div>
          <p className="text-white/25">
            Bar filled = that session is done. <span className="text-white/40">D12</span> is the day of the 75;
            the pale number is the calendar date.
          </p>
        </div>
      </div>

    </div>
  );
};

/** Whichever session is running right now, and how long is left of its 45. */
const runningTimer = (d: Hard75Day) => {
  const strength = !!d.strength_started_at;
  const cardio = !!d.cardio_started_at;
  if (!strength && !cardio) return null;
  const elapsed = strength
    ? elapsedSeconds(d.strength_seconds ?? 0, d.strength_started_at)
    : elapsedSeconds(d.cardio_seconds ?? 0, d.cardio_started_at);
  const left = remainingSeconds(elapsed);
  return {
    left,
    over: left < 0,
    color: strength
      ? isMobilityDay(d.day_number) ? MOBILITY_COLOR : STRENGTH_COLOR
      : CARDIO_COLOR,
  };
};

const Bar = ({ done, color }: { done: boolean; color: string }) => (
  <span
    className="flex-1 h-1.5 rounded-full"
    style={{ backgroundColor: done ? color : `${color}26` }}
  />
);

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="w-3 h-1.5 rounded-full" style={{ backgroundColor: color }} />
    {label}
  </span>
);

export default Hard75Calendar;
