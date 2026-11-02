// A programme's week, shared by the Battle Team S&C plan and the NBT plan.
//
// Each programme trains on set days (Battle Team Mon / Wed / Fri, NBT Mon /
// Tue / Thu), but a coach can push a night's workout to another practice
// day from the Gym Board when something else takes the floor (Josh,
// 2026-10-14). These helpers know nothing about what a workout holds; they
// move days around in a week and remember where each one came from.

export type WeekdayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

/** Weekday number (Mon = 1) → key. Anything else (weekends) is undefined. */
export const WEEKDAY_KEYS: Record<number, WeekdayKey> = {
  1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday",
};

export const DAY_LABELS: Record<WeekdayKey, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",
};

/** Weekday number (Mon = 1) of a key. */
export const weekdayOf = (key: WeekdayKey): number =>
  Number((Object.entries(WEEKDAY_KEYS).find(([, k]) => k === key) ?? [0])[0]);

/** Is this string one of the five practice-day keys? */
export const isWeekdayKey = (s: string | null | undefined): s is WeekdayKey =>
  (Object.values(WEEKDAY_KEYS) as string[]).includes(s ?? "");

interface Moveable {
  movedFrom?: WeekdayKey;
}

/**
 * Move one day's workout to another weekday in the same week. If the target
 * already has a workout the two swap. Each moved workout remembers the
 * programme day it came from; one moved back home forgets it. Returns null
 * when there is nothing on `from` to move. Pure: the week is not touched.
 */
export const moveDay = <T extends Moveable>(
  days: Partial<Record<WeekdayKey, T>>,
  from: WeekdayKey,
  to: WeekdayKey,
): Partial<Record<WeekdayKey, T>> | null => {
  const moving = days[from];
  if (!moving || from === to) return null;
  const place = (w: T, origin: WeekdayKey, at: WeekdayKey): T => {
    const home = w.movedFrom ?? origin;
    const { movedFrom: _dropped, ...rest } = w;
    return (home === at ? rest : { ...rest, movedFrom: home }) as T;
  };
  const next: Partial<Record<WeekdayKey, T>> = { ...days };
  const other = days[to];
  delete next[from];
  next[to] = place(moving, from, to);
  if (other) next[from] = place(other, to, from);
  return next;
};

/** Take one day's workout out of the week. Null when there was nothing on it. Pure. */
export const removeDay = <T>(
  days: Partial<Record<WeekdayKey, T>>,
  key: WeekdayKey,
): Partial<Record<WeekdayKey, T>> | null => {
  if (!days[key]) return null;
  const next: Partial<Record<WeekdayKey, T>> = { ...days };
  delete next[key];
  return next;
};

/**
 * The days a week shows: the programme's own, plus any other weekday a
 * workout was moved onto, in weekday order.
 */
export const weekDayKeys = <T>(
  programKeys: readonly WeekdayKey[],
  days: Partial<Record<WeekdayKey, T>> | null | undefined,
  /** The nights this week was built for (2026-11-02). Unset or empty: the programme's own. */
  nights?: readonly string[] | null,
): WeekdayKey[] => {
  const chosen = (nights ?? []).filter(isWeekdayKey);
  const keys = new Set<WeekdayKey>(chosen.length ? chosen : programKeys);
  for (const k of Object.keys(days ?? {})) if (isWeekdayKey(k) && days?.[k]) keys.add(k);
  return [...keys].sort((a, b) => weekdayOf(a) - weekdayOf(b));
};

/**
 * Which programme day each chosen night takes (Josh, 2026-11-02: a modified
 * week lifts Monday and Thursday though the programme is Mon/Wed/Fri). A night
 * that IS a programme day keeps its own day; any other night takes the first
 * programme day not yet used, in programme order — so Battle Team on Mon and
 * Thu is Bench and Squat, and NBT on Mon and Thu is its Monday and Thursday.
 * Returns [night, programmeDay] pairs in night order.
 */
export const programDaysForNights = (
  programKeys: readonly WeekdayKey[],
  nights: readonly WeekdayKey[],
): [WeekdayKey, WeekdayKey][] => {
  const ordered = [...new Set(nights)].sort((a, b) => weekdayOf(a) - weekdayOf(b));
  const used = new Set<WeekdayKey>(ordered.filter((n) => programKeys.includes(n)));
  return ordered.map((night) => {
    if (programKeys.includes(night)) return [night, night];
    const next = programKeys.find((k) => !used.has(k));
    if (next) used.add(next);
    return [night, next ?? programKeys[programKeys.length - 1]];
  });
};

/** A workout built for one programme day, filed on the night it runs: it remembers where it came from unless that is home. */
export const placeOnNight = <T extends Moveable>(workout: T, programDay: WeekdayKey, night: WeekdayKey): T => {
  const { movedFrom: _dropped, ...rest } = workout;
  return (night === programDay ? rest : { ...rest, movedFrom: programDay }) as T;
};

/** Where this day's workout went, if a coach pushed it to another night. */
export const movedTo = <T extends Moveable>(
  days: Partial<Record<WeekdayKey, T>> | null | undefined,
  key: WeekdayKey,
): WeekdayKey | null =>
  (Object.keys(days ?? {}) as WeekdayKey[]).find((k) => days?.[k]?.movedFrom === key) ?? null;
