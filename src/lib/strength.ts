// Battle Team S&C — the shape of a week, shared by the coach's working page
// (/strength-coach) and the gym screen (/strength-board).
//
// Extracted from StrengthCoach.tsx unchanged, so the two pages can never
// disagree about what a day looks like.

export type DayKey = "monday" | "wednesday" | "friday";

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
