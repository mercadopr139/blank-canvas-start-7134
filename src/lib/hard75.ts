// 75 Hard — the plan, and the maths behind it.
//
// Everything here is pure so it can be unit-tested. The 75-day plan is built in
// code rather than by a model for three reasons: the whole calendar has to exist
// the moment someone signs up, progressive overload across twelve and a half
// cycles is arithmetic, and arithmetic should not be delegated to a language
// model. The AI earns its place elsewhere — regenerating a single session.
//
// See docs/HARD75_PLAN.md.

export const HARD75_LENGTH = 75;

export const STRENGTH_COLOR = "#bf0f3e"; // NLA red
export const CARDIO_COLOR = "#38bdf8"; // sky
export const MOBILITY_COLOR = "#a78bfa"; // violet — the sixth-day deload

export interface WorkoutBlock {
  name: string;
  detail: string;
  /** What to do instead when he's at the firehouse and not a full gym. */
  home?: string;
}

export interface Workout {
  kind: "strength" | "cardio";
  title: string;
  focus: string;
  blocks: WorkoutBlock[];
  notes?: string;
  /** Cardio only: this one is meant to be the outdoor session. */
  outdoor?: boolean;
}

export interface Hard75Run {
  id: string;
  participant: string;
  age: number | null;
  limitations: string | null;
  goal: string | null;
  /** Null until the participant opens their link and picks a Day 1. */
  start_date: string | null;
  status: "pending" | "active" | "failed" | "complete";
  /** Present only in the admin view; the link page never receives it. */
  access_token?: string | null;
  failed_on_day: number | null;
  failed_reason: string | null;
  restarted_from: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface Hard75Day {
  id: string;
  run_id: string;
  day_number: number;
  date: string;
  strength: Workout;
  cardio: Workout;
  strength_done: boolean;
  cardio_done: boolean;
  outdoor_done: boolean;
  water_done: boolean;
  reading_done: boolean;
  diet_done: boolean;
  photo_path: string | null;
  /** Pounds. Null on any day it was not weighed — the programme does not ask for it. */
  weight_lb: number | null;
  notes: string | null;
  completed_at: string | null;
  /** Accumulated seconds, NOT counting a stretch that is running right now. */
  strength_seconds: number;
  strength_started_at: string | null;
  cardio_seconds: number;
  cardio_started_at: string | null;
}

/** The six things that have to be true for a day to count. */
export const CHECKLIST = [
  { key: "strength_done", label: "Strength workout" },
  { key: "cardio_done", label: "Cardio workout" },
  { key: "outdoor_done", label: "One workout outdoors" },
  { key: "water_done", label: "Gallon of water" },
  { key: "reading_done", label: "10 pages read" },
  { key: "diet_done", label: "Diet followed" },
] as const;

export type ChecklistKey = (typeof CHECKLIST)[number]["key"];

/* ───── Dates ─────
   Kept as local YYYY-MM-DD strings throughout. Building these from Date.toISOString
   would shift the day backwards for anyone west of UTC, which is everyone here. */

export const toDateString = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

export const daysBetween = (from: string, to: string) => {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
};

/** Which day of the run a date is. 1-based; 0 or less means it hasn't started. */
export const dayNumberFor = (startDate: string, date: string) =>
  daysBetween(startDate, date) + 1;

export const endDateOf = (startDate: string) => addDays(startDate, HARD75_LENGTH - 1);

/* ───── The rotation ─────
   Six days, because 75 consecutive strength sessions with no rest day is how a
   45-year-old's shoulder stops working in week four. Every sixth day is a real
   deload that still ticks the box, so recovery never costs the streak. */

export const ROTATION = [
  "Chest + Triceps",
  "Back + Biceps",
  "Legs — Quads",
  "Shoulders + Arms",
  "Legs — Posterior",
  "Mobility + Core",
] as const;

export const rotationIndex = (day: number) => (day - 1) % ROTATION.length;
export const cycleIndex = (day: number) => Math.floor((day - 1) / ROTATION.length);
export const isMobilityDay = (day: number) => rotationIndex(day) === 5;

/* ───── Progression ─────
   Three phases across the 75 days. Higher reps to build tolerance, then load,
   then strength — with volume that a man doing daily cardio can actually
   recover from. */

export interface Phase {
  name: string;
  sets: number;
  reps: string;
  accessoryReps: string;
}

export const phaseFor = (day: number): Phase => {
  if (day <= 25) return { name: "Foundation", sets: 3, reps: "10–12", accessoryReps: "12–15" };
  if (day <= 50) return { name: "Build", sets: 4, reps: "8–10", accessoryReps: "10–12" };
  return { name: "Peak", sets: 4, reps: "6–8", accessoryReps: "8–12" };
};

/* ───── The exercise library ─────
   Each slot holds several variants; the cycle number picks one, so the same
   body part is not the identical session every six days across seventy-five.
   Every lift names a home/firehouse substitute — a shift day should cost him
   the gym, not the session. */

type Lift = { name: string; home: string };

const LIBRARY: Record<number, { primary: Lift[]; secondary: Lift[]; accessory: Lift[][] }> = {
  // Chest + Triceps
  0: {
    primary: [
      { name: "Barbell bench press", home: "Dumbbell floor press" },
      { name: "Incline barbell press", home: "Incline push-ups, feet raised" },
      { name: "Dumbbell bench press", home: "Dumbbell floor press" },
    ],
    secondary: [
      { name: "Incline dumbbell press", home: "Pike push-ups" },
      { name: "Weighted dips", home: "Bench dips, feet out" },
      { name: "Machine chest press", home: "Banded chest press" },
    ],
    accessory: [
      [
        { name: "Cable fly", home: "Banded fly" },
        { name: "Overhead triceps extension", home: "Dumbbell overhead extension" },
        { name: "Triceps rope pushdown", home: "Banded pushdown" },
      ],
      [
        { name: "Dumbbell fly", home: "Banded fly" },
        { name: "Close-grip bench press", home: "Diamond push-ups" },
        { name: "Skull crushers", home: "Dumbbell skull crushers" },
      ],
    ],
  },
  // Back + Biceps
  1: {
    primary: [
      { name: "Barbell row", home: "Single-arm dumbbell row" },
      { name: "Weighted pull-ups", home: "Pull-ups or banded pull-ups" },
      { name: "T-bar row", home: "Single-arm dumbbell row" },
    ],
    secondary: [
      { name: "Lat pulldown", home: "Banded lat pulldown" },
      { name: "Chest-supported row", home: "Chest-supported dumbbell row" },
      { name: "Seated cable row", home: "Banded row" },
    ],
    accessory: [
      [
        { name: "Face pulls", home: "Banded face pulls" },
        { name: "Barbell curl", home: "Dumbbell curl" },
        { name: "Hammer curl", home: "Hammer curl" },
      ],
      [
        { name: "Straight-arm pulldown", home: "Banded straight-arm pulldown" },
        { name: "Incline dumbbell curl", home: "Dumbbell curl, slow negative" },
        { name: "Cable curl", home: "Banded curl" },
      ],
    ],
  },
  // Legs — Quads
  2: {
    primary: [
      { name: "Back squat", home: "Goblet squat" },
      { name: "Front squat", home: "Goblet squat, heels raised" },
      { name: "Hack squat", home: "Bulgarian split squat" },
    ],
    secondary: [
      { name: "Leg press", home: "Walking lunges" },
      { name: "Bulgarian split squat", home: "Bulgarian split squat" },
      { name: "Walking lunges", home: "Walking lunges" },
    ],
    accessory: [
      [
        { name: "Leg extension", home: "Reverse Nordic curl" },
        { name: "Standing calf raise", home: "Single-leg calf raise on a step" },
      ],
      [
        { name: "Step-ups, weighted", home: "Step-ups onto a bench" },
        { name: "Seated calf raise", home: "Single-leg calf raise on a step" },
      ],
    ],
  },
  // Shoulders + Arms
  3: {
    primary: [
      { name: "Standing overhead press", home: "Dumbbell shoulder press" },
      { name: "Seated dumbbell press", home: "Dumbbell shoulder press" },
      { name: "Push press", home: "Dumbbell push press" },
    ],
    secondary: [
      { name: "Lateral raises", home: "Lateral raises" },
      { name: "Upright row, wide grip", home: "Banded upright row" },
      { name: "Cable lateral raise", home: "Banded lateral raise" },
    ],
    accessory: [
      [
        { name: "Rear delt fly", home: "Bent-over rear delt fly" },
        { name: "EZ-bar curl", home: "Dumbbell curl" },
        { name: "Rope pushdown", home: "Bench dips" },
      ],
      [
        { name: "Face pulls", home: "Banded face pulls" },
        { name: "Preacher curl", home: "Concentration curl" },
        { name: "Overhead rope extension", home: "Dumbbell overhead extension" },
      ],
    ],
  },
  // Legs — Posterior
  4: {
    primary: [
      { name: "Romanian deadlift", home: "Dumbbell Romanian deadlift" },
      { name: "Conventional deadlift", home: "Dumbbell deadlift" },
      { name: "Trap bar deadlift", home: "Dumbbell deadlift" },
    ],
    secondary: [
      { name: "Hip thrust", home: "Single-leg glute bridge" },
      { name: "Good mornings", home: "Banded good mornings" },
      { name: "Cable pull-through", home: "Banded pull-through" },
    ],
    accessory: [
      [
        { name: "Lying leg curl", home: "Nordic curl or slider curl" },
        { name: "Back extension", home: "Superman holds" },
      ],
      [
        { name: "Seated leg curl", home: "Slider hamstring curl" },
        { name: "Single-leg RDL", home: "Single-leg RDL, dumbbells" },
      ],
    ],
  },
  // Mobility + Core — the deload
  5: {
    primary: [
      { name: "90/90 hip switches", home: "90/90 hip switches" },
      { name: "Couch stretch", home: "Couch stretch" },
      { name: "World's greatest stretch", home: "World's greatest stretch" },
    ],
    secondary: [
      { name: "Thoracic rotations", home: "Thoracic rotations" },
      { name: "Banded shoulder dislocates", home: "Towel dislocates" },
      { name: "Cat-cow into down dog", home: "Cat-cow into down dog" },
    ],
    accessory: [
      [
        { name: "Dead hang", home: "Dead hang from anything solid" },
        { name: "Farmer's carry", home: "Suitcase carry, heavy dumbbell" },
      ],
      [
        { name: "Turkish get-up", home: "Turkish get-up" },
        { name: "Suitcase carry", home: "Suitcase carry, heavy dumbbell" },
      ],
    ],
  },
};

/** Abs go in every strength session, as asked. Rotated so it isn't the same three. */
const AB_SETS: WorkoutBlock[][] = [
  [
    { name: "Hanging knee raises", detail: "3 × 12", home: "Lying leg raises" },
    { name: "Cable crunch", detail: "3 × 15", home: "Weighted crunch" },
    { name: "Plank", detail: "3 × 45 sec", home: "Plank" },
  ],
  [
    { name: "Hanging leg raises", detail: "3 × 10", home: "Lying leg raises" },
    { name: "Ab wheel rollout", detail: "3 × 10", home: "Slider rollout" },
    { name: "Side plank", detail: "3 × 30 sec each side", home: "Side plank" },
  ],
  [
    { name: "Weighted decline sit-up", detail: "3 × 15", home: "Weighted sit-up" },
    { name: "Pallof press", detail: "3 × 12 each side", home: "Banded Pallof press" },
    { name: "Hollow body hold", detail: "3 × 30 sec", home: "Hollow body hold" },
  ],
];

/* ───── Cardio ─────
   Deliberately arranged against the strength rotation so a hard cardio session
   never lands on a heavy leg day: quads and posterior days get low-impact or
   easy work, and the hard intervals sit on the mobility day.

   EVERY session lasts 45 minutes, warm-up and cool-down included. That is what
   the program asks for and what the timer counts down, so a workout that says
   sixty is simply wrong. There is a test that fails the build over it. */

const CARDIO_BY_SLOT: Array<Omit<Workout, "kind">> = [
  {
    title: "Zone 2 run",
    focus: "Easy aerobic",
    outdoor: true,
    blocks: [
      { name: "45 minutes, conversational pace", detail: "Nose-breathing pace. If you can't talk, slow down." },
    ],
    notes: "This is the outdoor one. Fat loss lives here, not in the hard sessions.",
  },
  {
    title: "Intervals",
    focus: "Hard",
    outdoor: true,
    blocks: [
      { name: "Warm-up", detail: "10 minutes easy" },
      { name: "8 × 1 minute hard / 2 minutes easy", detail: "Hard means you want it to stop at 40 seconds." },
      { name: "Cool-down", detail: "10 minutes easy" },
    ],
  },
  {
    title: "Low-impact steady",
    focus: "Recovery aerobic",
    blocks: [
      { name: "45 minutes bike or row", detail: "Steady, moderate. Legs did their work already today." },
    ],
    notes: "Deliberately low-impact — this sits on quad day.",
  },
  {
    title: "Steady distance",
    focus: "Aerobic base",
    outdoor: true,
    blocks: [
      { name: "45 minutes outdoors", detail: "Run, ruck or fast walk. Steady the whole way — cover ground, don’t race it." },
    ],
  },
  {
    title: "Easy walk",
    focus: "Active recovery",
    outdoor: true,
    blocks: [
      { name: "45 minutes brisk walk", detail: "Weighted vest optional. Keep it genuinely easy." },
    ],
    notes: "Posterior chain is cooked today. Nothing that loads the hamstrings.",
  },
  {
    title: "Hill sprints",
    focus: "Hard",
    outdoor: true,
    blocks: [
      { name: "Warm-up", detail: "12 minutes easy" },
      { name: "10 × 20 second hill sprint", detail: "Walk back down. About 23 minutes all in." },
      { name: "Cool-down", detail: "10 minutes easy" },
    ],
    notes: "The hard one lands on mobility day, when nothing heavy is being lifted.",
  },
];

/* ───── Building a session ───── */

const pick = <T,>(list: T[], cycle: number) => list[cycle % list.length];

export const buildStrength = (day: number): Workout => {
  const slot = rotationIndex(day);
  const cycle = cycleIndex(day);
  const phase = phaseFor(day);
  const lib = LIBRARY[slot];
  const mobility = isMobilityDay(day);

  const primary = pick(lib.primary, cycle);
  const secondary = pick(lib.secondary, cycle);
  const accessories = pick(lib.accessory, cycle);

  const blocks: WorkoutBlock[] = mobility
    ? [
        { name: primary.name, detail: "3 × 60 sec each side", home: primary.home },
        { name: secondary.name, detail: "3 × 10 slow", home: secondary.home },
        ...accessories.map((a) => ({ name: a.name, detail: "3 × 45 sec", home: a.home })),
      ]
    : [
        { name: primary.name, detail: `${phase.sets} × ${phase.reps}`, home: primary.home },
        { name: secondary.name, detail: `${phase.sets} × ${phase.reps}`, home: secondary.home },
        ...accessories.map((a) => ({
          name: a.name,
          detail: `3 × ${phase.accessoryReps}`,
          home: a.home,
        })),
      ];

  return {
    kind: "strength",
    title: ROTATION[slot],
    focus: mobility ? "Deload — move well, stay in the streak" : phase.name,
    blocks: [...blocks, ...pick(AB_SETS, cycle)],
    notes: mobility
      ? "Sixth day. Nothing heavy — this is the recovery that keeps the other five honest."
      : undefined,
  };
};

export const buildCardio = (day: number): Workout => ({
  kind: "cardio",
  ...pick(CARDIO_BY_SLOT, rotationIndex(day)),
});

/** The whole 75 days, ready to write in one go. */
export const buildPlan = (startDate: string) =>
  Array.from({ length: HARD75_LENGTH }, (_, i) => {
    const day = i + 1;
    return {
      day_number: day,
      date: addDays(startDate, i),
      strength: buildStrength(day),
      cardio: buildCardio(day),
    };
  });

/* ───── Session timers ─────
   75 Hard asks for two 45-minute workouts. The timer is stored as accumulated
   seconds plus a "running since" stamp rather than a countdown in component
   state, because he will lock his phone between sets and a timer that dies with
   the tab is worse than no timer at all. */

export const SESSION_SECONDS = 45 * 60;

/** Total seconds on the clock, including a stretch still running. */
export const elapsedSeconds = (
  accumulated: number,
  startedAt: string | null,
  now: Date = new Date()
) => {
  const base = Math.max(0, accumulated || 0);
  if (!startedAt) return base;
  const since = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  // A clock skew or a stale stamp must never subtract time already earned.
  return base + Math.max(0, since);
};

/** Seconds left of the 45. Negative once he is into overtime. */
export const remainingSeconds = (elapsed: number) => SESSION_SECONDS - elapsed;

/** "44:59", or "1:02:30" once past an hour. Always mm:ss at minimum. */
export const formatClock = (totalSeconds: number) => {
  const s = Math.abs(Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};

/** Whole minutes, for the record of how long a session actually took. */
export const minutesOf = (seconds: number) => Math.round((seconds || 0) / 60);

/* ───── Weight ─────
   A number on its own says nothing; the change since day one is the whole
   reason for writing it down every morning. */

export interface WeightTrend {
  first: number;
  latest: number;
  change: number;
  entries: number;
}

/** Null until there are at least two weigh-ins to compare. */
export const weightTrend = (
  days: Pick<Hard75Day, "day_number" | "weight_lb">[]
): WeightTrend | null => {
  const logged = days
    .filter((d) => d.weight_lb != null)
    .sort((a, b) => a.day_number - b.day_number);
  if (logged.length < 2) return null;
  const first = Number(logged[0].weight_lb);
  const latest = Number(logged[logged.length - 1].weight_lb);
  return {
    first,
    latest,
    // Rounded to a decimal: floats turn 184.6 - 190.2 into -5.600000000000023.
    change: Math.round((latest - first) * 10) / 10,
    entries: logged.length,
  };
};

/* ───── Status ───── */

export const dayComplete = (d: Pick<Hard75Day, ChecklistKey>) =>
  CHECKLIST.every((c) => d[c.key]);

export const doneCount = (d: Pick<Hard75Day, ChecklistKey>) =>
  CHECKLIST.filter((c) => d[c.key]).length;

export type DayStatus = "complete" | "partial" | "today" | "missed" | "future";

/**
 * What a calendar tile should show.
 *
 * A day only counts as MISSED once it is genuinely in the past — today stays
 * "today" however little is ticked, because the day isn't over.
 */
export const dayStatus = (
  d: Pick<Hard75Day, ChecklistKey | "date">,
  today: string
): DayStatus => {
  if (dayComplete(d)) return "complete";
  if (d.date === today) return "today";
  if (d.date > today) return "future";
  return doneCount(d) > 0 ? "partial" : "missed";
};

/**
 * The first day that was started-but-not-finished or skipped outright, in the
 * past. This is the day that ends the run — 75 Hard has no partial credit.
 */
export const firstFailedDay = <T extends Pick<Hard75Day, ChecklistKey | "date" | "day_number">>(
  days: T[],
  today: string
): T | undefined =>
  days
    .filter((d) => d.date < today)
    .sort((a, b) => a.day_number - b.day_number)
    .find((d) => !dayComplete(d));

/** Consecutive complete days from day 1. The number he actually cares about. */
export const streak = <T extends Pick<Hard75Day, ChecklistKey | "day_number">>(days: T[]) => {
  const ordered = [...days].sort((a, b) => a.day_number - b.day_number);
  let n = 0;
  for (const d of ordered) {
    if (!dayComplete(d)) break;
    n += 1;
  }
  return n;
};
