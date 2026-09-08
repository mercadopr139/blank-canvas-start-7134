import { describe, it, expect } from "vitest";
import {
  athleteIntel, allAthletes, overview, workTrend, liftTrend, repeatedLifts,
  SLIPPING_DAYS,
} from "@/lib/nbtIntel";
import { NbtLog, Track } from "@/lib/nbt";

let n = 0;
const log = (o: Partial<NbtLog> & { workout_date: string; level: Track }): NbtLog => ({
  id: `l${n++}`,
  week_id: null,
  day_key: "monday",
  registration_id: "kid-1",
  athlete_name: "Malachi Jones",
  lift: null,
  sets: [],
  work_result: null,
  work_unit: null,
  notes: null,
  ...o,
} as NbtLog);

const TODAY = "2026-10-01";

describe("one athlete", () => {
  it("returns nothing for a youth who has never logged", () => {
    expect(athleteIntel("nobody", [], TODAY)).toBeNull();
  });

  it("reads their track from the sessions, not from what they are assigned now", () => {
    // The whole reason the level is copied onto each log: moving up in week
    // three must not rewrite week one.
    const a = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "charlie" }),
      log({ workout_date: "2026-09-14", level: "charlie" }),
      log({ workout_date: "2026-09-21", level: "bravo" }),
    ], TODAY)!;

    expect(a.startLevel).toBe("charlie");
    expect(a.currentLevel).toBe("bravo");
    expect(a.moves).toHaveLength(1);
    expect(a.moves[0]).toMatchObject({ from: "charlie", to: "bravo", up: true });
  });

  it("records a move back down as a move, not as progress", () => {
    const a = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "alpha" }),
      log({ workout_date: "2026-09-14", level: "bravo" }),
    ], TODAY)!;
    expect(a.moves[0].up).toBe(false);
  });

  it("does not care what order the logs arrive in", () => {
    const a = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-21", level: "bravo" }),
      log({ workout_date: "2026-09-07", level: "charlie" }),
    ], TODAY)!;
    expect(a.firstDate).toBe("2026-09-07");
    expect(a.startLevel).toBe("charlie");
    expect(a.currentLevel).toBe("bravo");
  });

  it("counts the days since they last showed up", () => {
    const a = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-24", level: "bravo" }),
    ], TODAY)!;
    expect(a.daysSince).toBe(7);
  });
});

describe("the overview", () => {
  const logs = [
    // Moved up.
    log({ registration_id: "a", athlete_name: "A", workout_date: "2026-09-07", level: "charlie" }),
    log({ registration_id: "a", athlete_name: "A", workout_date: "2026-09-28", level: "bravo" }),
    // Stayed put, and recently.
    log({ registration_id: "b", athlete_name: "B", workout_date: "2026-09-28", level: "alpha" }),
    // Stopped coming a month ago.
    log({ registration_id: "c", athlete_name: "C", workout_date: "2026-09-01", level: "charlie" }),
  ];

  it("counts athletes, sessions and who moved up", () => {
    const o = overview(allAthletes(logs, TODAY));
    expect(o.athletes).toBe(3);
    expect(o.sessions).toBe(4);
    expect(o.movedUp).toBe(1);
  });

  it("groups by where each athlete is NOW", () => {
    const o = overview(allAthletes(logs, TODAY));
    // A finished on bravo, B on alpha, C on charlie.
    expect(o.byLevel).toEqual({ charlie: 1, bravo: 1, alpha: 1 });
  });

  it("flags the youth who has quietly stopped coming", () => {
    const o = overview(allAthletes(logs, TODAY));
    expect(o.slipping).toBe(1); // C, thirty days ago
    expect(SLIPPING_DAYS).toBe(14);
  });

  it("lists the most recently active first", () => {
    expect(allAthletes(logs, TODAY)[0].lastDate).toBe("2026-09-28");
  });
});

describe("trends", () => {
  const a = athleteIntel("kid-1", [
    log({
      workout_date: "2026-09-07", level: "bravo", lift: "Goblet Squat",
      sets: [{ set: 1, weight: 30, reps: 8 }, { set: 2, weight: 35, reps: 8 }],
      work_result: 3, work_unit: "rounds",
    }),
    log({
      workout_date: "2026-09-14", level: "bravo", lift: "Goblet Squat",
      sets: [{ set: 1, weight: 40, reps: 8 }],
      work_result: 4, work_unit: "rounds",
    }),
    log({
      workout_date: "2026-09-21", level: "bravo", lift: "Goblet Squat",
      sets: [{ set: 1, weight: 45, reps: 6 }],
      work_result: 5, work_unit: "rounds",
    }),
  ], TODAY)!;

  it("tracks the heaviest set on a repeated movement", () => {
    const t = liftTrend(a, "Goblet Squat")!;
    expect(t.first).toBe(35); // heaviest set of session one
    expect(t.last).toBe(45);
    expect(t.pr).toBe(45);
    expect(t.change).toBe(10);
  });

  it("tracks the circuit result rising", () => {
    const t = workTrend(a, "Goblet Squat", "rounds")!;
    expect(t.first).toBe(3);
    expect(t.last).toBe(5);
    expect(t.pct).toBe(67);
  });

  it("refuses to invent a trend from one point", () => {
    const one = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "bravo", lift: "Back Squat", sets: [{ set: 1, weight: 95, reps: 5 }] }),
    ], TODAY)!;
    expect(liftTrend(one, "Back Squat")).toBeNull();
  });

  it("will not compare rounds of one circuit to metres of another", () => {
    // Different units are different measurements. Putting them on one line
    // would be inventing a trend that does not exist.
    const mixed = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "bravo", lift: "Carry", work_result: 3, work_unit: "rounds" }),
      log({ workout_date: "2026-09-14", level: "bravo", lift: "Carry", work_result: 400, work_unit: "meters" }),
    ], TODAY)!;
    expect(workTrend(mixed, "Carry", "rounds")).toBeNull();
  });

  it("only offers movements that were actually repeated", () => {
    expect(repeatedLifts(a)).toEqual(["Goblet Squat"]);
    const once = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "bravo", lift: "Back Squat", sets: [{ set: 1, weight: 95, reps: 5 }] }),
    ], TODAY)!;
    expect(repeatedLifts(once)).toEqual([]);
  });

  it("ignores bodyweight sessions when trending weight", () => {
    const bw = athleteIntel("kid-1", [
      log({ workout_date: "2026-09-07", level: "charlie", lift: "Push-up", sets: [{ set: 1, weight: null, reps: 12 }] }),
      log({ workout_date: "2026-09-14", level: "charlie", lift: "Push-up", sets: [{ set: 1, weight: null, reps: 15 }] }),
    ], TODAY)!;
    // No weight was ever lifted, so there is no weight trend to report.
    expect(liftTrend(bw, "Push-up")).toBeNull();
  });
});
