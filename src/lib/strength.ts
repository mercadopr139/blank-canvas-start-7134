// Battle Team S&C — the shape of a week, shared by the coach's working page
// (/strength-coach) and the gym screen (/strength-board).
//
// Extracted from StrengthCoach.tsx unchanged, so the two pages can never
// disagree about what a day looks like.

// Any practice weekday can hold a workout: the programme's days are Monday,
// Wednesday and Friday, but a coach can push a night's workout to tomorrow
// from the Gym Board when something else takes the floor (Josh, 2026-10-14).
export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

export interface Accessory {
  name: string;
  sets: string;
  equipment: string;
  targets: string;
  howTo?: string;
  scale?: string;
  rest?: string;
}

export interface DayWorkout {
  focus: string;
  estMinutes?: number;
  warmup?: { name: string; detail: string }[];
  main?: { lift: string; scheme: string; guidance?: string; cues?: string[]; rest?: string };
  accessories?: Accessory[];
  finisher?: { name: string; detail: string } | null;
  coachNotes?: string;
  /** The date (America/New_York) a coach changed this day on the wall, if ever. */
  editedOn?: string;
  /** The programme day this workout was pushed from, when a coach moved it a night. */
  movedFrom?: DayKey;
}

export interface WeekRow {
  id: string;
  week_start: string;
  status: "draft" | "locked";
  days: Partial<Record<DayKey, DayWorkout>>;
  locked_at: string | null;
}

export const DAYS: { key: DayKey; label: string; lift: string; weekday: number }[] = [
  { key: "monday", label: "Monday", lift: "Bench Press", weekday: 1 },
  { key: "wednesday", label: "Wednesday", lift: "Back Squat", weekday: 3 },
  { key: "friday", label: "Friday", lift: "Deadlift", weekday: 5 },
];

/** Weekday number (Mon = 1) → day key, for every practice day. */
export const WEEKDAY_KEYS: Record<number, DayKey> = {
  1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday",
};
export const DAY_LABELS: Record<DayKey, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
};

export interface DayMeta { key: DayKey; label: string; lift: string; weekday: number }

/** What a day is called: a programme day by name and lift; any other weekday by its name alone. */
export const dayMeta = (key: DayKey): DayMeta =>
  DAYS.find((d) => d.key === key) ?? {
    key,
    label: DAY_LABELS[key],
    lift: "",
    weekday: Number(Object.entries(WEEKDAY_KEYS).find(([, k]) => k === key)?.[0] ?? 0),
  };

/**
 * The days a week shows: the programme's three, plus any other weekday a
 * workout was moved onto, in weekday order.
 */
export const weekDays = (days: WeekRow["days"] | null | undefined): DayMeta[] => {
  const keys = new Set<DayKey>(DAYS.map((d) => d.key));
  for (const k of Object.keys(days ?? {}) as DayKey[]) if (days?.[k] && WEEKDAY_KEYS[dayMeta(k).weekday]) keys.add(k);
  return [...keys].map(dayMeta).sort((a, b) => a.weekday - b.weekday);
};

/**
 * Move one day's workout to another weekday in the same week. If the target
 * already has a workout the two swap. Each moved workout remembers the
 * programme day it came from; one moved back home forgets it. Returns null
 * when there is nothing on `from` to move. Pure: the week is not touched.
 */
export const moveWorkout = (
  days: WeekRow["days"],
  from: DayKey,
  to: DayKey,
): WeekRow["days"] | null => {
  const moving = days[from];
  if (!moving || from === to) return null;
  const place = (w: DayWorkout, origin: DayKey, at: DayKey): DayWorkout => {
    const home = w.movedFrom ?? origin;
    const { movedFrom: _dropped, ...rest } = w;
    return home === at ? rest : { ...rest, movedFrom: home };
  };
  const next: WeekRow["days"] = { ...days };
  const other = days[to];
  delete next[from];
  next[to] = place(moving, from, to);
  if (other) next[from] = place(other, to, from);
  return next;
};

/** Take one day's workout out of the week. Null when there was nothing on it. Pure. */
export const removeWorkout = (days: WeekRow["days"], key: DayKey): WeekRow["days"] | null => {
  if (!days[key]) return null;
  const next: WeekRow["days"] = { ...days };
  delete next[key];
  return next;
};

/** The whole session, warm-up to finisher. The programme's own cap. */
export const SESSION_MINUTES = 20;

export const toMonday = (d: Date): Date => {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const prettyRange = (mondayISO: string): string => {
  const m = new Date(mondayISO + "T00:00:00");
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${m.toLocaleDateString(undefined, opt)} – ${addDays(m, 4).toLocaleDateString(undefined, opt)}`;
};
