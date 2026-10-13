import { describe, it, expect } from "vitest";
import { parseBullets, serializeBullets } from "@/lib/bulletText";

describe("bullet text — what a block's drills are kept as", () => {
  it("reads one bullet per line, nesting an indented line or one with a marker", () => {
    expect(parseBullets("4 miles on treadmill\n  Denum, Cuevas\n- Darrel\n* Andrew\n• Coop\n> last")).toEqual([
      { text: "4 miles on treadmill", nested: false },
      { text: "Denum, Cuevas", nested: true },
      { text: "Darrel", nested: true },
      { text: "Andrew", nested: true },
      { text: "Coop", nested: true },
      { text: "last", nested: true },
    ]);
  });

  it("drops blank lines and handles nothing", () => {
    expect(parseBullets("a\n\n   \nb")).toEqual([{ text: "a", nested: false }, { text: "b", nested: false }]);
    expect(parseBullets(null)).toEqual([]);
    expect(parseBullets("")).toEqual([]);
  });

  it("writes a nested line with a dash, a top line bare, and nothing as null", () => {
    expect(serializeBullets([{ text: "Bag work", nested: false }, { text: "3 rounds", nested: true }])).toBe("Bag work\n- 3 rounds");
    expect(serializeBullets([{ text: "  ", nested: false }])).toBeNull();
    expect(serializeBullets([])).toBeNull();
  });

  it("round-trips what the old Tab-to-indent box saved", () => {
    const old = "If you're not sparring\n  Shadow box\n  Jump rope\nCool down";
    expect(serializeBullets(parseBullets(old))).toBe("If you're not sparring\n- Shadow box\n- Jump rope\nCool down");
    // And that reads back identically.
    expect(parseBullets(serializeBullets(parseBullets(old)))).toEqual(parseBullets(old));
  });
});
