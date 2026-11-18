// Rev's rotation (Pastor Bill, through Josh, 2026-11-18): the lift and the
// stations are DECIDED HERE, in code, before the generator is called. The AI
// writes the warm-up for the lift, its dose, the one simplified line, the
// cues and a short cue on each station — never which lift, never which
// station movement.
//
// THE LIFT rotates through eight movements in Rev's order, one per session,
// across weeks, months and nights moved: the next session takes the lift
// after whatever was last done. Each comes back every eighth session and
// progresses from where it was the last time it ran.
//
// THE STATIONS are fixed roles per room, three minutes each. Each picks one
// movement at random from Rev's list for that role — never the pick that
// station had last session in that room, never the lift's own movement.
// "Machine of choice" and "Coach's choice" are printed as written.
import { type DayKey, type NbtDay, type NbtWeek, dateOfDay, liftOf, stationLines } from "@/lib/nbt";
import { DAY_ROOM, type RoomKey } from "@/lib/nbtRooms";

/* ───── The eight lifts ───── */

export interface RotationLift {
  key: string;
  name: string;
  pattern: string;
  /** Rev's simplified counterpart(s): the "easier" line's movement. */
  easier: string[];
  /** Monday shares the room with the Battle Team, who have the dumbbells. */
  mondayEasier?: string[];
  /** How a written day names this lift, old days included. Tested in MATCH_ORDER, specific first. */
  match: RegExp;
  /** A station movement that would repeat the lift. */
  avoid: RegExp;
}

export const ROTATION: readonly RotationLift[] = [
  { key: "back-squat", name: "Back Squat", pattern: "Squat", easier: ["Goblet squat", "Bodyweight squat"], match: /squat/i, avoid: /back squat/i },
  { key: "bench-press", name: "Bench Press", pattern: "Push", easier: ["Push-up", "Incline push-up"], match: /bench/i, avoid: /bench press/i },
  { key: "deadlift", name: "Deadlift", pattern: "Hinge", easier: ["Kettlebell deadlift"], match: /dead ?lift|\brdls?\b|romanian/i, avoid: /dead ?lift/i },
  { key: "overhead-press", name: "Overhead Press", pattern: "Overhead", easier: ["Dumbbell overhead press", "Pike press"], mondayEasier: ["Kettlebell overhead press", "Pike press"], match: /overhead press|\bohp\b|shoulder press|strict press/i, avoid: /overhead press/i },
  { key: "barbell-cleans", name: "Barbell Cleans", pattern: "Clean", easier: ["Dumbbell cleans"], mondayEasier: ["Kettlebell cleans"], match: /\bcleans?\b(?!\s*(?:and|&|\+)\s*press)/i, avoid: /\bcleans?\b/i },
  { key: "pull-up", name: "Pull-Up", pattern: "Pull", easier: ["Down-under pull-ups"], match: /pull[- ]?ups?|chin[- ]?ups?/i, avoid: /pull[- ]?ups?/i },
  { key: "thrusters", name: "Thrusters", pattern: "Squat + Overhead", easier: ["Squat + overhead press with a medicine ball or plate"], match: /thruster/i, avoid: /thruster/i },
  { key: "clean-and-press", name: "Clean and Press", pattern: "Clean + Overhead", easier: ["Curls + overhead press with a plate or dumbbell"], mondayEasier: ["Curls + overhead press with a plate"], match: /\bcleans?\s*(?:and|&|\+)\s*press/i, avoid: /\bcleans?\b|ground to overhead/i },
];

/** Specific names first, so "Clean and Press" is not read as "Barbell Cleans" and "Thrusters" is not a squat. */
const MATCH_ORDER = ["clean-and-press", "barbell-cleans", "thrusters", "pull-up", "overhead-press", "bench-press", "deadlift", "back-squat"];
const byKey = (key: string) => ROTATION.find((l) => l.key === key)!;

/** Which of the eight a written lift is, or null for a lift outside the rotation (an old week's carry, say). */
export const rotationEntry = (name: string | null | undefined): RotationLift | null => {
  const n = (name ?? "").trim();
  if (!n) return null;
  for (const key of MATCH_ORDER) { const l = byKey(key); if (l.match.test(n)) return l; }
  return null;
};

/** The lift after this one in Rev's order; the first when there is nothing to follow. */
export const nextLift = (after: RotationLift | null): RotationLift =>
  after ? ROTATION[(ROTATION.indexOf(after) + 1) % ROTATION.length] : ROTATION[0];

/** The next n lifts, in order, after the one given. */
export const liftsAfter = (after: RotationLift | null, n: number): RotationLift[] => {
  const out: RotationLift[] = [];
  let cur = after;
  for (let i = 0; i < n; i++) { cur = nextLift(cur); out.push(cur); }
  return out;
};

/** The simplified counterpart(s) for the day: Monday has no dumbbells. */
export const easierFor = (lift: RotationLift, dayKey: DayKey): string[] =>
  dayKey === "monday" && lift.mondayEasier ? lift.mondayEasier : lift.easier;

/* ───── Reading what was written ───── */

/** The room a day was written for: the programme day it was moved from, else its own night. */
export const roomOf = (dayKey: DayKey, day?: Pick<NbtDay, "movedFrom"> | null): RoomKey =>
  DAY_ROOM[day?.movedFrom ?? dayKey] ?? "performance_center";

export interface DatedDay { date: string; dayKey: DayKey; day: NbtDay }

/** Every written day before a date, oldest first. */
export const daysBefore = (weeks: NbtWeek[], beforeDate: string): DatedDay[] =>
  weeks
    .flatMap((w) => Object.entries(w.days ?? {}).filter(([, d]) => d).map(([k, d]) => ({ date: dateOfDay(w.week_start, k as DayKey), dayKey: k as DayKey, day: d as NbtDay })))
    .filter((d) => d.date < beforeDate)
    .sort((a, b) => a.date.localeCompare(b.date));

/** The last lift done before a date, as one of the eight — null when nothing is written or it is outside the rotation. */
export const lastLiftBefore = (weeks: NbtWeek[], beforeDate: string): RotationLift | null => {
  const last = [...daysBefore(weeks, beforeDate)].reverse().find((d) => liftOf(d.day).name);
  return last ? rotationEntry(liftOf(last.day).name) : null;
};

export interface LastTime { date: string; detail: string; easier: string }

/** What the group did the last time this lift ran before a date, or null the first time. */
export const lastTimeOf = (weeks: NbtWeek[], lift: RotationLift, beforeDate: string): LastTime | null => {
  const last = [...daysBefore(weeks, beforeDate)].reverse().find((d) => rotationEntry(liftOf(d.day).name) === lift);
  if (!last) return null;
  const l = liftOf(last.day);
  return { date: last.date, detail: l.detail, easier: l.easier };
};

/** The station lines of the last session in this room before a date, so no station repeats its pick. */
export const lastStationsBefore = (weeks: NbtWeek[], room: RoomKey, beforeDate: string): string[] => {
  const last = [...daysBefore(weeks, beforeDate)].reverse().find((d) => roomOf(d.dayKey, d.day) === room && stationLines(d.day).length > 0);
  return last ? stationLines(last.day) : [];
};

/* ───── The stations ───── */

export interface StationSlot { place: string; role: string; picks: readonly string[] }

const PULL = ["Pull-ups with bands", "Bent-over rows", "Down-under pull-ups", "Band pull-downs", "Back flies"];
const PUSH = ["Push-ups", "Sled push", "Bench dips", "Ground to overhead", "Push press", "Pike press"];
const CORE = ["Coach's choice"];
const LEGS = ["Wall balls", "Bodyweight squats", "Lunges", "Jump squats", "Duck walk"];
const CARDIO = ["Jump rope", "Burpees", "Crab walk", "Inch worms", "Box jumps", "Suicides (sprint in place, burpee at the whistle)"];

/** Rev's station roles, by room, in rotation order. The boxing facility has no machines and no sled. */
export const STATION_PLAN: Record<RoomKey, StationSlot[]> = {
  performance_center: [
    { place: "The Racks", role: "Pull", picks: PULL },
    { place: "The Machines", role: "Cardio", picks: ["Machine of choice"] },
    { place: "The Mats", role: "Push", picks: PUSH },
    { place: "Open Court", role: "Core", picks: CORE },
    { place: "Open Court", role: "Legs", picks: LEGS },
    { place: "Open Court", role: "Full Body Cardio", picks: CARDIO },
  ],
  boxing_facility: [
    { place: "The Racks", role: "Pull", picks: PULL },
    { place: "The Heavy Bag", role: "Push", picks: PUSH.filter((p) => !/sled/i.test(p)) },
    { place: "The Ring", role: "Core", picks: CORE },
    { place: "The Uppercut", role: "Legs", picks: LEGS },
    { place: "The Open Floor", role: "Full Body Cardio", picks: CARDIO },
  ],
};

export const STATION_MINUTES = 3;
export const stationsHeader = (n: number) => `${n} stations · ${STATION_MINUTES} min each · rotate on the whistle`;

export interface StationPick { n: number; place: string; role: string; move: string }

/** "Station 3 · The Mats (Push) — Push-ups": the line as given to the generator, which adds " — cue". */
export const stationPrefix = (p: StationPick) => `Station ${p.n} · ${p.place} (${p.role}) — ${p.move}`;

/** The movement a station line was written for: "Station 3 · The Mats (Push) — Push-ups — chest to the floor" → "Push-ups". */
export const stationMoveOf = (line: string): string => (line.split(" — ")[1] ?? "").trim();

/**
 * One pick per station: from Rev's list for that role, never the lift's own
 * movement, never what that station had last session in this room (`previous`
 * is that session's station lines, header first). `rand` is injectable for tests.
 */
export const pickStations = (room: RoomKey, lift: RotationLift | null, previous: string[], rand: () => number = Math.random): StationPick[] =>
  STATION_PLAN[room].map((slot, i) => {
    const before = stationMoveOf(previous[i + 1] ?? "").toLowerCase();
    let pool = slot.picks.filter((p) => !(lift && lift.avoid.test(p)));
    if (pool.length === 0) pool = [...slot.picks];
    const fresh = pool.filter((p) => p.toLowerCase() !== before);
    const from = fresh.length ? fresh : pool;
    const move = from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
    return { n: i + 1, place: slot.place, role: slot.role, move };
  });

/** The stations block as stored: the header, then one line per pick. */
export const stationLinesFor = (picks: StationPick[]): string[] => [stationsHeader(picks.length), ...picks.map(stationPrefix)];
