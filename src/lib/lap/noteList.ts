// A checklist line's note as a running list (Josh, 2026-10-20: "the
// notepad becomes a real tool"). Items are crossed off and stay crossed off
// week to week — unlike the line's own tick, which resets every lap.
//
// Stored as plain text in lap_checklist_items.note, one item per line, so a
// note written as prose before today reads as items with nothing to change:
//   "Fix the back door latch"            an open item
//   "[x] Order mats"                     a done item
//   "  Call Jim about the quote"         nested under the item above
// Nothing inside a note can carry its own note, links or files — the
// checklist stays two levels.

export interface NoteItem {
  text: string;
  done: boolean;
  /** 0 = top level, 1 = nested under the item above. Never deeper. */
  level: 0 | 1;
}

const DONE = /^\[x\]\s?/i;

export const parseNote = (note: string | null | undefined): NoteItem[] =>
  (note ?? "")
    .split("\n")
    .map((raw) => {
      let s = raw.replace(/\r$/, "");
      const level: 0 | 1 = /^(\s{2,}|\t|-\s)/.test(s) ? 1 : 0;
      s = s.replace(/^(\s+|-\s+)/, "");
      const done = DONE.test(s);
      s = s.replace(DONE, "").trim();
      return { text: s, done, level };
    })
    .filter((i) => i.text.length > 0);

export const serializeNote = (items: NoteItem[]): string | null => {
  const lines = items.filter((i) => i.text.trim()).map((i) => `${i.level ? "  " : ""}${i.done ? "[x] " : ""}${i.text.trim()}`);
  return lines.length ? lines.join("\n") : null;
};

/** Open items first, in their order; done items after, in theirs. Nesting follows its parent. */
export const orderForDisplay = (items: NoteItem[]): NoteItem[] => {
  // Group each top-level item with the nested items under it, then sort groups by done.
  const groups: NoteItem[][] = [];
  for (const i of items) {
    if (i.level === 1 && groups.length) groups[groups.length - 1].push(i);
    else groups.push([i]);
  }
  const open = groups.filter((g) => !g[0].done);
  const done = groups.filter((g) => g[0].done);
  return [...open, ...done].flat();
};

export const toggleItem = (items: NoteItem[], index: number): NoteItem[] =>
  items.map((i, n) => (n === index ? { ...i, done: !i.done } : i));

export const setItemText = (items: NoteItem[], index: number, text: string): NoteItem[] =>
  items.map((i, n) => (n === index ? { ...i, text } : i)).filter((i) => i.text.trim().length > 0);

export const setItemLevel = (items: NoteItem[], index: number, level: 0 | 1): NoteItem[] =>
  // The first item has nothing above it to nest under.
  items.map((i, n) => (n === index ? { ...i, level: n === 0 ? 0 : level } : i));

export const addItem = (items: NoteItem[], text: string, after?: number): NoteItem[] => {
  const t = text.trim();
  if (!t) return items;
  const item: NoteItem = { text: t, done: false, level: 0 };
  if (after === undefined || after >= items.length - 1) return [...items, item];
  return [...items.slice(0, after + 1), { ...item, level: items[after].level }, ...items.slice(after + 1)];
};

export const removeItem = (items: NoteItem[], index: number): NoteItem[] => items.filter((_, n) => n !== index);

export const clearDone = (items: NoteItem[]): NoteItem[] => items.filter((i) => !i.done);

export const countOpen = (items: NoteItem[]) => items.filter((i) => !i.done).length;
