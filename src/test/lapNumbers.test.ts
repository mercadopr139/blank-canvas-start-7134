import { describe, it, expect } from "vitest";
import { addDays, weekOf, thisAndLastWeek, withinWindow, nextYearly, type ComingUp } from "@/lib/lap/numbers";

describe("The Lap — dates for the numbers and the coming-up strip", () => {
  it("adds days as calendar math, across a month end, with no timezone roll", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("finds the Monday-to-Sunday week of any day", () => {
    expect(weekOf("2026-10-19")).toEqual({ from: "2026-10-19", to: "2026-10-25" }); // a Monday
    expect(weekOf("2026-10-22")).toEqual({ from: "2026-10-19", to: "2026-10-25" }); // a Thursday
    expect(weekOf("2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" }); // a Sunday
    expect(thisAndLastWeek("2026-10-21").prev).toEqual({ from: "2026-10-12", to: "2026-10-18" });
  });

  it("keeps only the next two weeks, soonest first", () => {
    const items: ComingUp[] = [
      { date: "2026-10-30", title: "Due: O.C.E.A.N.", pillar: "finance", source: "grant" },
      { date: "2026-10-18", title: "Yesterday", pillar: null, source: "date" },
      { date: "2026-11-03", title: "Too far", pillar: null, source: "date" },
      { date: "2026-10-20", title: "Excursion: Phillies", pillar: "operations", source: "excursion" },
      { date: "2026-10-20", title: "Board meeting", pillar: null, source: "date" },
    ];
    expect(withinWindow(items, "2026-10-19").map((i) => i.title)).toEqual(["Board meeting", "Excursion: Phillies", "Due: O.C.E.A.N."]);
  });

  it("rolls a yearly date to its next occurrence", () => {
    expect(nextYearly("2025-05-15", "2026-10-19")).toBe("2027-05-15");
    expect(nextYearly("2025-11-15", "2026-10-19")).toBe("2026-11-15");
    expect(nextYearly("2020-10-19", "2026-10-19")).toBe("2026-10-19");
  });
});
