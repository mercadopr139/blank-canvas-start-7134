// Non-Battle Team S&C — shared types and the date/block maths.
//
// Pure, so the block arithmetic that decides which week a session belongs to can
// be tested. Getting that wrong would break the continuity the whole programme
// rests on.

// Display order, everywhere the three tracks are shown together. The tracks
// still get equal width and equal weight on the board — a beginner should not be
// able to tell they have been handed “the lesser workout”.
export const TRACKS = ["alpha", "bravo", "charlie"] as const;
export type Track = (typeof TRACKS)[number];

/** How each track is presented. Charlie is LEARN, never "the easy one". */
export const TRACK_META: Record<Track, { label: string; word: string; color: string }> = {
  charlie: { label: "Charlie", word: "Learn", color: "#38bdf8" },
  bravo: { label: "Bravo", word: "Build", color: "#f0a500" },
  alpha: { label: "Alpha", word: "Progress", color: "#bf0f3e" },
};

export const DAYS = [
  { key: "monday", label: "Monday", title: "Squat + Push", weekday: 1 },
  { key: "tuesday", label: "Tuesday", title: "Athletic + Overhead", weekday: 2 },
  { key: "thursday", label: "Thursday", title: "Hinge + Pull", weekday: 4 },
] as const;

export type DayKey = (typeof DAYS)[number]["key"];

export const RESULT_UNITS = ["rounds", "minutes", "seconds", "meters", "reps"] as const;
export type ResultUnit = (typeof RESULT_UNITS)[number];

export interface TrackMovement {
  name: string;
  detail: string;
}

/** How long each block is meant to take. Stated by the generator, not guessed. */
export interface SessionMinutes {
  prep: number;
  lift: number;
  work: number;
  reset: number;
}

/**
 * The ceiling for a whole session, warm-up and reset included. Boxing starts
 * straight afterwards, so overrunning costs the session that actually matters.
 */
export const SESSION_CAP_MINUTES = 40;

/** What a block falls back to when a day predates the generator stating times. */
export const DEFAULT_MINUTES: SessionMinutes = { prep: 5, lift: 10, work: 20, reset: 3 };

export interface NbtDay {
  focus: string;
  minutes?: Partial<SessionMinutes>;
  prep: string[];
  lift: {
    pattern: string;
    charlie: TrackMovement;
    bravo: TrackMovement;
    alpha: TrackMovement;
    cues: string[];
  };
  work: {
    emphasis: string;
    title: string;
    charlie: string[];
    bravo: string[];
    alpha: string[];
    result_unit: ResultUnit | string;
  };
  reset: string[];
}

export const minutesOf = (day: NbtDay | undefined): SessionMinutes => ({
  ...DEFAULT_MINUTES,
  ...(day?.minutes ?? {}),
});

export const totalMinutes = (day: NbtDay | undefined) => {
  const m = minutesOf(day);
  return m.prep + m.lift + m.work + m.reset;
};

export const withinCap = (day: NbtDay | undefined) => totalMinutes(day) <= SESSION_CAP_MINUTES;


export interface NbtBlock {
  id: string;
  month_start: string;
  focus: string | null;
  status: "draft" | "locked";
  locked_at: string | null;
}

export interface NbtWeek {
  id: string;
  block_id: string;
  week_start: string;
  week_in_block: number;
  days: Partial<Record<DayKey, NbtDay>>;
}

export interface NbtLogSet {
  set: number;
  weight: number | null;
  reps: number | null;
}

export interface NbtLog {
  id: string;
  week_id: string | null;
  workout_date: string;
  day_key: DayKey;
  registration_id: string | null;
  athlete_name: string;
  level: Track;
  lift: string | null;
  sets: NbtLogSet[];
  work_result: number | null;
  work_unit: ResultUnit | null;
  notes: string | null;
}

/* ───── Dates ─────
   Local YYYY-MM-DD strings throughout. Going via Date.toISOString would shift
   the day backwards for anyone west of UTC, which is everyone here. */

export const toDateString = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

/** The Monday of the week a date falls in. Sunday belongs to the week ahead. */
export const mondayOf = (date: string = toDateString(new Date())) => {
  const d = new Date(`${date}T12:00:00`);
  const dow = d.getDay(); // 0 = Sunday
  const back = dow === 0 ? -1 : dow - 1;
  return addDays(date, -back);
};

export const firstOfMonth = (date: string = toDateString(new Date())) => `${date.slice(0, 7)}-01`;

export const monthLabel = (monthStart: string) =>
  new Date(`${monthStart}T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/**
 * Every Monday whose week belongs to a month's block.
 *
 * A week belongs to the month its MONDAY falls in, so a week straddling the
 * turn of the month lands in exactly one block and never both — otherwise the
 * same session could appear in two blocks and the progression would double up.
 */
export const mondaysInMonth = (monthStart: string): string[] => {
  const month = monthStart.slice(0, 7);
  const out: string[] = [];
  let m = mondayOf(monthStart);
  // The first Monday of the month may sit in the previous month's final week.
  if (m.slice(0, 7) !== month) m = addDays(m, 7);
  while (m.slice(0, 7) === month) {
    out.push(m);
    m = addDays(m, 7);
  }
  return out;
};

/** 1-based position of a week within its month's block. 0 if it isn't in it. */
export const weekInBlock = (monthStart: string, weekStart: string) =>
  mondaysInMonth(monthStart).indexOf(weekStart) + 1;

/** The date a given training day falls on, for a week starting Monday. */
export const dateOfDay = (weekStart: string, dayKey: DayKey) => {
  const day = DAYS.find((d) => d.key === dayKey);
  return addDays(weekStart, day ? day.weekday - 1 : 0);
};

/** Which training day, if any, today is. Null on Wed/Fri/weekends. */
export const todayDayKey = (today: string = toDateString(new Date())): DayKey | null => {
  const dow = new Date(`${today}T12:00:00`).getDay();
  return DAYS.find((d) => d.weekday === dow)?.key ?? null;
};

/* ───── Logs ───── */

/** A blank set list for a movement, so the tap targets exist before any input. */
export const blankSets = (count = 3): NbtLogSet[] =>
  Array.from({ length: count }, (_, i) => ({ set: i + 1, weight: null, reps: null }));

/** The heaviest set logged. Presented as today's best, never as a max test. */
export const heaviestSet = (sets: NbtLogSet[]) =>
  sets.reduce<number | null>(
    (best, s) => (s.weight != null && (best == null || s.weight > best) ? s.weight : best),
    null
  );

export const totalReps = (sets: NbtLogSet[]) =>
  sets.reduce((n, s) => n + (s.reps ?? 0), 0);

/** Did this athlete actually record anything? Drives "logged / not logged". */
export const hasLogged = (log: Pick<NbtLog, "sets" | "work_result">) =>
  log.sets.some((s) => s.weight != null || s.reps != null) || log.work_result != null;

/** The movement a track is doing on a day — what a kid actually reads. */
export const movementFor = (day: NbtDay | undefined, track: Track): TrackMovement | null =>
  day?.lift?.[track] ?? null;

export const workFor = (day: NbtDay | undefined, track: Track): string[] =>
  day?.work?.[track] ?? [];

/* ───── The board's clock ─────
   Generic on purpose: the conditioning block is whatever the generator said it
   is, not a fixed 45 like the 75 Hard timer. */

/** Seconds run so far: what was banked, plus the live stretch if running. */
export const elapsedOf = (seconds: number, startedAt: string | null, now = Date.now()) =>
  seconds + (startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0);

/** m:ss, of the magnitude — the caller decides whether to show a sign. */
export const formatClock = (totalSeconds: number) => {
  const t = Math.abs(Math.floor(totalSeconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/* ───── Circuit lines a youth can read ─────
   A line on the gym screen is read by a fourteen-year-old from across the
   room. "Bike station:" on one line and ":30 strong effort" on the next is two
   half-lines, and the room asks a hundred questions. */

export interface CircuitLine {
  text: string;
  /** The structure line ("4 rounds — rest 45 sec") reads as a header, not a bullet. */
  kind: "rounds" | "station";
}

/** Does this line describe the shape of the circuit rather than a station? */
export const isRoundsLine = (line: string) => /\b\d+\s*rounds?\b|\bamrap\b|\bemom\b/i.test(line);

/**
 * The lines as they should be read, whatever shape they were written in.
 *
 * Days written before the one-line rule existed have headings with nothing on
 * them followed by the detail on the next line; those are joined here so the
 * board reads properly without rebuilding the month. A bare ":30" becomes
 * "30 sec". The structure line is hoisted to the top wherever it was written,
 * because "repeat 4 rounds" is the first thing to know, not the last.
 */
export const readableLines = (lines: string[]): CircuitLine[] => {
  const out: CircuitLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    let text = (lines[i] ?? "").trim();
    if (!text) continue;
    while (/:\s*$/.test(text) && i + 1 < lines.length) {
      const next = (lines[i + 1] ?? "").trim();
      text = `${text.replace(/:\s*$/, "")} — ${next}`;
      i++;
    }
    // A bare ":30" is gym shorthand nobody under twenty reads first time.
    text = text.replace(/(^|\s):(\d{1,2})\b/g, (_, pre: string, n: string) => `${pre}${n} sec`);
    out.push({ text, kind: isRoundsLine(text) ? "rounds" : "station" });
  }
  const rounds = out.filter((l) => l.kind === "rounds");
  const stations = out.filter((l) => l.kind === "station");
  return [...rounds, ...stations];
};
