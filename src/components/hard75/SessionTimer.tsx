// The 45-minute clock on a session.
//
// It counts down, then keeps going in red once he's past 45 — overtime is
// information, not a failure. The elapsed seconds are written to the day, which
// is both why it survives a locked phone and how we'll know later whether these
// workouts are actually the right length.
import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import {
  SESSION_SECONDS, elapsedSeconds, remainingSeconds, formatClock, minutesOf,
} from "@/lib/hard75";

const SessionTimer = ({
  seconds, startedAt, color, onChange,
}: {
  seconds: number;
  startedAt: string | null;
  color: string;
  onChange: (patch: { seconds: number; startedAt: string | null }) => void;
}) => {
  // Only ticks while it's actually running — no interval burning through a
  // phone battery on a day he isn't training.
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = elapsedSeconds(seconds, startedAt);
  const left = remainingSeconds(elapsed);
  const over = left < 0;
  const running = !!startedAt;
  const pct = Math.min(100, (elapsed / SESSION_SECONDS) * 100);

  const start = () => onChange({ seconds, startedAt: new Date().toISOString() });
  const pause = () => onChange({ seconds: elapsed, startedAt: null });
  const reset = () => onChange({ seconds: 0, startedAt: null });

  return (
    <div className="border-t border-white/[0.06] px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Timer className="w-4 h-4 shrink-0" style={{ color: over ? "#f87171" : color }} />

        <div className="min-w-0">
          <p
            className="text-2xl font-black tabular-nums leading-none"
            style={{ color: over ? "#f87171" : running ? color : "rgba(255,255,255,0.75)" }}
          >
            {over && "+"}{formatClock(left)}
          </p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {over
              ? `${minutesOf(elapsed)} min — past the 45`
              : elapsed > 0
              ? `${minutesOf(elapsed)} of 45 min done`
              : "45 minutes"}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            onClick={running ? pause : start}
            className="h-9 px-4 rounded-lg font-bold text-sm text-black transition-opacity hover:opacity-90"
            style={{ backgroundColor: over ? "#f87171" : color }}
          >
            {running ? (
              <span className="inline-flex items-center gap-1.5"><Pause className="w-4 h-4" /> Pause</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><Play className="w-4 h-4" /> {elapsed > 0 ? "Resume" : "Start"}</span>
            )}
          </button>
          {elapsed > 0 && !running && (
            <button
              onClick={reset}
              title="Reset this timer"
              aria-label="Reset this timer"
              className="h-9 w-9 grid place-items-center rounded-lg text-white/30 hover:text-white/70 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: over ? "#f87171" : color }}
        />
      </div>
    </div>
  );
};

export default SessionTimer;
