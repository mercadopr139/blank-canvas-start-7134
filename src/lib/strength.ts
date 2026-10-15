// Battle Team S&C — the shape of a week, shared by the coach's working page
// (/strength-coach) and the gym screen (/strength-board).
//
// Extracted from StrengthCoach.tsx unchanged, so the two pages can never
// disagree about what a day looks like.

import { DAY_LABELS, weekdayOf, weekDayKeys, moveDay, removeDay, type WeekdayKey } from "@/lib/programWeek";

// Any practice weekday can hold a workout: the programme's days are Monday,
// Wednesday and Friday, but a coach can push a night's workout to another
// night from the Gym Board when something else takes the floor (Josh, 2026-10-14).
export type DayKey = WeekdayKey;

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

// Moving a day around the week is the same for every programme — the
// helpers live in programWeek.ts and are typed here for the Battle Team.
export { WEEKDAY_KEYS, DAY_LABELS } from "@/lib/programWeek";

export interface DayMeta { key: DayKey; label: string; lift: string; weekday: number }

/** What a day is called: a programme day by name and lift; any other weekday by its name alone. */
export const dayMeta = (key: DayKey): DayMeta =>
  DAYS.find((d) => d.key === key) ?? { key, label: DAY_LABELS[key], lift: "", weekday: weekdayOf(key) };

/** The days a week shows: the programme's three, plus any night a workout was moved onto. */
export const weekDays = (days: WeekRow["days"] | null | undefined): DayMeta[] =>
  weekDayKeys(DAYS.map((d) => d.key), days).map(dayMeta);

/** Move a day's workout to another night (swapping if that night has one). Pure. */
export const moveWorkout = (days: WeekRow["days"], from: DayKey, to: DayKey): WeekRow["days"] | null =>
  moveDay(days, from, to);

/** Take a day's workout out of the week. Pure. */
export const removeWorkout = (days: WeekRow["days"], key: DayKey): WeekRow["days"] | null =>
  removeDay(days, key);

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
