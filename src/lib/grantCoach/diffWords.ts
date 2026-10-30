// What changed between the answer as it stands and a draft (Josh,
// 2026-10-29: "I need the change to be amber so I can see it and approve it.
// This is like looking for a needle in a haystack"). A word-level diff:
// unchanged words, words added by the draft, words the draft removed.
export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

const tokens = (s: string) => s.replace(/\r\n/g, "\n").split(/(\s+)/).filter((t) => t.length > 0);
const isSpace = (t: string) => /^\s+$/.test(t);

/** Longest-common-subsequence diff over words; whitespace follows the word before it. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokens(before).filter((t) => !isSpace(t));
  const b = tokens(after).filter((t) => !isSpace(t));
  // The draft's own spacing (paragraph breaks) is kept by walking its raw tokens.
  const raw = tokens(after);
  const n = a.length, m = b.length;
  // LCS table (answers are a few hundred words; this stays small).
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else out.push({ kind, text });
  };
  let i = 0, j = 0, r = 0;
  /** The draft's whitespace that follows word j, so paragraphs survive. */
  const spaceAfter = () => { let s = ""; while (r < raw.length && isSpace(raw[r])) s += raw[r++]; return s; };
  const nextWord = () => { while (r < raw.length && isSpace(raw[r])) r++; r++; };
  // Leading whitespace in the draft.
  push("same", spaceAfter());
  while (i < n || j < m) {
    // A word the draft adds stays with its neighbours: when matching here or
    // skipping it gives the same alignment, the word counts as added, so an
    // inserted sentence that starts with "The" is not split at the next "The".
    if (i < n && j < m && a[i] === b[j] && !(L[i][j + 1] === L[i][j] && j + 1 < m && L[i][j + 1] > 0)) { nextWord(); push("same", b[j] + spaceAfter()); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { nextWord(); push("added", b[j] + spaceAfter()); j++; }
    else if (i < n) { push("removed", a[i] + " "); i++; }
  }
  return out;
}

/** True when the draft differs from the answer by more than whitespace. */
export const differs = (before: string, after: string) => before.replace(/\s+/g, " ").trim() !== after.replace(/\s+/g, " ").trim();
