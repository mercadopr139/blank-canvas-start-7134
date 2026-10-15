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
): WeekdayKey[] => {
  const keys = new Set<WeekdayKey>(programKeys);
  for (const k of Object.keys(days ?? {})) if (isWeekdayKey(k) && days?.[k]) keys.add(k);
  return [...keys].sort((a, b) => weekdayOf(a) - weekdayOf(b));
};

/** Where this day's workout went, if a coach pushed it to another night. */
export const movedTo = <T extends Moveable>(
  days: Partial<Record<WeekdayKey, T>> | null | undefined,
  key: WeekdayKey,
): WeekdayKey | null =>
  (Object.keys(days ?? {}) as WeekdayKey[]).find((k) => days?.[k]?.movedFrom === key) ?? null;
