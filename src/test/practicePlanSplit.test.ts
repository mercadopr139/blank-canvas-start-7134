import { describe, it, expect } from "vitest";
import { parseSplit, serializeSplit, isSplitBlock, isJuniorsLane, daysForWeek, ALL_WEEKDAYS, capFirst, QUICK_BLOCKS, BIBLE_STUDY_BLOCK, isBibleStudyBlock, bibleStudyText, hasLanes, laneDefaults, DEFAULT_BIBLE_LANES, blockAccent, bibleStudySiblings, wrapupFor } from "@/lib/practicePlan";

describe("Split block lanes", () => {
  it("is recognised by its category", () => {
    expect(isSplitBlock("Split")).toBe(true);
    expect(isSplitBlock("split — Tuesday")).toBe(true);
    expect(isSplitBlock("Sparring")).toBe(false);
  });

  it("starts as Coaching Juniors / Cardio with nothing saved", () => {
    const lanes = parseSplit(null);
    expect(lanes.map((l) => l.title)).toEqual(["Coaching Juniors", "Cardio"]);
    expect(serializeSplit(lanes)).toBeNull(); // untouched = nothing to store
  });

  it("round-trips names, who and drills", () => {
    const lanes = [
      { title: "Coaching Juniors", who: "Marcus, Jay", text: "Bag stations\n- doubling the jab" },
      { title: "Cardio", who: "everyone else", text: "3-mile run" },
    ];
    const stored = serializeSplit(lanes)!;
    expect(stored).toContain("## Coaching Juniors | Marcus, Jay");
    expect(parseSplit(stored)).toEqual(lanes);
  });

  it("keeps a renamed lane even before any drills are typed", () => {
    const stored = serializeSplit([{ title: "Juniors", who: "", text: "" }, { title: "Run", who: "", text: "" }]);
    expect(stored).not.toBeNull();
    expect(parseSplit(stored).map((l) => l.title)).toEqual(["Juniors", "Run"]);
  });

  it("reads plain text as lane 1 drills under the default name", () => {
    const [a, b] = parseSplit("Bag stations");
    expect(a.title).toBe("Coaching Juniors");
    expect(a.text).toBe("Bag stations");
    expect(b.title).toBe("Cardio");
  });

  it("defaults the Juniors lane to Boxing stations", () => {
    const [a] = parseSplit(null);
    expect(a.text).toBe("Boxing stations");
  });

  it("finds the Junior Boxers lane for the board strip", () => {
    const [a, b] = parseSplit("## Coaching Juniors | Jay\nbags\n## Cardio\nrun");
    expect(isJuniorsLane(a)).toBe(true);
    expect(isJuniorsLane(b)).toBe(false);
  });
});

describe("Lane names", () => {
  it("start with a capital, rest as typed", () => {
    expect(capFirst("coaching Juniors")).toBe("Coaching Juniors");
    expect(capFirst("cardio")).toBe("Cardio");
    expect(capFirst("  ")).toBe("");
  });
});

describe("A week's days", () => {
  it("come from the week's blocks, Sat/Sun included", () => {
    const days = daysForWeek([{ weekday: 1 }, { weekday: 3 }, { weekday: 6 }], "in_season");
    expect(days.map((d) => d.short)).toEqual(["Mon", "Wed", "Sat"]);
  });
  it("fall back to the season before a week exists", () => {
    expect(daysForWeek([], "in_season").map((d) => d.n)).toEqual([1, 2, 3, 4, 5]);
    expect(daysForWeek([], "off_season").map((d) => d.n)).toEqual([1, 2, 3, 4]);
    expect(ALL_WEEKDAYS.length).toBe(7);
  });
});

describe("Bible Study block", () => {
  it("is a quick block, recognised by name, and is one plain box (not lanes) since 2026-10-08", () => {
    expect(QUICK_BLOCKS).toContain(BIBLE_STUDY_BLOCK);
    expect(isBibleStudyBlock("Bible Study · 6:30")).toBe(true);
    expect(isBibleStudyBlock("bible study 6:00")).toBe(true);
    expect(isBibleStudyBlock("Split")).toBe(false);
    expect(hasLanes("Bible Study · 6:30")).toBe(false);
    expect(hasLanes("Split")).toBe(true);
    expect(laneDefaults(BIBLE_STUDY_BLOCK)).toBe(laneDefaults("Split"));
  });

  it("prints what was typed, one line per bullet", () => {
    expect(bibleStudyText(null)).toBeNull();
    expect(bibleStudyText("   ")).toBeNull();
    expect(bibleStudyText("Off")).toBe("Off");
    expect(bibleStudyText("Boys with Pastor\nGirls with Chrissy")).toBe("Boys with Pastor\nGirls with Chrissy");
  });

  it("reads a week saved while the study was two lanes as plain lines", () => {
    // Exactly what the week of Oct 5 holds: "Off" typed in the Boys lane, Girls empty.
    expect(bibleStudyText("## Boys\nOff\n## Girls\n")).toBe("Off");
    // Both lanes filled, each with a leader.
    const stored = serializeSplit(
      [{ title: "Boys", who: "Coach Marcus", text: "James 1" }, { title: "Girls", who: "Ms. Dana", text: "Psalm 23" }],
      DEFAULT_BIBLE_LANES,
    )!;
    expect(bibleStudyText(stored)).toBe("Boys with Coach Marcus: James 1\nGirls with Ms. Dana: Psalm 23");
    // A leader named but no topic yet.
    expect(bibleStudyText("## Boys | Pastor\n## Girls | Chrissy\n")).toBe("Boys with Pastor\nGirls with Chrissy");
    // Lane headers with nothing in them print nothing.
    expect(bibleStudyText("## Boys\n## Girls\n")).toBeNull();
  });

  it("wears the spiritual teal wherever it appears", () => {
    expect(blockAccent(BIBLE_STUDY_BLOCK, "#bf0f3e")).toBe("#14b8a6");
    expect(blockAccent("Boxing", "#bf0f3e")).toBe("#bf0f3e");
  });
});

describe("Bible Study in both team columns", () => {
  const blocks = [
    { id: "a", weekday: 4, category: "Bible Study · 6:30" },
    { id: "b", weekday: 4, category: "Bible Study · 6:30" },
    { id: "c", weekday: 4, category: "Boxing" },
    { id: "d", weekday: 2, category: "Bible Study · 6:30" },
  ];
  it("saves one box into every Bible Study box on that night", () => {
    expect(bibleStudySiblings(blocks, "a").sort()).toEqual(["a", "b"]);
    expect(bibleStudySiblings(blocks, "b").sort()).toEqual(["a", "b"]);
  });
  it("leaves every other block, and other nights, alone", () => {
    expect(bibleStudySiblings(blocks, "c")).toEqual(["c"]);
    expect(bibleStudySiblings(blocks, "d")).toEqual(["d"]);
    expect(bibleStudySiblings(blocks, "zzz")).toEqual(["zzz"]);
  });
});

describe("A night's wrap-up", () => {
  const tpl = { weekday: 4, label: "Bible Study 6:30 · Eat up · Clean up", leader: "Pastor", is_active: true };
  it("is the template's unless the week says otherwise", () => {
    expect(wrapupFor({ wrapups: {} }, 4, tpl)).toEqual({ ...tpl, overridden: false });
    expect(wrapupFor(null, 4, null)).toBeNull();
  });
  it("is the week's own line when one is set, and always live", () => {
    const week = { wrapups: { "4": { label: "Pizza night · Clean up", leader: "" } } };
    expect(wrapupFor(week, 4, { ...tpl, is_active: false })).toEqual({
      weekday: 4, label: "Pizza night · Clean up", leader: null, is_active: true, overridden: true,
    });
    expect(wrapupFor(week, 1, null)).toBeNull();
  });
  it("ignores a blank override", () => {
    expect(wrapupFor({ wrapups: { "4": { label: "  ", leader: null } } }, 4, tpl)?.overridden).toBe(false);
  });
});
