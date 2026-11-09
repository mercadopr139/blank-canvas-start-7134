// What the Non-Battle Team generator is allowed to know before it writes.
//
// Three separate pieces of context, kept here because they are pure arithmetic
// over data we already hold, and because deciding what the AI sees is a
// coaching decision that deserves tests rather than a hopeful object literal
// built inline in a click handler.
//
// 1. priorWeekBrief  — the lift, and its modification, earlier in this block.
// 2. roomReport      — what the room actually managed, anonymised.
// 3. carryOver       — where the last block finished, so a month is not a reset.
//
// ONE GROUP since 2026-11-09 (Rev, through Josh): one lift for everyone, with
// an easier and a harder version. A week written for two tracks is read the
// same way — see liftOf() in nbt.ts.
//
// PRIVACY: roomReport deliberately returns counts and medians and never a name,
// a registration id, or an individual's numbers. nbt_logs names children; the
// generator is an outbound AI call and has no business knowing who anyone is.
import {
  DayKey, NbtDay, NbtLog, NbtWeek, heaviestSet, totalReps, isRoundsLine, liftOf,
} from "@/lib/nbt";
import { roomFor, absentKit, KIT_PATTERNS, type Room } from "@/lib/nbtRooms";
import { stationLines, workLines } from "@/lib/nbt";

/* ───── 1. Earlier weeks of this block ───── */

export interface PriorWeekBrief {
  week: number;
  pattern: string;
  /** "Back Squat — 4 × 5": the lift everyone did. */
  lift: string;
  /** The modification either way, so it progresses with the lift instead of being a fresh guess. */
  easier: string;
  harder: string;
  work: string;
}

const liftLine = (day: NbtDay | undefined) => {
  const l = liftOf(day);
  if (!l.name) return "—";
  return l.detail ? `${l.name} — ${l.detail}` : l.name;
};

/** A week of this block, described for the model: the lift and how it was modified. */
export const priorWeekBrief = (week: NbtWeek, dayKey: DayKey): PriorWeekBrief | null => {
  const day = week.days?.[dayKey];
  if (!day) return null;
  const work = [day.work?.title, day.work?.emphasis].filter(Boolean).join(" — ");
  const l = liftOf(day);
  return {
    week: week.week_in_block,
    pattern: day.lift?.pattern ?? "",
    lift: liftLine(day),
    easier: l.easier || "—",
    harder: l.harder || "—",
    work: work || "—",
  };
};

/**
 * A day as the generator writes it, for handing one back to be partly
 * rewritten. A day written for two tracks goes over in the one-group shape.
 */
export const dayForModel = (day: NbtDay) => {
  const l = liftOf(day);
  return {
    focus: day.focus ?? "",
    prep: day.prep ?? [],
    lift: {
      pattern: day.lift?.pattern ?? "",
      main: { name: l.name, detail: l.detail },
      easier: l.easier,
      harder: l.harder,
      cues: day.lift?.cues ?? [],
    },
    work: {
      emphasis: day.work?.emphasis ?? "",
      stations: workLines(day),
      result_unit: day.work?.result_unit ?? "rounds",
    },
    reset: day.reset ?? [],
  };
};

export const priorWeekBriefs = (weeks: NbtWeek[], dayKey: DayKey, beforeWeekNo: number) =>
  weeks
    .filter((w) => w.week_in_block < beforeWeekNo)
    .sort((a, b) => a.week_in_block - b.week_in_block)
    .map((w) => priorWeekBrief(w, dayKey))
    .filter((b): b is PriorWeekBrief => b !== null);

/* ───── 2. What the room actually did ───── */

export interface RoomReport {
  sessions: number;
  lastDate: string;
  athletes: number;
  /** The movement most of the room logged, so the model can see what stuck. */
  lift: string | null;
  medianTopWeight: number | null;
  medianReps: number | null;
  medianWork: number | null;
  unit: string | null;
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

  // One group: every log in the window counts together, whatever track an
  // older row was filed under.
  const weights = inWindow.map((l) => heaviestSet(l.sets ?? [])).filter((w): w is number => w != null);
  const reps = inWindow.map((l) => totalReps(l.sets ?? [])).filter((n) => n > 0);
  const results = inWindow.map((l) => l.work_result).filter((n): n is number => n != null);

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
    lift: commonest(inWindow.map((l) => l.lift ?? "")),
    medianTopWeight: median(weights),
    medianReps: median(reps),
    medianWork: median(results.map(Number)),
    unit: commonest(inWindow.map((l) => l.work_unit ?? "")),
    workTrend,
    thin: athletes < THIN_ROOM,
  };
};

/* ───── 3. The room ─────
   Which room a day is in, and what that room allows, lives in nbtRooms.ts.
   Re-exported here so older callers and tests keep one name for it. */
export type Facility = Room;
export const FACILITY: Partial<Record<DayKey, Facility>> = {
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

/** The lift as written: its name, its dose, and the modification either way. */
const liftLines = (day: NbtDay): string[] => {
  const l = liftOf(day);
  return [l.name, l.detail, l.easier, l.harder];
};

/** What the group actually does: the lift, its modification, and the work block. */
const sessionLines = (day: NbtDay): string[] => [...liftLines(day), ...workLines(day)];

/** Every line of a day a coach or athlete would actually read. */
const linesOf = (day: NbtDay): string[] => [
  day.focus ?? "",
  ...(day.prep ?? []),
  day.lift?.pattern ?? "",
  ...sessionLines(day),
  ...(day.lift?.cues ?? []),
  day.work?.title ?? "",
  day.work?.emphasis ?? "",
  ...(day.reset ?? []),
];

/**
 * Why this session cannot be done in the room it is scheduled for, or null.
 *
 * The message is written to be read by a coach in a toast, not parsed.
 */
export const spaceViolation = (day: NbtDay, dayKey: DayKey): string | null => {
  const room = FACILITY[dayKey];
  if (!room) return null;
  const lines = linesOf(day).filter(Boolean);

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

/* ───── 4. The room's equipment ─────
   One group of about a dozen shares the room, so the counted kit — three racks,
   six bikes — is shared in turns and there is no clash between groups to
   refuse. What is still refused is kit the room does not have at all. The
   inventory is nbtRooms.ts. */

/** The work block is the Cardio Stations — one block for the room. */
export const isStations = (day: NbtDay) => stationLines(day).length > 0;

/**
 * Kit the room does not have, named in the lift, its modification or the
 * stations, or null. Tuesday's bikes and rowers are the usual culprit: they
 * live in the Performance Center with the Junior Boxers.
 */
export const missingKit = (day: NbtDay, dayKey: DayKey): string | null => {
  const room = roomFor(dayKey);
  const lines = sessionLines(day);
  for (const key of absentKit(room)) {
    const bad = lines.find((l) => KIT_PATTERNS[key].test(l));
    if (bad) {
      return (
        `There are no ${KIT_WORDS[key]} in the ${room.name}, but the session says "${bad.trim()}". ` +
        "Use only what this room has."
      );
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
   sloppy in its circuit — it does hip bridges, swings, single-leg deadlifts. */

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
 * The station that repeats the lift, or null.
 *
 * A bare "row" is the one movement that is also the name of a machine, so a
 * rowing-exercise lift is not counted as repeated by "Row 250m" — the rower
 * pattern above already knows how to tell them apart.
 */
export const liftRepeated = (day: NbtDay): string | null => {
  const lift = liftOf(day).name;
  if (!lift) return null;
  const lines = workLines(day);
  for (const movement of coreMovements(lift)) {
    const re = new RegExp(`\\b${escapeRe(movement)}\\b`);
    const hit = lines.find((line) => {
      if (!re.test(normalise(line))) return false;
      // The rowing machine is not the rowing exercise.
      if (movement === "row" && KIT_PATTERNS.rower.test(line)) return false;
      return true;
    });
    if (hit) {
      return (
        `The stations repeat the lift: the lift is "${lift}" and a station says "${hit.trim()}". ` +
        "Keep the same movement pattern on the station but use a different, simpler movement — the lift is " +
        "for quality reps under load, the stations are the pattern under fatigue."
      );
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
  for (const line of workLines(day)) {
    if (HEADER_LINE.test(line)) {
      return (
        `The work block has a heading with nothing on it: "${line.trim()}". Every line must be complete on ` +
        "its own — the movement, then the reps, then the effort, all on ONE line. " +
        'Write it like "Station 3 · The Bikes — bike — strong but repeatable".'
      );
    }
    if (TIME_FIRST.test(line) && !isRoundsLine(line)) {
      return (
        `The work block has a line that starts with a time and no movement: "${line.trim()}". Put the ` +
        'movement first, then the count, then the effort, on one line: "Row — 250 m — controlled pace".'
      );
    }
  }
  return null;
};

/* ───── 4b. On the court, distance is said in court ─────
   A kid can see a baseline; nobody can see 20 metres. On Performance Center
   days a carry, walk, lunge or shuttle is written "baseline to baseline",
   "sideline to sideline", "half court and back" — never a number of metres
   or yards. Machine lines (rower, bike, ski erg) keep their metres, because
   that is what the screen on the machine shows. (Josh, 2026-10-03.) */

const FLOOR_DISTANCE = /\b\d+(?:\.\d+)?\s*(?:m|meters?|metres?|yards?|yds?|ft|feet)\b/i;
const MACHINE_LINE = /\b(?:rowers?|row ergs?|ski ?ergs?|skiers?|bikes?)\b|\brow(?:ing)?\b/i;

export const courtLanguage = (day: NbtDay, dayKey: DayKey): string | null => {
  if (!roomFor(dayKey).canRun) return null;
  const bad = sessionLines(day).find((l) => FLOOR_DISTANCE.test(l) && !MACHINE_LINE.test(l));
  if (bad) {
    return (
      `On the court, say distance in court, not in metres or yards — the session says "${bad.trim()}". ` +
      "Write it as baseline to baseline (75 ft), baseline to baseline and back (150 ft), sideline to sideline (56 ft), or sideline to sideline and back (112 ft)."
    );
  }
  return null;
};

/**
 * One direction of travel per day (Josh, 2026-10-21). A station running
 * baseline to baseline crosses a station running sideline to sideline, head
 * on, in the middle of the court. So on any one day every moving station
 * travels the same way: all baseline to baseline, or all sideline to
 * sideline. On-the-spot stations are fine either way.
 */
const BASELINE = /\bbaseline to baseline\b/i;
const SIDELINE = /\bsideline to sideline\b/i;
export const courtAxisClash = (day: NbtDay): string | null => {
  const lines = workLines(day);
  const along = lines.filter((l) => BASELINE.test(l));
  const across = lines.filter((l) => SIDELINE.test(l));
  if (along.length && across.length) {
    return (
      "The stations run both ways across the court — baseline to baseline and sideline to sideline on the same " +
      "day — and those paths meet head on in the middle. Pick ONE direction for every moving station today: " +
      "all baseline to baseline, or all sideline to sideline. On-the-spot stations are fine either way."
    );
  }
  return null;
};

/** Everything wrong with a generated day, or null. The room, the kit, the court, the repeat, then the reading. */
export const dayProblem = (day: NbtDay, dayKey: DayKey): string | null =>
  spaceViolation(day, dayKey) ??
  missingKit(day, dayKey) ??
  courtAxisClash(day) ??
  courtLanguage(day, dayKey) ??
  liftRepeated(day) ??
  unreadableLine(day);

/* ───── 5. Where the last block finished ───── */

export interface CarryOver {
  weekStart: string;
  pattern: string;
  lift: string;
  easier: string;
  harder: string;
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
    lift: brief.lift,
    easier: brief.easier,
    harder: brief.harder,
    work: brief.work,
    weeksOnPattern,
  };
};
