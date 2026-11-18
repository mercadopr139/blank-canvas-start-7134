// Rev's rotation (2026-11-18): the eight lifts in order, what the last session
// decides, and the stations picked from his lists.
import { describe, expect, it } from "vitest";
import type { NbtDay, NbtWeek } from "@/lib/nbt";
import {
  ROTATION, rotationEntry, nextLift, liftsAfter, easierFor, lastLiftBefore, lastTimeOf, lastStationsBefore,
  pickStations, stationLinesFor, stationMoveOf, stationsHeader, STATION_PLAN, roomOf,
} from "@/lib/nbtRotation";

const day = (name: string, detail = "3 × 8", easier = "", stations: string[] = [], movedFrom?: NbtDay["movedFrom"]): NbtDay =>
  ({
    focus: "", prep: [], lift: { pattern: "", main: { name, detail }, easier, cues: [] },
    work: { emphasis: "", title: "Cardio Stations", shared: stations, bravo: [], alpha: [], result_unit: "rounds" },
    reset: [], ...(movedFrom ? { movedFrom } : {}),
  }) as NbtDay;
const week = (week_start: string, days: NbtWeek["days"], week_in_block = 1): NbtWeek =>
  ({ id: week_start, block_id: "b", week_start, week_in_block, days });

describe("the eight lifts", () => {
  it("are in Rev's order and wrap around", () => {
    expect(ROTATION.map((l) => l.name)).toEqual([
      "Back Squat", "Bench Press", "Deadlift", "Overhead Press", "Barbell Cleans", "Pull-Up", "Thrusters", "Clean and Press",
    ]);
    expect(nextLift(null).name).toBe("Back Squat");
    expect(nextLift(ROTATION[7]).name).toBe("Back Squat");
    expect(liftsAfter(ROTATION[6], 3).map((l) => l.name)).toEqual(["Clean and Press", "Back Squat", "Bench Press"]);
  });

  it("recognise a written lift, old names included, and tell the cleans apart", () => {
    expect(rotationEntry("Clean and Press")?.key).toBe("clean-and-press");
    expect(rotationEntry("Barbell Clean & Press")?.key).toBe("clean-and-press");
    expect(rotationEntry("Barbell Cleans")?.key).toBe("barbell-cleans");
    expect(rotationEntry("Romanian Deadlift")?.key).toBe("deadlift");
    expect(rotationEntry("Goblet Squat")?.key).toBe("back-squat");
    expect(rotationEntry("Thrusters")?.key).toBe("thrusters");
    expect(rotationEntry("Barbell Overhead Press")?.key).toBe("overhead-press");
    expect(rotationEntry("Farmer Carry")).toBeNull();
    expect(rotationEntry("")).toBeNull();
  });

  it("swap the dumbbell out of the simplified line on Monday", () => {
    const ohp = rotationEntry("Overhead Press")!;
    expect(easierFor(ohp, "tuesday")).toEqual(["Dumbbell overhead press", "Pike press"]);
    expect(easierFor(ohp, "monday")).toEqual(["Kettlebell overhead press", "Pike press"]);
    expect(easierFor(rotationEntry("Back Squat")!, "monday")).toEqual(["Goblet squat", "Bodyweight squat"]);
  });
});

describe("what the last session decides", () => {
  const weeks = [
    week("2026-11-02", { monday: day("Back Squat", "3 × 8", "Goblet squat — 3 × 10"), tuesday: day("Bench Press"), thursday: day("Deadlift", "4 × 5") }),
    week("2026-11-09", { monday: day("Overhead Press"), wednesday: day("Barbell Cleans", "4 × 5", "", [], "tuesday") }, 2),
  ];

  it("continues from the latest day by date, across weeks and moved nights", () => {
    expect(lastLiftBefore(weeks, "2026-11-12")?.name).toBe("Barbell Cleans");
    expect(nextLift(lastLiftBefore(weeks, "2026-11-12")).name).toBe("Pull-Up");
    expect(lastLiftBefore(weeks, "2026-11-10")?.name).toBe("Overhead Press");
    expect(lastLiftBefore(weeks, "2026-11-02")).toBeNull();
  });

  it("finds the last time a lift ran, with its dose and simplified line", () => {
    expect(lastTimeOf(weeks, rotationEntry("Back Squat")!, "2026-11-30")).toEqual({ date: "2026-11-02", detail: "3 × 8", easier: "Goblet squat — 3 × 10" });
    expect(lastTimeOf(weeks, rotationEntry("Deadlift")!, "2026-11-05")).toBeNull();
    expect(lastTimeOf(weeks, rotationEntry("Pull-Up")!, "2026-11-30")).toBeNull();
  });

  it("knows which room a day was written for", () => {
    expect(roomOf("monday")).toBe("performance_center");
    expect(roomOf("tuesday")).toBe("boxing_facility");
    expect(roomOf("wednesday", { movedFrom: "tuesday" })).toBe("boxing_facility");
    expect(roomOf("wednesday")).toBe("performance_center");
  });

  it("finds the last stations in the same room", () => {
    const pc = ["6 stations · 3 min each · rotate on the whistle", "Station 1 · The Racks (Pull) — Back flies — slow"];
    const bf = ["5 stations · 3 min each · rotate on the whistle", "Station 1 · The Racks (Pull) — Bent-over rows — flat back"];
    const w = [week("2026-11-09", { monday: day("Back Squat", "3 × 8", "", pc), tuesday: day("Bench Press", "3 × 8", "", bf) })];
    expect(lastStationsBefore(w, "performance_center", "2026-11-12")).toEqual(pc);
    expect(lastStationsBefore(w, "boxing_facility", "2026-11-12")).toEqual(bf);
    expect(lastStationsBefore(w, "boxing_facility", "2026-11-10")).toEqual([]);
  });
});

describe("the stations", () => {
  const first = () => 0;

  it("are six roles in the Performance Center and five in the boxing facility, with no machines or sled there", () => {
    expect(STATION_PLAN.performance_center.map((s) => `${s.place} (${s.role})`)).toEqual([
      "The Racks (Pull)", "The Machines (Cardio)", "The Mats (Push)", "Open Court (Core)", "Open Court (Legs)", "Open Court (Full Body Cardio)",
    ]);
    expect(STATION_PLAN.boxing_facility.map((s) => `${s.place} (${s.role})`)).toEqual([
      "The Racks (Pull)", "The Heavy Bag (Push)", "The Ring (Core)", "The Uppercut (Legs)", "The Open Floor (Full Body Cardio)",
    ]);
    expect(STATION_PLAN.boxing_facility[1].picks).not.toContain("Sled push");
    expect(STATION_PLAN.performance_center[2].picks).toContain("Sled push");
  });

  it("write the header and each line the way the wall reads it", () => {
    const lines = stationLinesFor(pickStations("boxing_facility", null, [], first));
    expect(lines[0]).toBe("5 stations · 3 min each · rotate on the whistle");
    expect(stationsHeader(6)).toBe("6 stations · 3 min each · rotate on the whistle");
    expect(lines[1]).toBe("Station 1 · The Racks (Pull) — Pull-ups with bands");
    expect(lines[3]).toBe("Station 3 · The Ring (Core) — Coach's choice");
    expect(stationMoveOf("Station 3 · The Mats (Push) — Push-ups — chest to the floor")).toBe("Push-ups");
  });

  it("never repeat the lift: pull-up day keeps pull-ups off the racks", () => {
    const picks = pickStations("performance_center", rotationEntry("Pull-Up"), [], first);
    expect(picks[0].move).toBe("Bent-over rows");
    const cp = pickStations("performance_center", rotationEntry("Clean and Press"), [], () => 0.6);
    expect(cp[2].move).not.toMatch(/ground to overhead/i);
  });

  it("never give a station the same pick as its last session in that room", () => {
    const previous = stationLinesFor(pickStations("performance_center", null, [], first));
    const next = pickStations("performance_center", null, previous, first);
    expect(next[0].move).toBe("Bent-over rows");
    expect(next[2].move).toBe("Sled push");
    // One-item lists — the machines, the coach's choice — print as written every time.
    expect(next[1].move).toBe("Machine of choice");
    expect(next[3].move).toBe("Coach's choice");
  });
});
