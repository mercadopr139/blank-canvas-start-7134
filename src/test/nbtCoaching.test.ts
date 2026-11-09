import { describe, it, expect } from "vitest";
import { NbtDay, NbtLog, NbtWeek, Track } from "@/lib/nbt";
import {
  priorWeekBrief, priorWeekBriefs, roomReport, carryOver, spaceViolation, liftRepeated, unreadableLine, dayProblem, dayForModel, THIN_ROOM,
} from "@/lib/nbtCoaching";

// One group since 2026-11-09: one lift for everyone, with an easier and a
// harder version, then the work block.
const day = (pattern: string, lift: string, work: string[] = [], title = "Engine"): NbtDay => ({
  focus: "f",
  prep: ["p"],
  lift: {
    pattern,
    main: { name: lift, detail: "4 × 5" },
    easier: "Goblet squat with a kettlebell — same sets, 8 reps",
    harder: "Add a 3-second pause at the bottom",
    cues: [],
  },
  work: { emphasis: "intervals", title, shared: work, bravo: [], alpha: [], result_unit: "rounds" },
  reset: ["r"],
});

/** A day written while there were still two tracks. */
const twoTracks = (pattern: string, b: string, a: string, work = "Engine"): NbtDay => ({
  focus: "f",
  prep: ["p"],
  lift: {
    pattern,
    bravo: { name: b, detail: "4 × 6" },
    alpha: { name: a, detail: "4 × 5" },
    cues: [],
  },
  work: { emphasis: "intervals", title: work, bravo: [], alpha: [], result_unit: "rounds" },
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

describe("priorWeekBrief — the lift and its modification", () => {
  const w = week(1, "2026-11-02", { monday: day("Squat", "Back Squat") });

  it("names the lift with its dose, and the easier and harder versions", () => {
    const b = priorWeekBrief(w, "monday")!;
    expect(b.lift).toBe("Back Squat — 4 × 5");
    expect(b.easier).toBe("Goblet squat with a kettlebell — same sets, 8 reps");
    expect(b.harder).toBe("Add a 3-second pause at the bottom");
    expect(b.pattern).toBe("Squat");
  });

  it("reads a two-track week as one group: Alpha's lift, Bravo's as the easier version", () => {
    const old = week(1, "2026-09-07", { monday: twoTracks("Squat", "Heavy Goblet", "Back Squat") });
    const b = priorWeekBrief(old, "monday")!;
    expect(b.lift).toBe("Back Squat — 4 × 5");
    expect(b.easier).toBe("Heavy Goblet — 4 × 6");
    expect(b.harder).toBe("—");
  });

  it("carries the circuit and its emphasis", () => {
    expect(priorWeekBrief(w, "monday")!.work).toBe("Engine — intervals");
  });

  it("is null for a day that was never written", () => {
    expect(priorWeekBrief(w, "thursday")).toBeNull();
  });

  it("only returns weeks earlier than the one being written", () => {
    const weeks = [
      week(1, "2026-09-07", { monday: day("Squat", "Back Squat") }),
      week(2, "2026-09-14", { monday: day("Squat", "Back Squat") }),
      week(3, "2026-09-21", { monday: day("Squat", "Back Squat") }),
    ];
    expect(priorWeekBriefs(weeks, "monday", 3).map((b) => b.week)).toEqual([1, 2]);
    expect(priorWeekBriefs(weeks, "monday", 1)).toEqual([]);
  });
});

describe("dayForModel — a day handed back to be partly rewritten", () => {
  it("goes over in the shape the generator writes", () => {
    const d = day("Squat", "Back Squat", ["6 stations · 2 min each · rotate on the whistle", "Station 1 · The Racks — 10 wall balls"]);
    expect(dayForModel(d)).toEqual({
      focus: "f",
      prep: ["p"],
      lift: {
        pattern: "Squat",
        main: { name: "Back Squat", detail: "4 × 5" },
        easier: "Goblet squat with a kettlebell — same sets, 8 reps",
        harder: "Add a 3-second pause at the bottom",
        cues: [],
      },
      work: { emphasis: "intervals", stations: d.work.shared, result_unit: "rounds" },
      reset: ["r"],
    });
  });

  it("sends a two-track day as one group, with no word of the tracks", () => {
    const sent = dayForModel(twoTracks("Squat", "Heavy Goblet", "Back Squat"));
    expect(sent.lift.main).toEqual({ name: "Back Squat", detail: "4 × 5" });
    expect(sent.lift.easier).toBe("Heavy Goblet — 4 × 6");
    expect(JSON.stringify(sent)).not.toMatch(/alpha|bravo/i);
  });
});

describe("roomReport — anonymised evidence", () => {
  // Rows logged while there were two tracks still count: one room, one report.
  const logs = [
    log("2026-09-07", "bravo", "Goblet Squat", 25, 24, 5, "rounds", "kid1"),
    log("2026-09-07", "bravo", "Goblet Squat", 30, 24, 4, "rounds", "kid2"),
    log("2026-09-07", "alpha", "Back Squat", 135, 20, 6, "rounds", "kid3"),
    log("2026-09-14", "bravo", "Goblet Squat", 30, 24, 6, "rounds", "kid1"),
    log("2026-09-14", "bravo", "Goblet Squat", 35, 24, 6, "rounds", "kid2"),
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

  it("reports the room as one group, whatever track an old row was filed under", () => {
    const r = roomReport(logs, "monday", "2026-09-20")!;
    expect(r.lift).toBe("Goblet Squat");
    expect(r.medianReps).toBe(24);
    expect(r.unit).toBe("rounds");
    expect(JSON.stringify(r)).not.toMatch(/alpha|bravo|byTrack/i);
  });

  it("uses medians, so one outlier cannot move the room", () => {
    const withOutlier = [...logs, log("2026-09-14", "bravo", "Goblet Squat", 500, 24, 6, "rounds", "kid9")];
    expect(roomReport(withOutlier, "monday", "2026-09-20")!.medianTopWeight).toBeLessThan(60);
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
    const blank = [{ ...log("2026-09-07", "bravo", "Goblet Squat", 0, 0, null, null, "kid5"), sets: [] }];
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
    week(1, "2026-08-03", { monday: day("Squat", "Back Squat") }),
    week(2, "2026-08-10", { monday: day("Squat", "Back Squat") }),
    week(3, "2026-08-17", { monday: day("Squat", "Back Squat") }),
  ];

  it("hands over where the block actually finished", () => {
    const c = carryOver(prev, "monday")!;
    expect(c.weekStart).toBe("2026-08-17");
    expect(c.lift).toBe("Back Squat — 4 × 5");
    expect(c.easier).toBe("Goblet squat with a kettlebell — same sets, 8 reps");
    expect(c.harder).toBe("Add a 3-second pause at the bottom");
  });

  it("hands over a two-track month as one group — the first one-group week continues from it", () => {
    const old = [week(4, "2026-10-26", { monday: twoTracks("Squat", "Heavy Goblet", "Back Squat") })];
    const c = carryOver(old, "monday")!;
    expect(c.lift).toBe("Back Squat — 4 × 5");
    expect(c.easier).toBe("Heavy Goblet — 4 × 6");
  });

  it("counts how long the pattern has run, so six weeks can unlock a change", () => {
    expect(carryOver(prev, "monday")!.weeksOnPattern).toBe(3);
  });

  it("stops counting at the point the pattern changed", () => {
    const switched = [
      week(1, "2026-08-03", { monday: day("Lunge", "Front Rack Lunge") }),
      week(2, "2026-08-10", { monday: day("Squat", "Back Squat") }),
      week(3, "2026-08-17", { monday: day("Squat", "Back Squat") }),
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

describe("spaceViolation — the room is a hard limit", () => {
  const withWork = (lines: string[]): NbtDay => day("Squat", "Back Squat", lines);

  describe("Tuesday — boxing facility, no floor at all", () => {
    it("refuses a run", () => {
      expect(spaceViolation(withWork(["Run 200m"]), "tuesday")).toMatch(/no room to run/i);
    });

    it("refuses a jog, a lap, a shuttle and a suicide", () => {
      ["Easy jog 3 min", "2 laps of the gym", "10 shuttles", "Suicides x4"].forEach((line) => {
        expect(spaceViolation(withWork([line]), "tuesday")).not.toBeNull();
      });
    });

    it("refuses running hidden in the warm-up rather than the circuit", () => {
      const d = { ...withWork(["10 burpees"]), prep: ["Two easy laps to warm up"] };
      expect(spaceViolation(d, "tuesday")).not.toBeNull();
    });

    it("refuses running hidden in the easier or harder version of the lift", () => {
      const d = withWork(["10 burpees"]);
      expect(spaceViolation({ ...d, lift: { ...d.lift, harder: "Finish each set with a shuttle" } }, "tuesday")).not.toBeNull();
    });

    it("allows the conditioning that actually fits the room", () => {
      const lines = [
        "Row 500m", "Bike 90 seconds hard", "Ski erg 250m", "40 double-unders",
        "15 air squats", "10 burpees", "Med ball slams x12", "KB goblet carry",
      ];
      expect(spaceViolation(withWork(lines), "tuesday")).toBeNull();
    });

    it("does not trip over gym language that stands still", () => {
      expect(spaceViolation(withWork(["12 minute running clock"]), "tuesday")).toBeNull();
      expect(spaceViolation(withWork(["Run through the movement slowly"]), "tuesday")).toBeNull();
    });
  });

  describe("Monday and Thursday — 25 yards on the court", () => {
    it("allows a shuttle inside the court", () => {
      expect(spaceViolation(withWork(["6 x 25 yard shuttle"]), "monday")).toBeNull();
      expect(spaceViolation(withWork(["5-10-15-25 yard suicide"]), "thursday")).toBeNull();
    });

    it("refuses a distance the court cannot hold", () => {
      expect(spaceViolation(withWork(["Run 400m"]), "monday")).toMatch(/25 yards/);
      expect(spaceViolation(withWork(["Run 1 mile"]), "thursday")).not.toBeNull();
      expect(spaceViolation(withWork(["Sprint 50 yards"]), "monday")).not.toBeNull();
    });

    it("refuses laps outright — there is nothing to lap", () => {
      expect(spaceViolation(withWork(["3 laps of the court"]), "monday")).toMatch(/laps/i);
    });

    it("lets a machine distance through, since it covers no floor", () => {
      expect(spaceViolation(withWork(["Row 500m"]), "monday")).toBeNull();
    });

    it("reads every part of the day, not just the circuit", () => {
      const d = { ...withWork(["10 burpees"]), reset: ["Cool down with 2 laps"] };
      expect(spaceViolation(d, "monday")).not.toBeNull();
    });

    it("still reads the circuit of a week written for two tracks", () => {
      const old = twoTracks("Squat", "Heavy Goblet", "Back Squat");
      const d: NbtDay = { ...old, work: { ...old.work, alpha: ["Run 800m"], bravo: ["30 seconds bike"] } };
      expect(spaceViolation(d, "monday")).toMatch(/25 yards/);
    });
  });
});

describe("dayProblem — the room, then the kit", () => {
  it("reports the room first, because a session nobody can perform is worse", () => {
    const bad = day("Squat", "Back Squat", ["Run 400m", "Bike 60 sec"]);
    expect(dayProblem(bad, "tuesday")).toMatch(/no room to run/i);
  });

  it("falls through to the kit once the room is fine", () => {
    const bad = day("Squat", "Back Squat", ["Bike 60 sec"]);
    expect(dayProblem(bad, "tuesday")).toMatch(/no bikes/i);
  });

  it("passes a day that fits both — machines on a Performance Center day", () => {
    const ok = day("Squat", "Back Squat", ["Row 250m", "Assault bike 60 sec"]);
    expect(dayProblem(ok, "monday")).toBeNull();
    // The same circuit on Tuesday is refused: the machines are in the other building.
    expect(dayProblem(ok, "tuesday")).toMatch(/no (?:bikes|rowers)/);
  });

  it("no longer refuses a rack lift for the whole group — a dozen share three racks in turns", () => {
    // With two tracks, both on the racks was a clash. One group rotates through them.
    const d = day("Squat", "Back Squat", ["Jump rope 60 skips"]);
    expect(dayProblem({ ...d, lift: { ...d.lift, easier: "Front squat with an empty bar", harder: "Pause squat" } }, "monday")).toBeNull();
    const pull = day("Pull", "Pull-Up", ["Jump rope 60 skips"]);
    expect(dayProblem({ ...pull, lift: { ...pull.lift, easier: "Inverted row on the rack", harder: "Slow lowering" } }, "thursday")).toBeNull();
  });
});

describe("liftRepeated — the stations never repeat the lift", () => {
  it("refuses the same movement with a different weight in front of it", () => {
    const d = day("Hinge", "DB Romanian Deadlift", ["Light DB Romanian deadlifts x12", "Burpees"]);
    expect(liftRepeated(d)).toMatch(/stations repeat the lift/);
  });

  it("knows RDL and Romanian deadlift are the same thing", () => {
    const d = day("Hinge", "Barbell RDL", ["Burpees", "Romanian deadlift x10, light bar"]);
    expect(liftRepeated(d)).toMatch(/Romanian deadlift x10/);
  });

  it("allows a different movement in the same pattern", () => {
    const d = day("Hinge", "Barbell RDL", ["Single-leg KB deadlift x8 each", "KB swings x15", "Hip bridge x20"]);
    expect(liftRepeated(d)).toBeNull();
  });

  it("refuses a station repeating a bodyweight lift", () => {
    expect(liftRepeated(day("Squat", "Tempo Air Squat", ["10 air squats"]))).not.toBeNull();
  });

  it("does not read 'air squat' as a repeat of 'back squat'", () => {
    expect(liftRepeated(day("Squat", "Back Squat", ["12 air squats, own pace"]))).toBeNull();
  });

  it("checks each half of a combined lift", () => {
    const d = day("Hinge", "Barbell RDL + Pull-Up", ["Pull-ups x5", "Swings"]);
    expect(liftRepeated(d)).toMatch(/Pull-ups x5/);
  });

  it("does not mistake the rowing machine for the rowing exercise", () => {
    expect(liftRepeated(day("Pull", "Barbell Row", ["Row 250m"]))).toBeNull();
  });

  it("handles plurals and hyphens", () => {
    expect(liftRepeated(day("Push", "Incline Push-up", ["10 pushups"]))).not.toBeNull();
  });

  it("reads the lift of a week written for two tracks", () => {
    const old = twoTracks("Hinge", "DB RDL", "Barbell RDL");
    const d: NbtDay = { ...old, work: { ...old.work, alpha: ["RDL x10"], bravo: ["Row 250m"] } };
    expect(liftRepeated(d)).toMatch(/RDL x10/);
  });

  it("tells the model what to do instead", () => {
    const d = day("Hinge", "Barbell RDL", ["Romanian deadlift x12"]);
    expect(liftRepeated(d)).toMatch(/different, simpler movement/);
  });
});

describe("dayProblem — order of checks", () => {
  it("reaches the repeat check once room and kit are fine", () => {
    const bad = day("Hinge", "Barbell RDL", ["RDL x10", "Bike 45s"]);
    expect(dayProblem(bad, "thursday")).toMatch(/repeat the lift/);
  });
});

describe("unreadableLine — every line stands on its own", () => {
  const build = (work: string[]): NbtDay => day("Squat", "Back Squat", work);

  it("refuses a heading with nothing on it", () => {
    expect(unreadableLine(build(["Bike station:", "30 sec strong"]))).toMatch(/heading/);
  });

  it("refuses a line that opens with a time and no movement", () => {
    expect(unreadableLine(build([":30 strong effort"]))).toMatch(/starts with a time/);
    expect(unreadableLine(build(["Jump rope — steady", "250m controlled pace"]))).toMatch(/250m controlled pace/);
  });

  it("allows a structure line that begins with a time", () => {
    expect(unreadableLine(build(["12 min AMRAP", "Burpees — 10"]))).toBeNull();
  });

  it("allows a shuttle written as a distance-named movement", () => {
    expect(unreadableLine(build(["15-yard shuttle × 2 — strong"]))).toBeNull();
  });

  it("says how to write it instead", () => {
    expect(unreadableLine(build(["Rower:"]))).toMatch(/Station 3 · The Bikes — bike — strong but repeatable/);
  });
});
