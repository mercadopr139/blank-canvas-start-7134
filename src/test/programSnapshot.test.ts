// A program's Snapshot (2026-11-12): the arithmetic behind the blocks and the attendance report.
import { describe, expect, it } from "vitest";
import { availableBlocks, buildSnapshot, formatName, previousPeriod, SNAPSHOT_BLOCKS, type SnapshotCheckIn } from "@/lib/programSnapshot";

const ci = (identity: string, date: string, hour: number, first: string, last: string): SnapshotCheckIn =>
  // October is Eastern Daylight Time, UTC−4.
  ({ identity, date, at: `${date}T${String(hour + 4).padStart(2, "0")}:15:00Z`, first, last, grade: "10th" });

const checkIns: SnapshotCheckIn[] = [
  ci("a", "2026-10-06", 14, "Marcus", "Rivera"), ci("b", "2026-10-06", 14, "Jade", "Owens"), ci("c", "2026-10-06", 15, "Eli", "Park"),
  ci("a", "2026-10-07", 14, "Marcus", "Rivera"), ci("b", "2026-10-07", 14, "Jade", "Owens"),
  ci("a", "2026-10-08", 14, "Marcus", "Rivera"), ci("b", "2026-10-08", 14, "Jade", "Owens"), ci("d", "2026-10-08", 14, "Noor", "Haddad"),
  ci("a", "2026-10-13", 14, "Marcus", "Rivera"),
];

const snapInput = {
  stats: { sessionsHeld: 4, sessionsPlanned: 5, checkIns: 9, students: 4, avgPerSession: 2.3, bus: 7, dismissed: 2 },
  breakdown: {
    Grade: { "10th": 3, "11th": 1 },
    "CTE program": { Welding: 2, "Culinary Arts/Hospitality": 1, "Not given": 1 },
    Sex: { Male: 2, Female: 2 },
    "Race / ethnicity": { White: 1, "Hispanic or Latino": 2, "Not given": 1 },
    "Economically disadvantaged youth": { Yes: 3, No: 1 },
  },
  checkIns,
  registered: 8,
  previous: { sessionsHeld: 3, sessionsPlanned: 3, checkIns: 5, students: 3, avgPerSession: 1.7, bus: 5, dismissed: 0 },
  moments: [{ week: "Oct 6–10", notes: "Marcus led warm-ups." }],
  names: "full" as const,
};
const snap = buildSnapshot(snapInput);

describe("the Snapshot", () => {
  it("reaches and counts sessions, with the average per session and no bus/dismissed split", () => {
    expect(snap.reached).toEqual({ students: 4, registered: 8, pct: 50 });
    expect(snap.sessions).toEqual({ held: 4, planned: 5, checkIns: 9, avg: 2.3 });
    // Taken out for good (Josh, 2026-11-12): attended 75%+, new vs returning, bus vs dismissed.
    expect(SNAPSHOT_BLOCKS.map((b) => b.key)).not.toContain("rate");
    expect(SNAPSHOT_BLOCKS.map((b) => b.key)).not.toContain("newReturning");
    expect(JSON.stringify(snap)).not.toMatch(/bus|dismissed/i);
  });

  it("turns the breakdown into rows with percents, and the minority and disadvantaged headlines", () => {
    expect(snap.sex).toEqual([{ label: "Female", n: 2, pct: 50 }, { label: "Male", n: 2, pct: 50 }]);
    // Grades in school order, not by count.
    expect(buildSnapshot({ ...snapInput, breakdown: { ...snapInput.breakdown, Grade: { "12th": 9, "10th": 12, "9th": 10, "11th": 5, "Not given": 1 } } }).grade.map((g) => g.label))
      .toEqual(["9th", "10th", "11th", "12th", "Not given"]);
    expect(snap.cte[0]).toEqual({ label: "Welding", n: 2, pct: 50 });
    expect(snap.minority).toEqual({ n: 2, recorded: 3, pct: 67 });
    expect(snap.disadvantaged).toEqual({ n: 3, of: 4, pct: 75 });
  });

  it("compares to the previous period", () => {
    expect(snap.comparison?.[0]).toEqual({ label: "Sessions held", now: 4, before: 3, delta: 1 });
    expect(snap.comparison?.[3]).toEqual({ label: "Average per session", now: 2.3, before: 1.7, delta: 0.6 });
  });

  it("builds the attendance report: each session in order with who came, then each student's total", () => {
    expect(snap.attendance.sessions.map((s) => [s.date, s.count])).toEqual([
      ["2026-10-06", 3], ["2026-10-07", 2], ["2026-10-08", 3], ["2026-10-13", 1],
    ]);
    expect(snap.attendance.sessions[0].people.map((p) => p.name)).toEqual(["Jade Owens", "Marcus Rivera", "Eli Park"]);
    expect(snap.attendance.sessions[0].people[0].time).toBe("2:15 PM");
    expect(snap.attendance.students[0]).toEqual({ name: "Marcus Rivera", attended: 4, of: 4, pct: 100 });
    expect(snap.attendance.students[1]).toEqual({ name: "Jade Owens", attended: 3, of: 4, pct: 75 });
  });

  it("initials the last name when the report leaves the school", () => {
    expect(formatName("Marcus", "Rivera", "initial")).toBe("Marcus R.");
    expect(formatName("Marcus", "", "initial")).toBe("Marcus");
    expect(formatName("", "", "full")).toBe("Unknown");
  });

  it("offers only the blocks a program has data for", () => {
    expect(availableBlocks({ hasCte: false, hasGrades: true, hasPrevious: false, hasMoments: true })).not.toContain("cte");
    expect(availableBlocks({ hasCte: false, hasGrades: true, hasPrevious: false, hasMoments: true })).not.toContain("comparison");
    expect(availableBlocks({ hasCte: true, hasGrades: true, hasPrevious: true, hasMoments: true })).toHaveLength(11);
  });

  it("finds the previous period of the same length", () => {
    expect(previousPeriod("2026-11-01", "2026-11-30")).toEqual({ from: "2026-10-02", to: "2026-10-31" });
    expect(previousPeriod("2026-10-06", "2026-10-06")).toEqual({ from: "2026-10-05", to: "2026-10-05" });
  });
});
