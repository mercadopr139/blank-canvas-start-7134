// What the Non-Battle Team generator is allowed to know before it writes.
//
// Three separate pieces of context, kept here because they are pure arithmetic
// over data we already hold, and because deciding what the AI sees is a
// coaching decision that deserves tests rather than a hopeful object literal
// built inline in a click handler.
//
// 1. priorWeekBrief  — what ALL THREE tracks did earlier in this block.
// 2. roomReport      — what the room actually managed, anonymised.
// 3. carryOver       — where the last block finished, so a month is not a reset.
//
// PRIVACY: roomReport deliberately returns counts and medians and never a name,
// a registration id, or an individual's numbers. nbt_logs names children; the
// generator is an outbound AI call and has no business knowing who anyone is.
import { DayKey, NbtDay, NbtLog, NbtWeek, Track, TRACKS, heaviestSet, totalReps } from "@/lib/nbt";

/* ───── 1. Earlier weeks of this block ───── */

export interface PriorWeekBrief {
  week: number;
  pattern: string;
  /** "Goblet Squat — 3 × 8", per track, so continuity is not anchored to Alpha. */
  charlie: string;
  bravo: string;
  alpha: string;
  work: string;
}

const movementLine = (day: NbtDay | undefined, track: Track) => {
  const m = day?.lift?.[track];
  if (!m?.name) return "—";
  return m.detail ? `${m.name} — ${m.detail}` : m.name;
};

/**
 * A week of this block, described for the model.
 *
 * All three tracks, not just Alpha. Sending Alpha alone made Charlie's month a
 * fresh guess every week, which is exactly backwards: the beginners are the
 * group that needs the repetition most.
 */
export const priorWeekBrief = (week: NbtWeek, dayKey: DayKey): PriorWeekBrief | null => {
  const day = week.days?.[dayKey];
  if (!day) return null;
  const work = [day.work?.title, day.work?.emphasis].filter(Boolean).join(" — ");
  return {
    week: week.week_in_block,
    pattern: day.lift?.pattern ?? "",
    charlie: movementLine(day, "charlie"),
    bravo: movementLine(day, "bravo"),
    alpha: movementLine(day, "alpha"),
    work: work || "—",
  };
};

export const priorWeekBriefs = (weeks: NbtWeek[], dayKey: DayKey, beforeWeekNo: number) =>
  weeks
    .filter((w) => w.week_in_block < beforeWeekNo)
    .sort((a, b) => a.week_in_block - b.week_in_block)
    .map((w) => priorWeekBrief(w, dayKey))
    .filter((b): b is PriorWeekBrief => b !== null);

/* ───── 2. What the room actually did ───── */

export interface TrackReport {
  athletes: number;
  /** The movement most of this track logged, so the model can see what stuck. */
  lift: string | null;
  medianTopWeight: number | null;
  medianReps: number | null;
  medianWork: number | null;
  unit: string | null;
}

export interface RoomReport {
  sessions: number;
  lastDate: string;
  athletes: number;
  byTrack: Record<Track, TrackReport>;
  /** Circuit result, oldest session in the window vs newest. Null if incomparable. */
  workTrend: "up" | "flat" | "down" | null;
  /**
   * True when there is too little here to autoregulate from. The model is told
   * to fall back to conservative calendar progression rather than invent a
   * response to three data points.
   */
  thin: boolean;
}

/** Below this, the room is not evidence — it is anecdote. */
export const THIN_ROOM = 3;

/** How many past sessions of a day we look back over. */
export const ROOM_WINDOW = 3;

const median = (ns: number[]): number | null => {
  const v = ns.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  const m = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(m * 10) / 10;
};

const commonest = (xs: string[]): string | null => {
  const counts: Record<string, number> = {};
  xs.filter(Boolean).forEach((x) => {
    counts[x] = (counts[x] ?? 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? null;
};

/** Units where a smaller number is the better result. */
const LOWER_IS_BETTER = new Set(["seconds", "minutes"]);

const emptyTrack = (): TrackReport => ({
  athletes: 0,
  lift: null,
  medianTopWeight: null,
  medianReps: null,
  medianWork: null,
  unit: null,
});

/**
 * The last few sessions of one training day, summarised and stripped of names.
 *
 * Looks across blocks on purpose: when October is written in September, the only
 * evidence that exists is September's. Restricting the window to the block being
 * built would mean the generator never saw a single log.
 */
export const roomReport = (
  logs: NbtLog[],
  dayKey: DayKey,
  today: string,
  window = ROOM_WINDOW
): RoomReport | null => {
  const mine = logs.filter(
    (l) =>
      l.day_key === dayKey &&
      l.workout_date <= today &&
      (l.sets?.some((s) => s.weight != null || s.reps != null) || l.work_result != null)
  );
  if (mine.length === 0) return null;

  const dates = Array.from(new Set(mine.map((l) => l.workout_date))).sort().slice(-window);
  const inWindow = mine.filter((l) => dates.includes(l.workout_date));

  const byTrack = {} as Record<Track, TrackReport>;
  TRACKS.forEach((t) => {
    const rows = inWindow.filter((l) => l.level === t);
    if (rows.length === 0) {
      byTrack[t] = emptyTrack();
      return;
    }
    const weights = rows.map((l) => heaviestSet(l.sets ?? [])).filter((w): w is number => w != null);
    const reps = rows.map((l) => totalReps(l.sets ?? [])).filter((n) => n > 0);
    const results = rows.map((l) => l.work_result).filter((n): n is number => n != null);
    byTrack[t] = {
      athletes: new Set(rows.map((l) => l.registration_id ?? l.athlete_name)).size,
      lift: commonest(rows.map((l) => l.lift ?? "")),
      medianTopWeight: median(weights),
      medianReps: median(reps),
      medianWork: median(results.map(Number)),
      unit: commonest(rows.map((l) => l.work_unit ?? "")),
    };
  });

  // Trend on the circuit, only where the unit held steady across the window —
  // comparing rounds of one workout to metres of another would invent a result.
  let workTrend: RoomReport["workTrend"] = null;
  if (dates.length >= 2) {
    const at = (d: string) => {
      const rows = inWindow.filter((l) => l.workout_date === d && l.work_result != null);
      return {
        value: median(rows.map((l) => Number(l.work_result))),
        unit: commonest(rows.map((l) => l.work_unit ?? "")),
      };
    };
    const first = at(dates[0]);
    const last = at(dates[dates.length - 1]);
    if (first.value != null && last.value != null && first.unit && first.unit === last.unit) {
      const better = LOWER_IS_BETTER.has(first.unit)
        ? last.value < first.value
        : last.value > first.value;
      workTrend = last.value === first.value ? "flat" : better ? "up" : "down";
    }
  }

  const athletes = new Set(inWindow.map((l) => l.registration_id ?? l.athlete_name)).size;
  return {
    sessions: dates.length,
    lastDate: dates[dates.length - 1],
    athletes,
    byTrack,
    workTrend,
    thin: athletes < THIN_ROOM,
  };
};

/* ───── 3. Where the last block finished ───── */

export interface CarryOver {
  weekStart: string;
  pattern: string;
  charlie: string;
  bravo: string;
  alpha: string;
  work: string;
  /** Consecutive weeks that pattern has now been trained. Drives "time to advance". */
  weeksOnPattern: number;
}

/**
 * The last written week of the PREVIOUS block, for this day.
 *
 * Without it every month restarted from scratch: four good weeks of building a
 * squat, then a clean slate and a fresh movement. Strength does not work on a
 * calendar month, so week 1 of a new block is handed where the last one ended
 * and told to continue rather than reset.
 */
export const carryOver = (prevWeeks: NbtWeek[], dayKey: DayKey): CarryOver | null => {
  const written = prevWeeks
    .filter((w) => w.days?.[dayKey]?.lift?.pattern)
    .sort((a, b) => a.week_in_block - b.week_in_block);
  if (written.length === 0) return null;

  const last = written[written.length - 1];
  const brief = priorWeekBrief(last, dayKey);
  if (!brief) return null;

  // How long this pattern has run without interruption, counting back.
  let weeksOnPattern = 0;
  for (let i = written.length - 1; i >= 0; i--) {
    if (written[i].days?.[dayKey]?.lift?.pattern === brief.pattern) weeksOnPattern += 1;
    else break;
  }

  return {
    weekStart: last.week_start,
    pattern: brief.pattern,
    charlie: brief.charlie,
    bravo: brief.bravo,
    alpha: brief.alpha,
    work: brief.work,
    weeksOnPattern,
  };
};
