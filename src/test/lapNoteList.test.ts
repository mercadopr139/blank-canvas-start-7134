import { describe, it, expect } from "vitest";
import { parseNote, serializeNote, orderForDisplay, toggleItem, addItem, setItemLevel, clearDone, countOpen } from "@/lib/lap/noteList";

describe("a line's note as a running list", () => {
  it("reads a prose note written before today as open items, one per line", () => {
    expect(parseNote("Ask Chrissy for the van count\nTuesday schedule is on the drive")).toEqual([
      { text: "Ask Chrissy for the van count", done: false, level: 0 },
      { text: "Tuesday schedule is on the drive", done: false, level: 0 },
    ]);
    expect(parseNote(null)).toEqual([]);
    expect(parseNote("  \n\n")).toEqual([]);
  });
  it("reads done marks and nesting, and writes them back the same way", () => {
    const text = "Fix the back door latch\n  Call Jim about the quote\n[x] Order mats";
    const items = parseNote(text);
    expect(items).toEqual([
      { text: "Fix the back door latch", done: false, level: 0 },
      { text: "Call Jim about the quote", done: false, level: 1 },
      { text: "Order mats", done: true, level: 0 },
    ]);
    expect(serializeNote(items)).toBe(text);
    expect(parseNote("- dashed sub\n\t[X] tabbed done")).toEqual([
      { text: "dashed sub", done: false, level: 1 },
      { text: "tabbed done", done: true, level: 1 },
    ]);
  });
  it("crossing off keeps the item and its place in storage; the display puts done last", () => {
    const items = toggleItem(parseNote("A\nB\nC"), 0);
    expect(serializeNote(items)).toBe("[x] A\nB\nC");
    expect(orderForDisplay(items).map((i) => i.text)).toEqual(["B", "C", "A"]);
    expect(countOpen(items)).toBe(2);
  });
  it("nested items travel with their parent in the display", () => {
    const items = toggleItem(parseNote("A\n  a1\nB"), 0);
    expect(orderForDisplay(items).map((i) => i.text)).toEqual(["B", "A", "a1"]);
  });
  it("adds after an item at its level, and never nests the first item", () => {
    const items = parseNote("A\n  a1\nB");
    expect(addItem(items, "a2", 1).map((i) => `${i.level}:${i.text}`)).toEqual(["0:A", "1:a1", "1:a2", "0:B"]);
    expect(addItem(items, "   ")).toBe(items);
    expect(setItemLevel(items, 0, 1)[0].level).toBe(0);
    expect(setItemLevel(items, 2, 1)[2].level).toBe(1);
  });
  it("clear done removes the crossed-off items and an empty list stores as nothing", () => {
    const items = toggleItem(toggleItem(parseNote("A\nB"), 0), 1);
    expect(serializeNote(clearDone(items))).toBeNull();
  });
});
