// Shared types and helpers for Practice Plan (editor) and the Gym Board.
// Plan: docs/PRACTICE_PLAN_PLAN.md

export const NLA_RED = "#bf0f3e";

/**
 * Spiritual Development is always teal, everywhere in Practice Plan — board,
 * editor and template alike. The point is that the kids learn the colour:
 * teal means the spiritual side of the week, whatever screen it's on.
 *
 * This is exactly the teal of the Smile Lab Check-In button (`bg-teal-500`),
 * so Smile Lab reads as the same thing wherever a kid meets it.
 */
export const SPIRITUAL_TEAL = "#14b8a6";

export type PracticeGroup = "battle_team" | "non_battle_team" | "littles";
export type SeasonMode = "in_season" | "off_season";
export type WeekStatus = "draft" | "published";

/**
 * The three columns. Loose labels used to split the room during practice —
 * nothing assigns a child to one, so there is no roster behind these.
 */
export const GROUPS: {
  key: PracticeGroup;
  label: string;
  blurb: string;
  accent: string;
}[] = [
  {
    key: "battle_team",
    label: "Battle Team",
    blurb: "Preparing For Competition",
    accent: "#bf0f3e",
  },
  {
    key: "non_battle_team",
    label: "Non-Battle Team",
    // The point Josh made on the whiteboard: these kids compete too, just not
    // always in the ring.
    blurb: "Boxing 101 · 5K, Obstacles, CrossFit",
    // Gold rather than a second blue — Littles are already light blue, and two
    // blues side by side read as one group from across the gym.
    accent: "#f0a500",
  },
  {
    key: "littles",
    label: "Littles",
    blurb: "Boxing 101 & Soccer",
    accent: "#3da5e8",
  },
];

export const groupLabel = (g: PracticeGroup) =>
  GROUPS.find((x) => x.key === g)?.label ?? g;

export const groupAccent = (g: PracticeGroup) =>
  GROUPS.find((x) => x.key === g)?.accent ?? "#ffffff";

/**
 * The colour of the moments the WHOLE academy shares — the team meeting that
 * opens practice, and "Chew on this…" / Bible Study that close it. One colour
 * so the room reads them as the same kind of thing: everybody together, not
 * one of the three groups.
 *
 * Teal stays reserved for Smile Lab alone.
 */
export const TOGETHER_GRAY = "#a1a1aa";

/**
 * "This differs from the template" — a week-only rename, or drift the sync can
 * put back. Violet because every other colour here already means something:
 * red / gold / light blue are the three groups, grey is everybody-together and
 * teal is Smile Lab. Amber read as Non-Battle Team's gold and was confusing.
 */
export const OFF_TEMPLATE_VIOLET = "#a78bfa";

/** Teal only for Smile Lab; the shared grey for everything else. */
export const spiritualAccent = (label: string) =>
  /smile\s*lab/i.test(label) ? SPIRITUAL_TEAL : TOGETHER_GRAY;

/**
 * A block normally wears its group's colour — except Smile Lab, which keeps
 * its own teal wherever it appears. It is the same programme the kids check
 * into, and it should look like it on the board too.
 */
export const blockAccent = (category: string, fallback: string) =>
  /smile\s*lab/i.test(category) ? SPIRITUAL_TEAL : fallback;

/**
 * One-tap blocks a coach can drop onto a single group's day from the board.
 * These live in the WEEK, not the template — added on the night, gone next
 * week unless added again.
 */
export const QUICK_BLOCKS = [
  "Run",
  "Sparring",
  "Conditioning",
  "Weights",
  "Boxing",
  "Bag Work",
  "Pad Work",
];

/**
 * What has to be dragged out before the lift starts.
 *
 * The athletes already know the day's lift — bench, squat, deadlift never
 * change. What changes is the extra work, and what that means for setup. So
 * rather than reprinting the workout, translate the exercise names into the
 * kit somebody has to move: "Dumbbell Press" means dumbbells, "Bench Press"
 * means benches, bars and plates.
 *
 * Order matters — the first rule that matches an exercise wins, so the
 * specific patterns sit above the general ones.
 */
const EQUIPMENT_RULES: { match: RegExp; items: string[] }[] = [
  { match: /kettlebell|\bkb\b/i, items: ["Kettlebells"] },
  { match: /dumbbell|\bdb\b/i, items: ["Dumbbells"] },
  { match: /med(icine)?[-\s]?ball|wall ?ball|slam ?ball/i, items: ["Medicine balls"] },
  { match: /pull[-\s]?up|chin[-\s]?up|hang|toes[-\s]?to[-\s]?bar/i, items: ["Pull-up bars"] },
  { match: /box jump|step[-\s]?up|\bbox\b/i, items: ["Boxes"] },
  { match: /battle rope|\brope\b/i, items: ["Ropes"] },
  { match: /band/i, items: ["Bands"] },
  // Bodyweight movements that would otherwise be caught by the barbell rules
  // below — an air squat needs no rack. Empty items = nothing to carry.
  {
    match: /air squat|body ?weight|push[-\s]?up|burpee|mountain climber|jumping jack|\bjog\b|\brun\b/i,
    items: [],
  },
  { match: /bench ?press|incline|floor press/i, items: ["Benches", "Barbells", "Plates"] },
  { match: /squat/i, items: ["Squat racks", "Barbells", "Plates"] },
  { match: /deadlift|romanian|\brdl\b|hip hinge/i, items: ["Barbells", "Plates"] },
  { match: /barbell|\bbar\b|clean|press|row|curl|shrug/i, items: ["Barbells", "Plates"] },
  { match: /plank|sit[-\s]?up|crunch|\bcore\b|\babs\b|mat/i, items: ["Mats"] },
];

export interface EquipmentNeed {
  item: string;
  /** The exercises that call for it, so the list explains itself. */
  forWhat: string[];
}

/**
 * Turn a day's exercise names into a de-duplicated equipment list. Anything
 * unrecognised is bodyweight as far as setup is concerned — nothing to carry.
 */
export const equipmentFor = (exercises: string[]): EquipmentNeed[] => {
  const found = new Map<string, Set<string>>();
  for (const raw of exercises) {
    const name = (raw || "").trim();
    if (!name) continue;
    const rule = EQUIPMENT_RULES.find((r) => r.match.test(name));
    if (!rule) continue;
    for (const item of rule.items) {
      if (!found.has(item)) found.set(item, new Set());
      found.get(item)!.add(name);
    }
  }
  return [...found.entries()].map(([item, forWhat]) => ({
    item,
    forWhat: [...forWhat],
  }));
};

/** 1 = Monday … 7 = Sunday, matching the weekday columns in the database. */
export const WEEKDAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
];

/** In season the week runs Mon–Fri; off season it stops at Thursday. */
export const daysFor = (season: SeasonMode) =>
  season === "off_season" ? WEEKDAYS.filter((d) => d.n <= 4) : WEEKDAYS;

export interface PracticeSettings {
  season: SeasonMode;
  /** Who runs the five-minute team meeting. */
  meeting_leader: string;
  /** "HH:MM:SS" — when practice starts. 5:15pm today, not forever. */
  start_time: string;
}

export interface TemplateBlock {
  id: string;
  group: PracticeGroup;
  weekday: number;
  position: number;
  category: string;
  /** False = paused: kept in the template but skipped when starting a week. */
  is_active?: boolean;
}

export interface SpiritualDay {
  weekday: number;
  label: string;
  leader: string | null;
  /** False = paused: kept in the template but hidden on the board. */
  is_active?: boolean;
}

export interface PracticeWeek {
  id: string;
  week_start: string;
  status: WeekStatus;
  published_at: string | null;
}

export interface PracticeBlock {
  id: string;
  week_id: string;
  group: PracticeGroup;
  weekday: number;
  position: number;
  /** Snapshotted from the template so a template change never rewrites history. */
  category: string;
  /**
   * True when this column was renamed for THIS WEEK only. Marks a deliberate
   * one-off so the template sync leaves it alone instead of "correcting" it.
   */
  category_overridden?: boolean;
  detail: string | null;
}

export interface MeetingPoints {
  id: string;
  week_id: string;
  weekday: number;
  points: string[];
}

/** The Monday on or before the given date, as YYYY-MM-DD. */
export const mondayOf = (date: Date = new Date()): string => {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // midday, so DST can't shunt us into the wrong day
  const dow = d.getDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  return toISODate(d);
};

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Today as 1–7, matching WEEKDAYS. */
export const todayWeekday = (): number => {
  const dow = new Date().getDay();
  return dow === 0 ? 7 : dow;
};

export const formatWeekRange = (weekStart: string, season: SeasonMode) => {
  const days = daysFor(season);
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${addDays(weekStart, days.length - 1)}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString(undefined, {
      month: withMonth ? "long" : undefined,
      day: "numeric",
    });
  return `${fmt(start, true)} – ${fmt(end, !sameMonth)}`;
};

export const dateForWeekday = (weekStart: string, weekday: number) =>
  addDays(weekStart, weekday - 1);

/**
 * Milliseconds until today's practice start. Negative once it has begun, which
 * the board uses to say how long practice has been underway instead of
 * counting down to a time that has passed.
 */
export const msUntilStart = (startTime: string, now: Date = new Date()) => {
  const [h, m, s] = startTime.split(":").map((n) => parseInt(n, 10));
  const target = new Date(now);
  target.setHours(h || 0, m || 0, s || 0, 0);
  return target.getTime() - now.getTime();
};

export const formatCountdown = (ms: number) => {
  const { lead, secs } = countdownParts(ms);
  return `${lead}:${secs}`;
};

/**
 * Split so the board can colour the seconds differently — they are the part
 * that moves, and on a wall-sized clock that is what the room watches.
 */
export const countdownParts = (ms: number) => {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    lead: h > 0 ? `${h}:${pad(m)}` : String(m),
    secs: pad(s),
  };
};

export const formatStartTime = (startTime: string) => {
  const [h, m] = startTime.split(":").map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
