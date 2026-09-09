// One track's clock for the conditioning block.
//
// Three of these sit side by side on the gym screen, one per track, each in
// its track's colour, because the tracks do not start together — Alpha may
// still be racking a bar while Charlie is already on the floor. A coach taps
// Start on the one that is beginning. The colour is what tells three clocks
// apart from across the room.
//
// Counts down to the minutes the generator gave the block, then keeps going in
// red — overtime is information, not a failure, and boxing is waiting.
//
// Kept in localStorage rather than the database: the screen is a TV with no
// login, and the only thing that has to survive is a refresh mid-session.
import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { elapsedOf, formatClock } from "@/lib/nbt";

interface Clock {
  seconds: number;
  startedAt: string | null;
}

const BLANK: Clock = { seconds: 0, startedAt: null };

const read = (key: string): Clock => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw);
      if (typeof c?.seconds === "number") return { seconds: c.seconds, startedAt: c.startedAt ?? null };
    }
  } catch {
    /* no storage — the clock just will not survive a refresh */
  }
  return BLANK;
};

const write = (key: string, c: Clock) => {
  try {
    localStorage.setItem(key, JSON.stringify(c));
  } catch {
    /* as above */
  }
};

const TrackTimer = ({
  storageKey, minutes, color,
}: {
  /** Unique per week, day and track — a different session is a different clock. */
  storageKey: string;
  minutes: number;
  color: string;
}) => {
  const [clock, setClock] = useState<Clock>(() => read(storageKey));
  useEffect(() => { setClock(read(storageKey)); }, [storageKey]);

  // Ticks only while running — three idle clocks should cost the TV nothing.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!clock.startedAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [clock.startedAt]);

  const total = Math.max(1, minutes) * 60;
  const elapsed = elapsedOf(clock.seconds, clock.startedAt);
  const left = total - elapsed;
  const over = left < 0;
  const running = !!clock.startedAt;
  const pct = Math.min(100, (elapsed / total) * 100);

  const set = (c: Clock) => { setClock(c); write(storageKey, c); };
  const start = () => set({ seconds: clock.seconds, startedAt: new Date().toISOString() });
  const pause = () => set({ seconds: elapsed, startedAt: null });
  const reset = () => set(BLANK);

  const tone = over ? "#f87171" : color;

  // Sized in em throughout: the tile this sits in is shrunk to fit the wall
  // TV by changing one font-size, and the clock has to shrink with it.
  return (
    <div
      className="mt-[0.4em] rounded-xl px-[0.6em] py-[0.4em]"
      style={{ backgroundColor: `${tone}14`, border: `1px solid ${tone}33` }}
    >
      <div className="flex items-center gap-[0.6em]">
        <p
          className={`text-[2.2em] font-black tabular-nums leading-none ${over ? "animate-pulse" : ""}`}
          style={{ color: running || over ? tone : "rgba(255,255,255,0.7)" }}
        >
          {over && "+"}{formatClock(left)}
        </p>

        <div className="ml-auto flex items-center gap-[0.3em] shrink-0">
          <button
            onClick={running ? pause : start}
            className="h-[2.2em] px-[1em] rounded-lg font-black text-[0.85em] text-black transition-opacity hover:opacity-90"
            style={{ backgroundColor: tone }}
            aria-label={running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
          >
            {running ? (
              <span className="inline-flex items-center gap-[0.4em]"><Pause className="w-[1.1em] h-[1.1em]" /> Pause</span>
            ) : (
              <span className="inline-flex items-center gap-[0.4em]">
                <Play className="w-[1.1em] h-[1.1em]" /> {elapsed > 0 ? "Resume" : "Start"}
              </span>
            )}
          </button>
          {elapsed > 0 && !running && (
            <button
              onClick={reset}
              title="Reset"
              aria-label="Reset"
              className="h-[2.2em] w-[2.2em] grid place-items-center rounded-lg text-white/35 hover:text-white/80 transition-colors"
            >
              <RotateCcw className="w-[1em] h-[1em]" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-[0.4em] h-[0.3em] rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
};

export default TrackTimer;
