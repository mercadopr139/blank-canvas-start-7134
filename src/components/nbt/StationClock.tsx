// The station clock for Tuesday's Cardio Stations, and the lift clock above
// it (Josh, 2026-10-20).
//
// Five stations, two minutes each. The coach taps Start; the clock counts
// down in digits a kid can read from fifty feet; the last ten seconds go
// amber; at zero the board sounds and flashes and stops. The coach taps Next
// station to reset for the next one — nothing rolls on by itself, the
// whistle is a person. After the fifth it says so. With `words` it is a plain
// one-block clock instead (the 15-minute lift).
//
// Sized in em throughout, like TrackTimer: the Tuesday board is one container
// whose font-size the wall sets to fit the screen, and the clock has to scale
// with it. The tone is made by the board (Web Audio, no file); a browser only
// plays sound after a tap, and Start is that tap. Kept in localStorage like
// the session clocks, so a refresh mid-station does not lose the count.
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ChevronRight } from "lucide-react";
import { elapsedOf, formatClock } from "@/lib/nbt";

interface Clock { station: number; seconds: number; startedAt: string | null; rang: boolean }
const BLANK: Clock = { station: 1, seconds: 0, startedAt: null, rang: false };

const read = (key: string): Clock => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) { const c = JSON.parse(raw); if (typeof c?.station === "number") return { ...BLANK, ...c }; }
  } catch { /* no storage */ }
  return BLANK;
};
const write = (key: string, c: Clock) => { try { localStorage.setItem(key, JSON.stringify(c)); } catch { /* as above */ } };

/** Three loud beeps, then a long one. */
const ring = (ctx: AudioContext) => {
  const beep = (at: number, len: number, hz: number) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "square"; o.frequency.value = hz;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.6, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + len + 0.05);
  };
  const t = ctx.currentTime;
  beep(t, 0.18, 880); beep(t + 0.3, 0.18, 880); beep(t + 0.6, 0.18, 880); beep(t + 0.95, 0.9, 660);
};

/** Words for a one-block clock (the 15-minute lift): the same clock, no stations. */
export interface ClockWords { title: string; idle: string; running: string; rang: string; done: string }

const StationClock = ({
  storageKey, stations = 5, seconds = 120, color = "#ffffff", words,
}: { storageKey: string; stations?: number; seconds?: number; color?: string; words?: ClockWords }) => {
  const [clock, setClock] = useState<Clock>(() => read(storageKey));
  useEffect(() => { setClock(read(storageKey)); }, [storageKey]);
  const audio = useRef<AudioContext | null>(null);

  const [, tick] = useState(0);
  useEffect(() => {
    if (!clock.startedAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [clock.startedAt]);

  const elapsed = elapsedOf(clock.seconds, clock.startedAt);
  const left = Math.max(0, seconds - elapsed);
  const running = !!clock.startedAt;
  const done = clock.station > stations;
  const set = (c: Clock) => { setClock(c); write(storageKey, c); };

  // Zero: ring once, flash, and stop the clock where it is.
  useEffect(() => {
    if (!running || left > 0 || clock.rang) return;
    try { if (!audio.current) audio.current = new AudioContext(); ring(audio.current); } catch { /* no sound on this screen */ }
    set({ ...clock, seconds, startedAt: null, rang: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  const start = () => {
    try { if (!audio.current) audio.current = new AudioContext(); audio.current.resume(); } catch { /* no sound */ }
    set({ ...clock, startedAt: new Date().toISOString() });
  };
  const pause = () => set({ ...clock, seconds: elapsed, startedAt: null });
  const next = () => set({ station: clock.station + 1, seconds: 0, startedAt: null, rang: false });
  const restart = () => set({ ...clock, seconds: 0, startedAt: null, rang: false });
  const allOver = () => set(BLANK);

  const warning = running && left <= 10;
  const tone = clock.rang ? "#f87171" : warning ? "#fbbf24" : color;
  const title = words ? (done ? words.done : words.title) : done ? "All five done" : `Station ${clock.station} of ${stations}`;
  const hint = words
    ? (done ? "" : clock.rang ? words.rang : running ? words.running : clock.seconds > 0 ? "Paused." : words.idle)
    : done ? "Rack it, water, wrap hands — box." : clock.rang ? "Time. Rotate on the whistle." : running ? "2 minutes, own pace." : clock.seconds > 0 ? "Paused." : "Tap Start when the groups are set.";
  const btn = "h-[2.4em] px-[1.1em] rounded-[0.5em] font-black text-[0.95em] transition-opacity hover:opacity-90 inline-flex items-center gap-[0.4em]";

  return (
    <div
      className={`rounded-[0.8em] border px-[1.1em] py-[0.55em] flex items-center gap-[1em] ${clock.rang ? "animate-pulse" : ""}`}
      style={{ borderColor: `${tone}77`, backgroundColor: "#141416" }}
    >
      <div className="min-w-0 w-[11em] shrink-0">
        <p className="text-[0.7em] uppercase tracking-[0.25em] font-black text-white/60 leading-tight">{title}</p>
        {hint && <p className="text-[0.6em] text-white/40 mt-[0.3em] leading-snug">{hint}</p>}
      </div>

      {/* The digits carry the row; everything else is sized against them. */}
      <p
        className="font-black tabular-nums leading-none mx-auto text-[3.6em]"
        style={{ color: running || clock.rang ? tone : "rgba(255,255,255,0.75)" }}
      >
        {done ? "—" : formatClock(left)}
      </p>

      <div className="ml-auto flex items-center gap-[0.4em] shrink-0">
        {!done && !clock.rang && (
          <button onClick={running ? pause : start} className={`${btn} text-black`} style={{ backgroundColor: tone }} aria-label={running ? "Pause" : clock.seconds > 0 ? "Resume" : "Start"}>
            {running ? <><Pause className="w-[1.1em] h-[1.1em]" /> Pause</> : <><Play className="w-[1.1em] h-[1.1em]" /> {clock.seconds > 0 ? "Resume" : "Start"}</>}
          </button>
        )}
        {!done && (clock.rang || (!running && clock.seconds > 0)) && (
          <button onClick={next} className={`${btn} text-black bg-white`} aria-label="Next station">
            {clock.station >= stations ? (words ? "Done" : "Finish") : "Next station"} <ChevronRight className="w-[1.1em] h-[1.1em]" />
          </button>
        )}
        {!done && !running && (clock.seconds > 0 || clock.rang) && (
          <button onClick={restart} title="Restart this station" aria-label="Restart this station" className="h-[2.4em] w-[2.4em] grid place-items-center rounded-[0.5em] text-white/40 hover:text-white/80">
            <RotateCcw className="w-[1.1em] h-[1.1em]" />
          </button>
        )}
        {(done || clock.station > 1) && !running && (
          <button onClick={allOver} className="h-[2.4em] px-[0.8em] rounded-[0.5em] text-[0.7em] font-bold text-white/40 hover:text-white/80" title="Back to station 1">
            Back to 1
          </button>
        )}
      </div>
    </div>
  );
};

export default StationClock;
