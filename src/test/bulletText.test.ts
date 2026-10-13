import { describe, it, expect } from "vitest";
import { parseBullets, serializeBullets, MAX_LEVEL } from "@/lib/bulletText";

describe("bullet text — what a block's drills are kept as", () => {
  it("reads one bullet per line; an indented line or one with a marker is a sub-bullet", () => {
    expect(parseBullets("4 miles on treadmill\n  Denum, Cuevas\n- Darrel\n* Andrew\n• Coop\n> last\n one space")).toEqual([
      { text: "4 miles on treadmill", level: 0 },
      { text: "Denum, Cuevas", level: 1 },
      { text: "Darrel", level: 1 },
      { text: "Andrew", level: 1 },
      { text: "Coop", level: 1 },
      { text: "last", level: 1 },
      { text: "one space", level: 1 },
    ]);
  });

  it("reads a third level: a dash two spaces in, or four spaces, and never deeper than that", () => {
    expect(MAX_LEVEL).toBe(2);
    expect(parseBullets("Pad work\n- 10 rds\n  - Southpaw\n    Orthodox\n\t- tabbed\n      - too deep")).toEqual([
      { text: "Pad work", level: 0 },
      { text: "10 rds", level: 1 },
      { text: "Southpaw", level: 2 },
      { text: "Orthodox", level: 2 },
      { text: "tabbed", level: 2 },
      { text: "too deep", level: 2 },
    ]);
  });

  it("drops blank lines and handles nothing", () => {
    expect(parseBullets("a\n\n   \nb")).toEqual([{ text: "a", level: 0 }, { text: "b", level: 0 }]);
    expect(parseBullets(null)).toEqual([]);
    expect(parseBullets("")).toEqual([]);
  });

  it("writes a top line bare, a sub-bullet with a dash, a sub-sub-bullet two spaces deeper, nothing as null", () => {
    expect(serializeBullets([{ text: "Bag work", level: 0 }, { text: "3 rounds", level: 1 }, { text: "Southpaw", level: 2 }])).toBe(
      "Bag work\n- 3 rounds\n  - Southpaw"
    );
    expect(serializeBullets([{ text: "  ", level: 0 }])).toBeNull();
    expect(serializeBullets([])).toBeNull();
  });

  it("round-trips what the old Tab-to-indent box saved, and its own output", () => {
    const old = "If you're not sparring\n  Shadow box\n  Jump rope\nCool down";
    expect(serializeBullets(parseBullets(old))).toBe("If you're not sparring\n- Shadow box\n- Jump rope\nCool down");
    const three = "Pad work\n- 10 rds\n  - Southpaw\n  - Orthodox\n- Then switch";
    expect(serializeBullets(parseBullets(three))).toBe(three);
  });
});
