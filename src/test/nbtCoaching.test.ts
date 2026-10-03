import { describe, it, expect } from "vitest";
import { NbtDay, NbtLog, NbtWeek, Track } from "@/lib/nbt";
import {
  priorWeekBrief, priorWeekBriefs, roomReport, carryOver, spaceViolation, equipmentClash, liftRepeated, unreadableLine, dayProblem, THIN_ROOM,
} from "@/lib/nbtCoaching";

const day = (pattern: string, b: string, a: string, work = "Engine"): NbtDay => ({
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

describe("priorWeekBrief — both tracks, not just Alpha", () => {
  const w = week(1, "2026-09-07", { monday: day("Squat", "Heavy Goblet", "Back Squat") });

  it("names every track with its dose", () => {
    const b = priorWeekBrief(w, "monday")!;
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
      week(1, "2026-09-07", { monday: day("Squat", "B", "C") }),
      week(2, "2026-09-14", { monday: day("Squat", "B", "C") }),
      week(3, "2026-09-21", { monday: day("Squat", "B", "C") }),
    ];
    expect(priorWeekBriefs(weeks, "monday", 3).map((b) => b.week)).toEqual([1, 2]);
    expect(priorWeekBriefs(weeks, "monday", 1)).toEqual([]);
  });
});

describe("roomReport — anonymised evidence", () => {
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

  it("reports the movement most of a track actually logged", () => {
    const r = roomReport(logs, "monday", "2026-09-20")!;
    expect(r.byTrack.bravo.lift).toBe("Goblet Squat");
    expect(r.byTrack.alpha.lift).toBe("Back Squat");
  });

  it("uses medians, so one outlier cannot move the room", () => {
    const withOutlier = [...logs, log("2026-09-14", "bravo", "Goblet Squat", 500, 24, 6, "rounds", "kid9")];
    expect(roomReport(withOutlier, "monday", "2026-09-20")!.byTrack.bravo.medianTopWeight).toBeLessThan(60);
  });

  it("says nothing about a track nobody trained", () => {
    // Only Alpha showed up. Bravo's report is empty, not invented from Alpha.
    const alphaOnly = logs.filter((l) => l.level === "alpha");
    const r = roomReport(alphaOnly, "monday", "2026-09-20")!;
    expect(r.byTrack.bravo.athletes).toBe(0);
    expect(r.byTrack.bravo.lift).toBeNull();
    expect(r.byTrack.alpha.athletes).toBe(1);
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
    week(1, "2026-08-03", { monday: day("Squat", "Heavy Goblet", "Back Squat") }),
    week(2, "2026-08-10", { monday: day("Squat", "Heavy Goblet", "Back Squat") }),
    week(3, "2026-08-17", { monday: day("Squat", "Heavy Goblet", "Back Squat") }),
  ];

  it("hands over where the block actually finished", () => {
    const c = carryOver(prev, "monday")!;
    expect(c.weekStart).toBe("2026-08-17");
    expect(c.alpha).toBe("Back Squat — 4 × 5");
    expect(c.bravo).toBe("Heavy Goblet — 4 × 6");
  });

  it("counts how long the pattern has run, so six weeks can unlock a change", () => {
    expect(carryOver(prev, "monday")!.weeksOnPattern).toBe(3);
  });

  it("stops counting at the point the pattern changed", () => {
    const switched = [
      week(1, "2026-08-03", { monday: day("Lunge", "DB Split Squat", "Front Rack Lunge") }),
      week(2, "2026-08-10", { monday: day("Squat", "Heavy Goblet", "Back Squat") }),
      week(3, "2026-08-17", { monday: day("Squat", "Heavy Goblet", "Back Squat") }),
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
  const withWork = (lines: string[]): NbtDay => {
    const d = day("Squat", "Heavy Goblet", "Back Squat");
    return { ...d, work: { ...d.work, bravo: lines, alpha: lines } };
  };

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
  });
});

describe("spaceViolation — rewriting one track of an old day", () => {
  it("judges only the track being rewritten, so a legacy day can be fixed piece by piece", () => {
    const d = day("Squat", "Heavy Goblet", "Back Squat");
    const legacy: NbtDay = {
      ...d,
      work: { ...d.work, bravo: ["30 seconds bike"], alpha: ["Run 800m"] },
    };
    expect(spaceViolation(legacy, "tuesday", "bravo")).toBeNull();
    expect(spaceViolation(legacy, "tuesday", "alpha")).not.toBeNull();
    expect(spaceViolation(legacy, "tuesday")).not.toBeNull();
  });
});

describe("equipmentClash — six bikes, six rowers, two tracks at once", () => {
  const withTracks = (
    lift: Record<Track, string>,
    work: Record<Track, string[]>
  ): NbtDay => {
    const d = day("Squat", lift.bravo, lift.alpha);
    return {
      ...d,
      lift: {
        ...d.lift,
        bravo: { name: lift.bravo, detail: "4 × 6" },
        alpha: { name: lift.alpha, detail: "4 × 5" },
      },
      work: { ...d.work, ...work },
    };
  };

  const lifts = { bravo: "Goblet Squat", alpha: "Back Squat" };

  it("refuses two tracks sent to the bikes", () => {
    const d = withTracks(lifts, {
      bravo: ["Bike 45 sec easy"],
      alpha: ["Assault bike 60 sec"],
    });
    expect(equipmentClash(d)).toMatch(/bikes/i);
  });

  it("refuses two tracks sent to the rowers", () => {
    const d = withTracks(lifts, {
      bravo: ["Row 200m steady"],
      alpha: ["Rower, 90 seconds"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("allows one track per machine", () => {
    const d = withTracks(lifts, {
      bravo: ["Row 250m", "Air squats x15"],
      alpha: ["Assault bike 60 sec", "Burpees x10"],
    });
    expect(equipmentClash(d)).toBeNull();
  });

  it("lets both tracks hold dumbbells on the lift — there are plenty", () => {
    const d = withTracks(
      { bravo: "Seated DB Overhead Press", alpha: "Standing DB Overhead Press" },
      { bravo: ["Burpees"], alpha: ["Jump rope"] }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("passes the implement ladder — dumbbell, barbell", () => {
    const d = withTracks(
      { bravo: "Standing DB Overhead Press", alpha: "Standing Barbell Press" },
      { bravo: ["Row 250m"], alpha: ["Assault bike 60 sec"] }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("does not mistake a pulling exercise for the rowing machine", () => {
    const d = withTracks(
      { bravo: "DB Row", alpha: "Barbell Row" },
      { bravo: ["Jump rope 60 sec"], alpha: ["Med ball slams"] }
    );
    // Two rows, neither of them the erg — and only Bravo is on a dumbbell.
    expect(equipmentClash(d)).toBeNull();
  });

  it("still catches the erg when it is written as a distance", () => {
    const d = withTracks(lifts, {
      bravo: ["Row 300m"],
      alpha: ["Row 500m"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("lets both tracks use med balls, ropes and bodyweight", () => {
    const d = withTracks(
      { bravo: "Goblet Squat", alpha: "Back Squat" },
      {
        bravo: ["Med ball slams x15", "Jump rope 60 sec"],
        alpha: ["Med ball slams x20", "Jump rope 60 sec"],
      }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("names both offending tracks so a coach knows what to change", () => {
    const d = withTracks(
      { bravo: "DB Bench Press", alpha: "Barbell Bench Press" },
      { bravo: ["Kettlebell swings x15"], alpha: ["KB carry 30 sec"] }
    );
    expect(equipmentClash(d)).toMatch(/Alpha and Bravo are both on the benches/);
  });

  it("treats the three benches as the scarce thing, never the dumbbells", () => {
    const d = withTracks(
      { bravo: "KB Goblet Squat", alpha: "Back Squat" },
      { bravo: ["Jump rope"], alpha: ["DB step-ups x10"] }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("sees a front squat as needing a rack even though it never says so", () => {
    const d = withTracks(
      { bravo: "Front Squat", alpha: "Back Squat" },
      { bravo: ["Jump rope"], alpha: ["KB swings x15"] }
    );
    expect(equipmentClash(d)).toMatch(/squat racks/);
  });
});

describe("dayProblem — the room, then the kit", () => {
  it("reports the room first, because a session nobody can perform is worse", () => {
    const d = day("Squat", "Goblet Squat", "Back Squat");
    const bad: NbtDay = {
      ...d,
      work: { ...d.work, bravo: ["Run 400m", "Bike 60 sec"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(bad, "tuesday")).toMatch(/no room to run/i);
  });

  it("falls through to equipment once the room is fine", () => {
    const d = day("Squat", "Goblet Squat", "Back Squat");
    const bad: NbtDay = {
      ...d,
      work: { ...d.work, bravo: ["Bike 60 sec"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(bad, "tuesday")).toMatch(/bikes/i);
  });

  it("passes a day that fits both — machines on a Performance Center day", () => {
    const d = day("Squat", "Goblet Squat", "Back Squat");
    const ok: NbtDay = {
      ...d,
      work: { ...d.work, bravo: ["Row 250m"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(ok, "monday")).toBeNull();
    // The same circuit on Tuesday is refused: the machines are in the other building.
    expect(dayProblem(ok, "tuesday")).toMatch(/no (?:bikes|rowers)/);
  });
});

describe("equipmentClash — the rowing machine versus the rowing exercise", () => {
  const ladder = { bravo: "DB Row", alpha: "Barbell Row" };
  const build = (work: Record<Track, string[]>): NbtDay => {
    const d = day("Pull", ladder.bravo, ladder.alpha);
    return {
      ...d,
      lift: {
        ...d.lift,
        bravo: { name: ladder.bravo, detail: "4 × 6" },
        alpha: { name: ladder.alpha, detail: "4 × 5" },
      },
      work: { ...d.work, ...work },
    };
  };

  it("does not let a rest line further down turn a DB row into the erg", () => {
    // Bravo's lift is a DB row. Its circuit mentions "2 min" on a LATER line.
    // Before the lookahead was line-bounded that read as "row ... 2 min" = erg,
    // and clashed with Alpha's genuine rower.
    const d = build({
      bravo: ["Burpees x10", "Rest 2 min"],
      alpha: ["Row 250m easy"],
    });
    expect(equipmentClash(d)).toBeNull();
  });

  it("does count a rower written with a pace instead of a distance", () => {
    const d = build({
      bravo: ["Row: easy conversational pace"],
      alpha: ["Row: strong, sustainable pace"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("tells the model how to split the stations, not just that they clash", () => {
    const d = build({
      bravo: ["Bike 60 sec"],
      alpha: ["Bike 60 sec hard"],
    });
    const msg = equipmentClash(d)!;
    expect(msg).toMatch(/Alpha and Bravo are both/);
    expect(msg).toMatch(/one track per block/i);
  });
});

describe("liftRepeated — the circuit never repeats the lift", () => {
  const build = (lift: Record<Track, string>, work: Record<Track, string[]>): NbtDay => {
    const d = day("Hinge", lift.bravo, lift.alpha);
    return {
      ...d,
      lift: {
        ...d.lift,
        bravo: { name: lift.bravo, detail: "4 × 6" },
        alpha: { name: lift.alpha, detail: "4 × 5" },
      },
      work: { ...d.work, ...work },
    };
  };
  const hinge = { bravo: "DB Romanian Deadlift", alpha: "Barbell RDL" };

  it("refuses the same movement with a different weight in front of it", () => {
    const d = build(hinge, {
      bravo: ["Light DB Romanian deadlifts x12", "Burpees"],
      alpha: ["Swings x15"],
    });
    expect(liftRepeated(d)).toMatch(/Bravo/);
  });

  it("knows RDL and Romanian deadlift are the same thing", () => {
    const d = build(hinge, {
      bravo: ["Burpees"],
      alpha: ["Romanian deadlift x10, light bar"],
    });
    expect(liftRepeated(d)).toMatch(/Alpha/);
  });

  it("allows a different movement in the same pattern", () => {
    const d = build(hinge, {
      bravo: ["Single-leg KB deadlift x8 each", "Med ball ground-to-overhead x10"],
      alpha: ["KB swings x15", "Hip bridge x20"],
    });
    expect(liftRepeated(d)).toBeNull();
  });

  it("is per track — Bravo's lift does not police Alpha's circuit", () => {
    const d = build(
      { bravo: "Goblet Squat", alpha: "Back Squat" },
      { bravo: ["Step-ups x10", "Wall sit 30s"], alpha: ["Goblet squats x15"] }
    );
    expect(liftRepeated(d)).toBeNull();
  });

  it("does refuse a track repeating its own bodyweight lift", () => {
    const d = build(
      { bravo: "Tempo Air Squat", alpha: "Back Squat" },
      { bravo: ["10 air squats"], alpha: ["Lunges"] }
    );
    expect(liftRepeated(d)).toMatch(/Bravo/);
  });

  it("does not read 'back squat' as a repeat of 'air squat'", () => {
    const d = build(
      { bravo: "Air Squat", alpha: "Back Squat" },
      { bravo: ["Step-ups"], alpha: ["12 air squats, own pace"] }
    );
    expect(liftRepeated(d)).toBeNull();
  });

  it("checks each half of a combined lift", () => {
    const d = build(
      { bravo: "DB RDL + DB Row", alpha: "Barbell RDL + Pull-Up" },
      { bravo: ["Burpees"], alpha: ["Pull-ups x5", "Swings"] }
    );
    expect(liftRepeated(d)).toMatch(/Alpha/);
  });

  it("does not mistake the rowing machine for the rowing exercise", () => {
    const d = build(
      { bravo: "DB Row", alpha: "Barbell Row" },
      { bravo: ["Row 250m"], alpha: ["Burpees"] }
    );
    expect(liftRepeated(d)).toBeNull();
  });

  it("handles plurals and hyphens", () => {
    const d = build(
      { bravo: "Incline Push-up", alpha: "Barbell Bench Press" },
      { bravo: ["10 pushups"], alpha: ["Dips"] }
    );
    expect(liftRepeated(d)).toMatch(/Bravo/);
  });

  it("tells the model what to do instead", () => {
    const d = build(hinge, { bravo: ["Romanian deadlift x12"], alpha: ["Swings"] });
    expect(liftRepeated(d)).toMatch(/different, simpler movement/);
  });
});

describe("dayProblem — order of checks", () => {
  it("reaches the repeat check once room and kit are fine", () => {
    const d = day("Hinge", "DB RDL", "Barbell RDL");
    const bad: NbtDay = {
      ...d,
      work: { ...d.work, bravo: ["Row 250m"], alpha: ["RDL x10", "Bike 45s"] },
    };
    expect(dayProblem(bad, "thursday")).toMatch(/repeats its lift/);
  });
});

describe("unreadableLine — every line stands on its own", () => {
  const build = (work: Record<Track, string[]>): NbtDay => {
    const d = day("Squat", "Goblet Squat", "Back Squat");
    return { ...d, work: { ...d.work, ...work } };
  };
  const fine = ["4 rounds — rest 45 sec", "Jump rope — 30 sec — steady"];

  it("refuses a heading with nothing on it", () => {
    expect(unreadableLine(build({ alpha: ["Bike station:", "30 sec strong"], bravo: fine }))).toMatch(/heading/);
  });

  it("refuses a line that opens with a time and no movement", () => {
    expect(unreadableLine(build({ alpha: [":30 strong effort"], bravo: fine }))).toMatch(/starts with a time/);
    expect(unreadableLine(build({ alpha: fine, bravo: ["250m controlled pace"] }))).toMatch(/Bravo/);
  });

  it("allows a structure line that begins with a time", () => {
    expect(unreadableLine(build({ alpha: ["12 min AMRAP", "Burpees — 10"], bravo: fine }))).toBeNull();
  });

  it("allows a shuttle written as a distance-named movement", () => {
    expect(unreadableLine(build({ alpha: ["15-yard shuttle × 2 — strong"], bravo: fine }))).toBeNull();
  });

  it("says how to write it instead", () => {
    expect(unreadableLine(build({ alpha: ["Rower:"], bravo: fine }))).toMatch(/Assault bike — 30 sec/);
  });
});
