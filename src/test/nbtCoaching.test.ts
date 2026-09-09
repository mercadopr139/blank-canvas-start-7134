import { describe, it, expect } from "vitest";
import { NbtDay, NbtLog, NbtWeek, Track } from "@/lib/nbt";
import {
  priorWeekBrief, priorWeekBriefs, roomReport, carryOver, THIN_ROOM,
} from "@/lib/nbtCoaching";

const day = (pattern: string, c: string, b: string, a: string, work = "Engine"): NbtDay => ({
  focus: "f",
  prep: ["p"],
  lift: {
    pattern,
    charlie: { name: c, detail: "3 × 8" },
    bravo: { name: b, detail: "4 × 6" },
    alpha: { name: a, detail: "4 × 5" },
    cues: [],
  },
  work: { emphasis: "intervals", title: work, charlie: [], bravo: [], alpha: [], result_unit: "rounds" },
  reset: ["r"],
});

const week = (n: number, start: string, d: Partial<Record<"monday" | "tuesday" | "thursday", NbtDay>>): NbtWeek => ({
  id: `w${n}`, block_id: "b", week_start: start, week_in_block: n, days: d,
});

const log = (
  date: string, level: Track, lift: string, weight: number, reps: number,
  result: number | null, unit: string | null, who: string
): NbtLog => ({
  id: `${date}-${who}`,
  week_id: null,
  workout_date: date,
  day_key: "monday",
  registration_id: who,
  athlete_name: who,
  level,
  lift,
  sets: [{ set: 1, weight, reps }],
  work_result: result,
  work_unit: unit as NbtLog["work_unit"],
  notes: null,
});

describe("priorWeekBrief — all three tracks, not just Alpha", () => {
  const w = week(1, "2026-09-07", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") });

  it("names every track with its dose", () => {
    const b = priorWeekBrief(w, "monday")!;
    expect(b.charlie).toBe("Goblet Squat — 3 × 8");
    expect(b.bravo).toBe("Heavy Goblet — 4 × 6");
    expect(b.alpha).toBe("Back Squat — 4 × 5");
    expect(b.pattern).toBe("Squat");
  });

  it("carries the circuit and its emphasis", () => {
    expect(priorWeekBrief(w, "monday")!.work).toBe("Engine — intervals");
  });

  it("is null for a day that was never written", () => {
    expect(priorWeekBrief(w, "thursday")).toBeNull();
  });

  it("only returns weeks earlier than the one being written", () => {
    const weeks = [
      week(1, "2026-09-07", { monday: day("Squat", "A", "B", "C") }),
      week(2, "2026-09-14", { monday: day("Squat", "A", "B", "C") }),
      week(3, "2026-09-21", { monday: day("Squat", "A", "B", "C") }),
    ];
    expect(priorWeekBriefs(weeks, "monday", 3).map((b) => b.week)).toEqual([1, 2]);
    expect(priorWeekBriefs(weeks, "monday", 1)).toEqual([]);
  });
});

describe("roomReport — anonymised evidence", () => {
  const logs = [
    log("2026-09-07", "charlie", "Goblet Squat", 25, 24, 5, "rounds", "kid1"),
    log("2026-09-07", "charlie", "Goblet Squat", 30, 24, 4, "rounds", "kid2"),
    log("2026-09-07", "alpha", "Back Squat", 135, 20, 6, "rounds", "kid3"),
    log("2026-09-14", "charlie", "Goblet Squat", 30, 24, 6, "rounds", "kid1"),
    log("2026-09-14", "charlie", "Goblet Squat", 35, 24, 6, "rounds", "kid2"),
    log("2026-09-14", "alpha", "Back Squat", 145, 20, 7, "rounds", "kid3"),
  ];

  it("never returns a name or an id", () => {
    const r = JSON.stringify(roomReport(logs, "monday", "2026-09-20"));
    expect(r).not.toContain("kid1");
    expect(r).not.toContain("kid3");
  });

  it("counts distinct athletes, not rows", () => {
    // kid1 and kid2 each logged twice; three humans in total.
    expect(roomReport(logs, "monday", "2026-09-20")!.athletes).toBe(3);
  });

  it("reports the movement most of a track actually logged", () => {
    const r = roomReport(logs, "monday", "2026-09-20")!;
    expect(r.byTrack.charlie.lift).toBe("Goblet Squat");
    expect(r.byTrack.alpha.lift).toBe("Back Squat");
  });

  it("uses medians, so one outlier cannot move the room", () => {
    const withOutlier = [...logs, log("2026-09-14", "charlie", "Goblet Squat", 500, 24, 6, "rounds", "kid9")];
    expect(roomReport(withOutlier, "monday", "2026-09-20")!.byTrack.charlie.medianTopWeight).toBeLessThan(60);
  });

  it("says nothing about a track nobody trained", () => {
    const r = roomReport(logs, "monday", "2026-09-20")!;
    expect(r.byTrack.bravo.athletes).toBe(0);
    expect(r.byTrack.bravo.lift).toBeNull();
  });

  it("reads a rising circuit result as up", () => {
    expect(roomReport(logs, "monday", "2026-09-20")!.workTrend).toBe("up");
  });

  it("treats a falling TIME as an improvement, not a decline", () => {
    const timed = [
      log("2026-09-07", "alpha", "Back Squat", 135, 20, 300, "seconds", "kid3"),
      log("2026-09-07", "alpha", "Back Squat", 135, 20, 320, "seconds", "kid4"),
      log("2026-09-14", "alpha", "Back Squat", 135, 20, 260, "seconds", "kid3"),
      log("2026-09-14", "alpha", "Back Squat", 135, 20, 280, "seconds", "kid4"),
    ];
    expect(roomReport(timed, "monday", "2026-09-20")!.workTrend).toBe("up");
  });

  it("refuses a trend when the unit changed underneath it", () => {
    const mixed = [
      log("2026-09-07", "alpha", "Back Squat", 135, 20, 5, "rounds", "kid3"),
      log("2026-09-14", "alpha", "Back Squat", 135, 20, 400, "meters", "kid3"),
    ];
    expect(roomReport(mixed, "monday", "2026-09-20")!.workTrend).toBeNull();
  });

  it("marks a near-empty room as thin rather than pretending it is evidence", () => {
    const two = logs.filter((l) => l.athlete_name !== "kid3");
    const r = roomReport(two, "monday", "2026-09-20")!;
    expect(r.athletes).toBeLessThan(THIN_ROOM);
    expect(r.thin).toBe(true);
  });

  it("ignores rows where nothing was actually entered", () => {
    const blank = [{ ...log("2026-09-07", "charlie", "Goblet Squat", 0, 0, null, null, "kid5"), sets: [] }];
    expect(roomReport(blank, "monday", "2026-09-20")).toBeNull();
  });

  it("does not look at sessions that have not happened yet", () => {
    const r = roomReport(logs, "monday", "2026-09-10")!;
    expect(r.sessions).toBe(1);
    expect(r.lastDate).toBe("2026-09-07");
  });

  it("keeps to the last N sessions", () => {
    const many = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"].map((d) =>
      log(d, "alpha", "Back Squat", 135, 20, 5, "rounds", "kid3")
    );
    expect(roomReport(many, "monday", "2026-09-20")!.sessions).toBe(3);
  });

  it("is null when the day has never been logged", () => {
    expect(roomReport(logs, "thursday", "2026-09-20")).toBeNull();
  });
});

describe("carryOver — a month is not a reset", () => {
  const prev = [
    week(1, "2026-08-03", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") }),
    week(2, "2026-08-10", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") }),
    week(3, "2026-08-17", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") }),
  ];

  it("hands over where the block actually finished", () => {
    const c = carryOver(prev, "monday")!;
    expect(c.weekStart).toBe("2026-08-17");
    expect(c.alpha).toBe("Back Squat — 4 × 5");
    expect(c.charlie).toBe("Goblet Squat — 3 × 8");
  });

  it("counts how long the pattern has run, so six weeks can unlock a change", () => {
    expect(carryOver(prev, "monday")!.weeksOnPattern).toBe(3);
  });

  it("stops counting at the point the pattern changed", () => {
    const switched = [
      week(1, "2026-08-03", { monday: day("Lunge", "Split Squat", "DB Split Squat", "Front Rack Lunge") }),
      week(2, "2026-08-10", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") }),
      week(3, "2026-08-17", { monday: day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat") }),
    ];
    expect(carryOver(switched, "monday")!.weeksOnPattern).toBe(2);
  });

  it("skips half-written weeks rather than handing over a blank", () => {
    const gappy = [...prev, week(4, "2026-08-24", {})];
    expect(carryOver(gappy, "monday")!.weekStart).toBe("2026-08-17");
  });

  it("is null when there is no previous block", () => {
    expect(carryOver([], "monday")).toBeNull();
    expect(carryOver(prev, "thursday")).toBeNull();
  });
});
