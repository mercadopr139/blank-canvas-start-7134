// The Cardio Stations as moves worth a picture (Josh, 2026-10-22: one "See
// the stations" button, opened before the first whistle). A station line on
// the plan reads "Station 4 · Open Court — 10 KB swings, then baseline to
// baseline — hips snap, flat back"; this turns it into ["KB swings"].
// Counts, times and directions are dropped. The machines are named the way a
// picture library knows them (Josh, 2026-10-22: "these are kids, all six
// stations accounted for") — a kid has to learn the rower too.

export interface StationPicture { n: string; place: string; moves: string[]; /** The plan's coaching cue ("hips snap, flat back"), if any. */ cue?: string }

/** Lines that are a direction or a machine everyone knows, not a move to copy. */
const NO_PICTURE = /^(run|jog|walk|rest|recover|repeat|baseline to baseline|sideline to sideline|and back|back)$/i;
/** What a station machine is called in the picture libraries. */
const MACHINE: [RegExp, string][] = [
  [/^(row|rowing|rower|erg)$/i, "rowing machine"],
  [/^(bike|biking|cycle|cycling|stationary bike)$/i, "stationary bike"],
  [/^(assault bike|air bike|fan bike)$/i, "air bike"],
  [/^(ski|ski erg|skierg)$/i, "ski erg"],
];

/** One bullet ("12 band pull-aparts", "farmer carry, two dumbbells") as the move's name, or null. */
export const stationMove = (bullet: string): string | null => {
  let t = bullet.trim();
  t = t.replace(/^(?:and\s+)?then\s+/i, "");
  t = t.split(/,\s*|\s+—\s+|\s+-\s+/)[0];                               // "farmer carry, two dumbbells" → "farmer carry"
  t = t.replace(/^\d+\s*(?:x\s*)?(?:(?:sec|secs|seconds|s|min|mins|minutes|m|yd|yds|yards|reps?)\b\.?\s*)?/i, ""); // "12 ", "30 sec "
  t = t.replace(/\s+(?:baseline to baseline|sideline to sideline|and back|each (?:side|arm|leg)|per (?:side|arm|leg))\b.*$/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || NO_PICTURE.test(t)) return null;
  for (const [re, name] of MACHINE) if (re.test(t)) return name;
  if (t.length < 3) return null;
  return t;
};

/** Every station on the plan, with the moves to show for it, in order. */
export const stationPictures = (lines: string[]): StationPicture[] =>
  lines.slice(1).map((l, i) => {
    const m = l.match(/^Station\s+(\d)\s*·\s*([^—]+?)\s*—\s*(.*)$/);
    const place = m ? m[2].trim() : "";
    const rest = m ? m[3] : l;
    const work = rest.split(" — ")[0];
    const bullets = work.split(/,\s*(?=(?:then|repeat|and then)\b)/i).filter((x) => !/^repeat\b/i.test(x.trim()));
    const moves = [...new Set(bullets.map(stationMove).filter((x): x is string => !!x))];
    const cue = rest.split(" — ").slice(1).join(" — ").trim() || undefined;
    return { n: m ? m[1] : String(i + 1), place, moves, cue };
  });
