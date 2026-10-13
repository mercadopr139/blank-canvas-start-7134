// The bullet text a practice block's drills are kept in.
//
// A block's `detail` is plain text, one drill per line. A line that starts
// indented, or with a dash (or *, >, •), nests under the line above — "If
// you're not coming to sparring…" owns the three drills beneath it. The Gym
// Board, the plan editor and the bullet editor all read and write that text
// through these two functions, so a week saved years ago still reads the
// same and anything typed in the editor prints the same on the wall.

export interface BulletLine {
  text: string;
  nested: boolean;
}

/** A line is nested when it is indented or carries a list marker. */
const NESTED = /^([ \t]+|\s*[-*>•])/;
/** The marker itself is stripped — it did its job. */
const MARKER = /^[-*>•]\s*/;

/** Text → lines. Blank lines are dropped: the board never prints them. */
export const parseBullets = (detail: string | null | undefined): BulletLine[] =>
  (detail ?? "")
    .split("\n")
    .map((raw) => ({ nested: NESTED.test(raw), text: raw.trim().replace(MARKER, "") }))
    .filter((l) => l.text);

/**
 * Lines → text. A nested line is written with a leading dash, which is what
 * the old Tab-to-indent box offered too: leading spaces are invisible, a dash
 * can be seen anywhere the text ends up. Nothing to say → null.
 */
export const serializeBullets = (lines: BulletLine[]): string | null => {
  const out = lines
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter((l) => l.text)
    .map((l) => (l.nested ? `- ${l.text}` : l.text))
    .join("\n");
  return out || null;
};
