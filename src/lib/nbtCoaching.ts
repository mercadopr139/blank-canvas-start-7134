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
import {
  DayKey, NbtDay, NbtLog, NbtWeek, Track, TRACKS, heaviestSet, totalReps, isRoundsLine,
} from "@/lib/nbt";
import { roomFor, absentKit, KIT_PATTERNS, trackName, type Room } from "@/lib/nbtRooms";

/* ───── 1. Earlier weeks of this block ───── */

export interface PriorWeekBrief {
  week: number;
  pattern: string;
  /** "Goblet Squat — 3 × 8", per track, so continuity is not anchored to Alpha. */
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
 * Both tracks, not just Alpha. Sending Alpha alone made Bravo's month a
 * fresh guess every week, which is exactly backwards: the newer athletes are
 * the group that needs the repetition most.
 */
export const priorWeekBrief = (week: NbtWeek, dayKey: DayKey): PriorWeekBrief | null => {
  const day = week.days?.[dayKey];
  if (!day) return null;
  const work = [day.work?.title, day.work?.emphasis].filter(Boolean).join(" — ");
  return {
    week: week.week_in_block,
    pattern: day.lift?.pattern ?? "",
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

/* ───── 3. The room ─────
   Which room a day is in, and what that room allows, lives in nbtRooms.ts.
   Re-exported here so older callers and tests keep one name for it. */
export type Facility = Room;
export const FACILITY: Record<DayKey, Facility> = {
  monday: roomFor("monday"),
  tuesday: roomFor("tuesday"),
  thursday: roomFor("thursday"),
};

/**
 * Anything that needs floor to cover.
 *
 * "running clock" and "run through" are excluded deliberately — both are normal
 * gym language for something done standing still, and refusing them would fail
 * good Tuesday sessions.
 */
const TRAVELS = /\b(?:jogs?|jogging|laps?|shuttles?|suicides?)\b|\brun(?:s|ning)?\b(?!\s+(?:clock|through))/i;

/** A run word, for the days where running is allowed but bounded. */
const RUN_WORD = /\b(?:runs?|running|jogs?|jogging|sprints?)\b/i;
const LAPS = /\blaps?\b/i;

const YARDS_PER: Record<string, number> = { m: 1.09361, yd: 1, mi: 1760 };

/** Every distance on a line, converted to yards. */
const distancesInYards = (line: string): number[] => {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(meters?|metres?|yards?|yds?|miles?|m|yd|mi)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const unit = m[2].toLowerCase();
    const key = unit.startsWith("mi") ? "mi" : unit.startsWith("y") ? "yd" : "m";
    out.push(Number(m[1]) * YARDS_PER[key]);
  }
  return out;
};

/**
 * Every line of a day a coach or athlete would actually read.
 *
 * Narrowed to one track when only that track is being rewritten: a day written
 * before these rules existed still has running in the tracks nobody touched,
 * and refusing a good new Bravo because of an old Alpha would make the day
 * impossible to fix one track at a time.
 */
const linesOf = (day: NbtDay, only?: Track): string[] => {
  const tracks = only ? [only] : (["bravo", "alpha"] as Track[]);
  const perTrack = tracks.flatMap((t) => [
    day.lift?.[t]?.name ?? "",
    day.lift?.[t]?.detail ?? "",
    ...(day.work?.[t] ?? []),
  ]);
  if (only) return perTrack;
  return [
    day.focus ?? "",
    ...(day.prep ?? []),
    day.lift?.pattern ?? "",
    ...perTrack,
    ...(day.lift?.cues ?? []),
    day.work?.title ?? "",
    day.work?.emphasis ?? "",
    ...(day.reset ?? []),
  ];
};

/**
 * Why this session cannot be done in the room it is scheduled for, or null.
 *
 * The message is written to be read by a coach in a toast, not parsed.
 */
export const spaceViolation = (day: NbtDay, dayKey: DayKey, only?: Track): string | null => {
  const room = FACILITY[dayKey];
  if (!room) return null;
  const lines = linesOf(day, only).filter(Boolean);

  if (!room.canRun) {
    const bad = lines.find((l) => TRAVELS.test(l));
    return bad
      ? `There is no room to run in the ${room.name}, but the session says "${bad.trim()}".`
      : null;
  }

  for (const line of lines) {
    if (LAPS.test(line)) {
      return `The court is ${room.maxYards} yards end to end, so there are no laps to run — the session says "${line.trim()}".`;
    }
    if (!RUN_WORD.test(line)) continue;
    const tooFar = distancesInYards(line).find((y) => y > room.maxYards);
    if (tooFar != null) {
      return `The court only allows ${room.maxYards} yards in one direction, but the session says "${line.trim()}".`;
    }
  }
  return null;
};

/* ───── 4. Shared equipment ─────
   Both tracks train at the same time in the same room, with anywhere between
   15 and 40 athletes on the floor. Anything the room has a COUNT of is scarce,
   and a scarce item belongs to one track per block — both tracks lift at the
   same time, and both do the work block at the same time. An item the room
   does not have at all is a refusal, not a queue. The inventory, and which
   items the room has enough of for both, is nbtRooms.ts.

   Only unambiguous collisions are refused. A guard that fires on a maybe would
   fail whole months and leave a coach with nothing, which is worse than one
   shared bench. */

const liftText = (day: NbtDay, track: Track) =>
  [day.lift?.[track]?.name ?? "", day.lift?.[track]?.detail ?? ""].join(" \n ");
const workText = (day: NbtDay, track: Track) => (day.work?.[track] ?? []).join(" \n ");

const bothNames = (users: Track[]) => users.map(trackName).join(" and ");

/**
 * Which scarce item both tracks have been sent to in the same block, or null.
 *
 * Checked on the whole day even when only one track is being rewritten: the
 * new track has to fit around the one that is staying, which is precisely the
 * thing being asked. Defaults to the Performance Center's rules when no day
 * is given, which is the stricter room.
 */
export const equipmentClash = (day: NbtDay, dayKey: DayKey = "monday"): string | null => {
  const room = roomFor(dayKey);
  for (const kit of room.kit) {
    if (kit.shared) continue;
    const re = KIT_PATTERNS[kit.key];
    for (const [block, textOf] of [["lift", liftText], ["work", workText]] as const) {
      const users = TRACKS.filter((t) => re.test(textOf(day, t)));
      if (users.length > 1) {
        // Read by a coach in a toast AND fed back to the model on retry, so it
        // has to say how to fix it, not just that it is wrong.
        return (
          `${bothNames(users)} are both on ${kit.label} in the ${block} block, and the ${room.name} only has ${kit.count}. ` +
          "A scarce item belongs to one track per block: give the other track a version of the same " +
          "pattern that needs none of it — the floor, a different machine, bodyweight, bands, med balls, " +
          "wall balls, or dumbbells and kettlebells, which there are plenty of."
        );
      }
    }
  }
  return null;
};

/**
 * Kit the room does not have, named anywhere in a track's session, or null.
 * Tuesday's bikes and rowers are the usual culprit: they live in the
 * Performance Center with the Junior Boxers.
 */
export const missingKit = (day: NbtDay, dayKey: DayKey, only?: Track): string | null => {
  const room = roomFor(dayKey);
  const tracks = only ? [only] : [...TRACKS];
  for (const key of absentKit(room)) {
    const re = KIT_PATTERNS[key];
    for (const t of tracks) {
      const lines = [day.lift?.[t]?.name ?? "", day.lift?.[t]?.detail ?? "", ...(day.work?.[t] ?? [])];
      const bad = lines.find((l) => re.test(l));
      if (bad) {
        return (
          `There are no ${KIT_WORDS[key]} in the ${room.name}, but ${trackName(t)}'s session says "${bad.trim()}". ` +
          "Use only what this room has."
        );
      }
    }
  }
  return null;
};

const KIT_WORDS: Record<string, string> = {
  rack: "squat racks", bench: "benches", bike: "bikes", rower: "rowers", skier: "ski ergs", sled: "sleds",
  box: "plyo boxes", wallBall: "wall-ball targets", barbell: "barbells", handWeight: "dumbbells or kettlebells",
  rope: "jump ropes", medBall: "med balls", band: "bands", pullupBar: "pull-up bars",
};

/* ───── 5. The conditioning never repeats the lift ─────
   The lift block is quality reps under load; the work block is the same
   PATTERN under fatigue with a different, simpler movement. A track that just
   did 4 × 8 Romanian deadlift does not do Romanian deadlifts again tired and
   sloppy in its circuit — it does hip bridges, swings, single-leg deadlifts.

   Per track. Bravo's goblet-squat lift means Bravo's circuit has no goblet
   squats; Alpha's still may. */

/**
 * Words that describe HOW a movement is loaded or positioned, not WHAT it is.
 * Stripped before comparing, so "Heavy Goblet Squat" and "goblet squat" and
 * "Goblet squats (moderate DB)" are all the same movement.
 */
const MODIFIERS = new Set([
  "barbell", "bb", "dumbbell", "dumbbells", "db", "kettlebell", "kettlebells", "kb",
  "band", "banded", "bodyweight", "bw", "weighted", "loaded",
  "heavy", "heavier", "light", "lighter", "moderate", "medium",
  "standing", "seated", "kneeling", "half", "tall", "tempo", "paused", "pause", "slow",
  "supported", "assisted", "elevated", "strict",
  // Angles and regressions of the same movement, not different movements.
  "incline", "decline", "knee", "wall",
]);

/** Spellings that mean the same movement. Applied after lowercasing. */
const ALIASES: Array<[RegExp, string]> = [
  [/\brdls?\b/g, "romanian deadlift"],
  [/\bohp\b/g, "overhead press"],
  [/\bpush[\s-]?ups?\b/g, "push up"],
  [/\bpull[\s-]?ups?\b/g, "pull up"],
  [/\bchin[\s-]?ups?\b/g, "chin up"],
  [/\bstep[\s-]?ups?\b/g, "step up"],
  [/\bsit[\s-]?ups?\b/g, "sit up"],
  [/\bsl\b/g, "single leg"],
  [/\bsingle[\s-]leg\b/g, "single leg"],
  [/\bone[\s-]leg\b/g, "single leg"],
  [/\b1[\s-]leg\b/g, "single leg"],
];

/** Lowercase, aliases applied, hyphens to spaces, simple plurals dropped. */
const normalise = (s: string) => {
  let t = s.toLowerCase().replace(/[()\[\],:;/]/g, " ").replace(/[-–—]/g, " ");
  ALIASES.forEach(([re, to]) => { t = t.replace(re, to); });
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");
};

/**
 * The movement(s) a lift actually is, with the loading stripped off.
 *
 * "Barbell RDL + Barbell Row" is two movements; "Heavy Goblet Squat" is one,
 * "goblet squat". Anything that strips down to nothing — a lift called just
 * "Heavy" — is ignored rather than matched against everything.
 */
const coreMovements = (liftName: string): string[] =>
  liftName
    .split(/\s*[+&]\s*|\s+or\s+/i)
    .map((part) =>
      normalise(part)
        .split(" ")
        .filter((w) => !MODIFIERS.has(w))
        .join(" ")
        .trim()
    )
    .filter((m) => m.length > 0);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Which track's circuit repeats its own lift, or null.
 *
 * A bare "row" is the one movement that is also the name of a machine, so a
 * rowing-exercise lift is not counted as repeated by "Row 250m" — the rower
 * pattern above already knows how to tell them apart.
 */
export const liftRepeated = (day: NbtDay): string | null => {
  for (const t of TRACKS) {
    const lift = day.lift?.[t]?.name ?? "";
    if (!lift) continue;
    const lines = day.work?.[t] ?? [];
    for (const movement of coreMovements(lift)) {
      const re = new RegExp(`\\b${escapeRe(movement)}\\b`);
      const hit = lines.find((line) => {
        if (!re.test(normalise(line))) return false;
        // The rowing machine is not the rowing exercise.
        if (movement === "row" && KIT_PATTERNS.rower.test(line)) return false;
        return true;
      });
      if (hit) {
        const name = t[0].toUpperCase() + t.slice(1);
        return (
          `${name}'s circuit repeats its lift: the lift is "${lift}" and the circuit says "${hit.trim()}". ` +
          "Keep the same movement pattern in the circuit but use a different, simpler movement — the lift is " +
          "for quality reps under load, the circuit is the pattern under fatigue."
        );
      }
    }
  }
  return null;
};

/* ───── 6. Lines a youth can read ─────
   Every circuit line must stand on its own: the movement, then the time or
   reps, then the effort. A heading with nothing on it ("Bike station:") or a
   line that opens with a time and no movement (":30 strong effort") is half a
   line, and half-lines are what the room asks a hundred questions about. */

const HEADER_LINE = /:\s*$/;
/** A line whose first thing is a duration, a distance or a calorie count. */
const TIME_FIRST =
  /^\s*(?::\d{1,2}\b|\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds?|min|mins|minutes?|m|meters?|metres?|cal|cals|calories?)\b)/i;

export const unreadableLine = (day: NbtDay): string | null => {
  for (const t of TRACKS) {
    const name = t[0].toUpperCase() + t.slice(1);
    for (const line of day.work?.[t] ?? []) {
      if (HEADER_LINE.test(line)) {
        return (
          `${name}'s circuit has a heading with nothing on it: "${line.trim()}". Every line must be complete on ` +
          "its own — the movement, then the time or reps, then the effort, all on ONE line. " +
          'Write it like "Assault bike — 30 sec — strong but repeatable".'
        );
      }
      if (TIME_FIRST.test(line) && !isRoundsLine(line)) {
        return (
          `${name}'s circuit has a line that starts with a time and no movement: "${line.trim()}". Put the ` +
          'movement first, then the time, then the effort, on one line: "Row — 250 m — controlled pace".'
        );
      }
    }
  }
  return null;
};

/** Everything wrong with a generated day, or null. The room, the kit, the repeat, then the reading. */
export const dayProblem = (day: NbtDay, dayKey: DayKey, only?: Track): string | null =>
  spaceViolation(day, dayKey, only) ??
  missingKit(day, dayKey, only) ??
  equipmentClash(day, dayKey) ??
  liftRepeated(day) ??
  unreadableLine(day);

/* ───── 5. Where the last block finished ───── */

export interface CarryOver {
  weekStart: string;
  pattern: string;
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
    bravo: brief.bravo,
    alpha: brief.alpha,
    work: brief.work,
    weeksOnPattern,
  };
};
