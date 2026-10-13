// The bullet text a practice block's drills are kept in.
//
// A block's `detail` is plain text, one drill per line, up to three levels
// deep: a main bullet, a sub-bullet under it, and a sub-bullet under that
// (Josh, 2026-10-13: "another sub topic from the sub topic"). The Gym Board,
// the plan editor and the bullet editor all read and write that text through
// these functions, so a week saved years ago still reads the same and
// anything typed in the editor prints the same on the wall.
//
// On disk:   main bullet        → "Bag work"
//            sub-bullet         → "- 3 rounds"
//            sub-sub-bullet     → "  - Southpaw stance"
// Reading is forgiving: an indented line, or one with a dash / * / > / •,
// is nested; each two spaces of indent is a level deeper. So the old
// Tab-to-indent box's two-space lines still read as sub-bullets.

export const MAX_LEVEL = 2;
export type Level = 0 | 1 | 2;

export interface BulletLine {
  text: string;
  level: Level;
}

/** The marker itself is stripped — it did its job. */
const MARKER = /^[-*>•]\s*/;

/** One raw line → its text and level. Blank text means the line was empty. */
export const parseBulletLine = (raw: string): BulletLine => {
  const lead = raw.match(/^[ \t]*/)?.[0] ?? "";
  const indent = [...lead].reduce((n, c) => n + (c === "\t" ? 2 : 1), 0);
  const rest = raw.slice(lead.length);
  const marked = MARKER.test(rest);
  // A dash is one level; every two spaces before it is one more. Any
  // indent at all without a dash is at least a sub-bullet.
  const raised = marked ? 1 + Math.floor(indent / 2) : indent > 0 ? Math.max(1, Math.floor(indent / 2)) : 0;
  const level = Math.min(MAX_LEVEL, raised) as Level;
  return { level, text: rest.replace(MARKER, "").trim() };
};

/** Text → lines. Blank lines are dropped: the board never prints them. */
export const parseBullets = (detail: string | null | undefined): BulletLine[] =>
  (detail ?? "").split("\n").map(parseBulletLine).filter((l) => l.text);

/** Lines → the `string[]` the NBT plan keeps, one entry per line, nesting kept. */
export const bulletLinesOf = (detail: string | null | undefined): string[] =>
  (serializeBullets(parseBullets(detail)) ?? "").split("\n").filter(Boolean);

/**
 * Lines → text. A nested line is written with a dash, two spaces deeper per
 * level, which the old Tab-to-indent box's readers understood too: leading
 * spaces are invisible, a dash can be seen anywhere the text ends up.
 * Nothing to say → null.
 */
export const serializeBullets = (lines: BulletLine[]): string | null => {
  const out = lines
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter((l) => l.text)
    .map((l) => (l.level ? `${"  ".repeat(l.level - 1)}- ${l.text}` : l.text))
    .join("\n");
  return out || null;
};

/* ───── How each level looks — shared by the editor, the wall and the lanes ───── */

/** Each level steps in by the same amount. */
export const levelIndent = (level: Level) => `${level * 1.15}em`;

/** The dot shrinks and fades a step per level. `base` is the main bullet's size in em. */
export const levelDot = (level: Level, base: number) => ({
  size: `${(base * [1, 0.75, 0.55][level]).toFixed(3)}em`,
  opacity: [1, 0.55, 0.4][level],
});

/**
 * Main bullets bold white at full size. Each level under it is regular
 * weight, a step lighter, and a step smaller (Josh, 2026-10-13).
 */
export const levelText = (level: Level): { color: string; fontWeight: number; fontSize?: string } =>
  level === 0
    ? { color: "#ffffff", fontWeight: 600 }
    : level === 1
      ? { color: "rgba(255,255,255,0.62)", fontWeight: 400, fontSize: "0.9em" }
      : { color: "rgba(255,255,255,0.5)", fontWeight: 400, fontSize: "0.8em" };

/** What a screen reader calls a bullet of each level. */
export const levelName = (level: Level) => ["Bullet", "Sub-bullet", "Sub-sub-bullet"][level];
