// The two rooms the Non-Battle Team trains in, and what is in them.
//
// ONE inventory, read by the generator (sent with every call) and by the
// checks that refuse a day the room cannot run — so the two can never
// disagree about how many benches there are. Written down with Josh on
// 2026-10-03; change it here and nowhere else.
//
// The rule the inventory drives: anything with a COUNT is scarce, and a
// scarce item belongs to ONE track per block (both tracks lift at the same
// time, and both do the work block at the same time). "Shared" marks the
// exception: six racks and six benches in the boxing facility are enough for
// both tracks to lift at once. "Plenty" is anyone, any time.
import type { DayKey, Track } from "@/lib/nbt";

export type RoomKey = "performance_center" | "boxing_facility";

export type KitKey =
  | "rack" | "bench" | "bike" | "rower" | "skier" | "sled" | "box"
  | "wallBall" | "barbell" | "handWeight" | "rope" | "medBall" | "band" | "pullupBar";

export interface Kit {
  key: KitKey;
  /** How it reads in a sentence: "the squat racks". */
  label: string;
  count: number | "plenty";
  /** Both tracks may be on it in the same block. Only true where there is enough. */
  shared: boolean;
}

export interface Room {
  key: RoomKey;
  name: string;
  canRun: boolean;
  /** Longest single run, in yards. 0 where running is impossible. */
  maxYards: number;
  kit: Kit[];
}

const one = (key: KitKey, label: string, count: number): Kit => ({ key, label, count, shared: false });
const both = (key: KitKey, label: string, count: number): Kit => ({ key, label, count, shared: true });
const plenty = (key: KitKey, label: string): Kit => ({ key, label, count: "plenty", shared: true });

export const ROOMS: Record<RoomKey, Room> = {
  performance_center: {
    key: "performance_center",
    name: "Performance Center",
    canRun: true,
    maxYards: 25,
    kit: [
      one("rack", "the squat racks", 3),
      one("bench", "the benches", 3),
      one("bike", "the assault bikes", 6),
      one("rower", "the rowers", 6),
      one("skier", "the ski ergs", 2),
      one("sled", "the push sled", 1),
      one("box", "the plyo boxes", 4),
      plenty("wallBall", "the wall-ball targets"),
      plenty("barbell", "barbells and plates"),
      plenty("handWeight", "dumbbells and kettlebells"),
      plenty("rope", "jump ropes"),
      plenty("medBall", "med balls"),
      plenty("band", "bands"),
      plenty("pullupBar", "pull-up bars"),
    ],
  },
  boxing_facility: {
    key: "boxing_facility",
    name: "boxing facility",
    canRun: false,
    maxYards: 0,
    kit: [
      both("rack", "the squat racks", 6),
      both("bench", "the benches", 6),
      one("box", "the plyo boxes", 4),
      plenty("wallBall", "the wall-ball targets"),
      plenty("barbell", "barbells and plates"),
      plenty("handWeight", "dumbbells and kettlebells"),
      plenty("rope", "jump ropes"),
      plenty("medBall", "med balls"),
      plenty("band", "bands"),
      plenty("pullupBar", "pull-up bars"),
    ],
  },
};

/** Which room each training day is in. */
export const DAY_ROOM: Record<DayKey, RoomKey> = {
  monday: "performance_center",
  tuesday: "boxing_facility",
  thursday: "performance_center",
};

export const roomFor = (dayKey: DayKey): Room => ROOMS[DAY_ROOM[dayKey]];
export const kitIn = (room: Room, key: KitKey): Kit | undefined => room.kit.find((k) => k.key === key);

/** Kit that moves between rooms during prep, so a day may ask for it to be brought over. */
export const MOVABLE: KitKey[] = ["box", "handWeight"];

/** The sled's turf, for the generator: 35 ft, so pushes are up-and-back. */
export const SLED_TURF_FEET = 35;

/**
 * How a line of a session names each item. The movements that cannot be done
 * without the item count too — a back squat never says "rack" but it needs one.
 */
export const KIT_PATTERNS: Record<KitKey, RegExp> = {
  rack: /\b(?:squat|power|half)\s*racks?\b|\bracks?\b|\bback squats?\b|\bfront squats?\b|\bbarbell (?:overhead |shoulder |strict |push )?press(?:es)?\b/i,
  // A floor press needs no bench; "bench" by name, and an incline press, do.
  bench: /\bbench(?:es)?\b|\bincline (?:db |dumbbell )?press(?:es)?\b/i,
  bike: /\b(?:assault |air |echo |stationary )?bikes?\b/i,
  // "Row 500m" is the machine. "DB row", "inverted row" and "seated row" are
  // pulling exercises and must not be mistaken for it, so the bare word only
  // counts when a distance, a calorie count, a time or a pace word follows it
  // ON THE SAME LINE — the lookahead stops at a newline, or a "DB row" three
  // lines above a "2 min rest" would be read as the erg.
  rower: /\b(?:rowers?|row ergs?)\b|\brow(?:ing)?\b(?=[^.;\n]*(?:\b\d+\s*(?:m|meters?|metres?|cals?|calories?|sec|secs|seconds?|min|mins|minutes?)\b|\bpace\b))/i,
  skier: /\bski ?ergs?\b|\bskiers?\b|\bskiing\b/i,
  sled: /\bsleds?\b|\bprowlers?\b/i,
  box: /\bbox(?:es)?\b|\bstep[- ]?offs?\b|\bdepth jumps?\b/i,
  wallBall: /\bwall ?balls?\b/i,
  barbell: /\bbarbells?\b|\bbb\b/i,
  handWeight: /\b(?:dumbbells?|dbs?|kettlebells?|kbs?|goblet|farmer'?s?|suitcase)\b/i,
  rope: /\bjump ?ropes?\b|\bskipping\b|\bdouble[- ]unders?\b/i,
  medBall: /\bmed(?:icine)? ?balls?\b|\bslam ?balls?\b/i,
  band: /\bbands?\b|\bbanded\b/i,
  pullupBar: /\bpull[- ]?ups?\b|\bchin[- ]?ups?\b|\bhangs?\b|\bhanging\b|\brig\b/i,
};

/** Every kit the room does NOT have — asking for it is a refusal, not a queue. */
export const absentKit = (room: Room): KitKey[] =>
  (Object.keys(KIT_PATTERNS) as KitKey[]).filter((k) => !kitIn(room, k));

const TRACK_NAMES: Record<Track, string> = { alpha: "Alpha", bravo: "Bravo" };
export const trackName = (t: Track) => TRACK_NAMES[t];

/**
 * The room, in words, for the generator. Rebuilt from the inventory on every
 * call so the model is never working from a stale description.
 */
export const roomBrief = (dayKey: DayKey): string => {
  const room = roomFor(dayKey);
  const scarce = room.kit.filter((k) => k.count !== "plenty" && !k.shared);
  const enough = room.kit.filter((k) => k.count !== "plenty" && k.shared);
  const plentyKit = room.kit.filter((k) => k.count === "plenty");
  const absent = absentKit(room).map((k) => KIT_LABEL[k]);
  const lines = [
    `THE ROOM TODAY: the ${room.name}. ` +
      (room.canRun
        ? `Running is shuttles and down-and-backs inside ${room.maxYards} yards only.`
        : "No running of any kind — every movement stays on the spot."),
    scarce.length
      ? "SCARCE — one track per block, never both at once: " +
        scarce.map((k) => `${k.label} (${k.count})`).join(", ") + "."
      : "",
    enough.length
      ? "ENOUGH FOR BOTH TRACKS AT ONCE, taking turns in small groups: " +
        enough.map((k) => `${k.label} (${k.count})`).join(", ") + "."
      : "",
    plentyKit.length ? "PLENTY — anyone, any time: " + plentyKit.map((k) => k.label).join(", ") + "." : "",
    absent.length ? "NOT IN THIS ROOM — never write them: " + absent.join(", ") + "." : "",
    "Plyo boxes, dumbbells and kettlebells can be carried over from the other room during prep; say so in the prep when a session needs them.",
    kitIn(room, "sled") ? `The sled runs on ${SLED_TURF_FEET} ft of turf: pushes are up-and-back, one athlete at a time.` : "",
  ];
  return lines.filter(Boolean).join("\n");
};

/** Plain names for the "not in this room" list. */
const KIT_LABEL: Record<KitKey, string> = {
  rack: "squat racks", bench: "benches", bike: "bikes", rower: "rowers", skier: "ski ergs", sled: "the sled",
  box: "plyo boxes", wallBall: "wall-ball targets", barbell: "barbells", handWeight: "dumbbells and kettlebells",
  rope: "jump ropes", medBall: "med balls", band: "bands", pullupBar: "pull-up bars",
};
