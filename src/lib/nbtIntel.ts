// What the Non-Battle Team logs actually tell you.
//
// Kept separate from the Battle Team's numbers on purpose: a 5×5 back squat and
// a 3×8 goblet squat are not the same measurement, and averaging them would
// produce an "average strength gain" that means nothing. The person carries
// across the two programmes; the metrics do not.
//
// This programme is measured on what it is for — competency, work capacity and
// showing up — so the headline is track movement, not weight on a bar.
import { NbtLog, Track, TRACKS, heaviestSet } from "@/lib/nbt";

/** The ladder, in order, so a move can be read as up or down. */
const RANK: Record<Track, number> = { charlie: 0, bravo: 1, alpha: 2 };

export interface TrackMove {
  from: Track;
  to: Track;
  date: string;
  up: boolean;
}

export interface LiftPoint {
  date: string;
  lift: string;
  weight: number | null;
  reps: number;
  level: Track;
}

export interface WorkPoint {
  date: string;
  title: string;
  result: number;
  unit: string;
  level: Track;
}

export interface AthleteIntel {
  registrationId: string;
  name: string;
  sessions: number;
  firstDate: string;
  lastDate: string;
  /** Where they are now — the track of their most recent session. */
  currentLevel: Track;
  startLevel: Track;
  moves: TrackMove[];
  lifts: LiftPoint[];
  work: WorkPoint[];
  /** Days since they last logged. The number that finds a youth drifting away. */
  daysSince: number;
}

export interface NbtOverview {
  athletes: number;
  sessions: number;
  /** Youth who have moved UP a track at any point. The competency story. */
  movedUp: number;
  /** Youth with no session in the last fortnight, among those who ever logged. */
  slipping: number;
  byLevel: Record<Track, number>;
}

const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000
  );

/**
 * One athlete's story, from their logs.
 *
 * Track moves are read from the sessions themselves rather than from whatever
 * level they are assigned today — the log records what they ACTUALLY trained,
 * so a youth who moved up in week three still shows as Charlie in week one.
 */
export const athleteIntel = (
  registrationId: string,
  logs: NbtLog[],
  today: string
): AthleteIntel | null => {
  const mine = [...logs]
    .filter((l) => l.registration_id === registrationId)
    .sort((a, b) => (a.workout_date < b.workout_date ? -1 : 1));
  if (mine.length === 0) return null;

  const moves: TrackMove[] = [];
  for (let i = 1; i < mine.length; i++) {
    const from = mine[i - 1].level;
    const to = mine[i].level;
    if (from !== to) {
      moves.push({ from, to, date: mine[i].workout_date, up: RANK[to] > RANK[from] });
    }
  }

  const lifts: LiftPoint[] = mine
    .filter((l) => l.lift)
    .map((l) => ({
      date: l.workout_date,
      lift: l.lift as string,
      weight: heaviestSet(l.sets ?? []),
      reps: (l.sets ?? []).reduce((n, s) => n + (s.reps ?? 0), 0),
      level: l.level,
    }));

  const work: WorkPoint[] = mine
    .filter((l) => l.work_result != null)
    .map((l) => ({
      date: l.workout_date,
      title: l.lift ?? "",
      result: Number(l.work_result),
      unit: l.work_unit ?? "",
      level: l.level,
    }));

  const last = mine[mine.length - 1];
  return {
    registrationId,
    name: last.athlete_name,
    sessions: mine.length,
    firstDate: mine[0].workout_date,
    lastDate: last.workout_date,
    currentLevel: last.level,
    startLevel: mine[0].level,
    moves,
    lifts,
    work,
    daysSince: daysBetween(last.workout_date, today),
  };
};

/** Everyone who has logged anything, most recently active first. */
export const allAthletes = (logs: NbtLog[], today: string): AthleteIntel[] => {
  const ids = Array.from(
    new Set(logs.map((l) => l.registration_id).filter(Boolean) as string[])
  );
  return ids
    .map((id) => athleteIntel(id, logs, today))
    .filter((a): a is AthleteIntel => a !== null)
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
};

/** A youth is drifting once a fortnight has passed with nothing logged. */
export const SLIPPING_DAYS = 14;

export const overview = (athletes: AthleteIntel[]): NbtOverview => {
  const byLevel: Record<Track, number> = { charlie: 0, bravo: 0, alpha: 0 };
  athletes.forEach((a) => { byLevel[a.currentLevel] += 1; });
  return {
    athletes: athletes.length,
    sessions: athletes.reduce((n, a) => n + a.sessions, 0),
    movedUp: athletes.filter((a) => a.moves.some((m) => m.up)).length,
    slipping: athletes.filter((a) => a.daysSince >= SLIPPING_DAYS).length,
    byLevel,
  };
};

/**
 * Progress on one circuit, for one athlete.
 *
 * Only comparable when the circuit is the same and the unit is the same — the
 * whole point of a month-long block is that a repeated circuit becomes a fair
 * comparison. Comparing rounds of one workout to metres of another would be
 * inventing a trend.
 */
export const workTrend = (a: AthleteIntel, title: string, unit: string) => {
  const points = a.work.filter((w) => w.title === title && w.unit === unit);
  if (points.length < 2) return null;
  const first = points[0].result;
  const last = points[points.length - 1].result;
  return {
    points,
    first,
    last,
    change: last - first,
    pct: first > 0 ? Math.round(((last - first) / first) * 100) : 0,
  };
};

/** Best weight on a named movement, so a repeated lift can show a trend. */
export const liftTrend = (a: AthleteIntel, lift: string) => {
  const points = a.lifts.filter((l) => l.lift === lift && l.weight != null);
  if (points.length < 2) return null;
  const first = points[0].weight as number;
  const last = points[points.length - 1].weight as number;
  const pr = points.reduce((b, c) => ((c.weight as number) > b ? (c.weight as number) : b), first);
  return { points, first, last, pr, change: last - first };
};

/** Every movement this athlete has repeated, most-logged first. */
export const repeatedLifts = (a: AthleteIntel) => {
  const counts: Record<string, number> = {};
  a.lifts.forEach((l) => { counts[l.lift] = (counts[l.lift] ?? 0) + 1; });
  return Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((x, y) => y[1] - x[1])
    .map(([lift]) => lift);
};

export const TRACK_ORDER = TRACKS;
