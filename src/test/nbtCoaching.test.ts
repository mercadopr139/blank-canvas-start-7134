import { describe, it, expect } from "vitest";
import { NbtDay, NbtLog, NbtWeek, Track } from "@/lib/nbt";
import {
  priorWeekBrief, priorWeekBriefs, roomReport, carryOver, spaceViolation, equipmentClash, dayProblem, THIN_ROOM,
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

describe("spaceViolation — the room is a hard limit", () => {
  const withWork = (lines: string[]): NbtDay => {
    const d = day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat");
    return { ...d, work: { ...d.work, charlie: lines, bravo: lines, alpha: lines } };
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
    const d = day("Squat", "Goblet Squat", "Heavy Goblet", "Back Squat");
    const legacy: NbtDay = {
      ...d,
      work: { ...d.work, charlie: ["30 seconds bike"], bravo: ["Run 400m"], alpha: ["Run 800m"] },
    };
    expect(spaceViolation(legacy, "tuesday", "charlie")).toBeNull();
    expect(spaceViolation(legacy, "tuesday", "bravo")).not.toBeNull();
    expect(spaceViolation(legacy, "tuesday")).not.toBeNull();
  });
});

describe("equipmentClash — six bikes, six rowers, three tracks at once", () => {
  const withTracks = (
    lift: Record<Track, string>,
    work: Record<Track, string[]>
  ): NbtDay => {
    const d = day("Squat", lift.charlie, lift.bravo, lift.alpha);
    return {
      ...d,
      lift: {
        ...d.lift,
        charlie: { name: lift.charlie, detail: "3 × 8" },
        bravo: { name: lift.bravo, detail: "4 × 6" },
        alpha: { name: lift.alpha, detail: "4 × 5" },
      },
      work: { ...d.work, ...work },
    };
  };

  const lifts = { charlie: "Air Squat", bravo: "Goblet Squat", alpha: "Back Squat" };

  it("refuses two tracks sent to the bikes", () => {
    const d = withTracks(lifts, {
      charlie: ["Bike 45 sec easy"],
      bravo: ["Assault bike 60 sec"],
      alpha: ["Med ball slams x15"],
    });
    expect(equipmentClash(d)).toMatch(/bikes/i);
  });

  it("refuses two tracks sent to the rowers", () => {
    const d = withTracks(lifts, {
      charlie: ["Row 200m steady"],
      bravo: ["Rower, 90 seconds"],
      alpha: ["Burpees x10"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("allows one track per machine, the third on the floor", () => {
    const d = withTracks(lifts, {
      charlie: ["Jump rope 60 sec", "Med ball slams x12"],
      bravo: ["Row 250m", "Air squats x15"],
      alpha: ["Assault bike 60 sec", "Burpees x10"],
    });
    expect(equipmentClash(d)).toBeNull();
  });

  it("refuses two tracks holding dumbbells on the lift", () => {
    const d = withTracks(
      { charlie: "Seated DB Overhead Press", bravo: "Standing DB Overhead Press", alpha: "Barbell Press" },
      { charlie: ["Burpees"], bravo: ["Jump rope"], alpha: ["Med ball"] }
    );
    expect(equipmentClash(d)).toMatch(/dumbbells/i);
  });

  it("passes the implement ladder — bodyweight, dumbbell, barbell", () => {
    const d = withTracks(
      { charlie: "Band Overhead Press", bravo: "Standing DB Overhead Press", alpha: "Standing Barbell Press" },
      { charlie: ["Jump rope"], bravo: ["Row 250m"], alpha: ["Assault bike 60 sec"] }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("does not mistake a pulling exercise for the rowing machine", () => {
    const d = withTracks(
      { charlie: "Inverted Row", bravo: "DB Row", alpha: "Barbell Row" },
      { charlie: ["Burpees x10"], bravo: ["Jump rope 60 sec"], alpha: ["Med ball slams"] }
    );
    // Three rows, none of them the erg — and only Bravo is on a dumbbell.
    expect(equipmentClash(d)).toBeNull();
  });

  it("still catches the erg when it is written as a distance", () => {
    const d = withTracks(lifts, {
      charlie: ["Row 300m"],
      bravo: ["Row 500m"],
      alpha: ["Burpees"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("lets all three use med balls, ropes and bodyweight", () => {
    const d = withTracks(
      { charlie: "Air Squat", bravo: "Goblet Squat", alpha: "Back Squat" },
      {
        charlie: ["Med ball slams x10", "Jump rope 45 sec"],
        bravo: ["Med ball slams x15", "Jump rope 60 sec"],
        alpha: ["Med ball slams x20", "Jump rope 60 sec"],
      }
    );
    expect(equipmentClash(d)).toBeNull();
  });

  it("names both offending tracks so a coach knows what to change", () => {
    const d = withTracks(
      { charlie: "Air Squat", bravo: "Band Good Morning", alpha: "Back Squat" },
      {
        charlie: ["Kettlebell swings x15"],
        bravo: ["Jump rope"],
        alpha: ["KB carry 30 sec"],
      }
    );
    expect(equipmentClash(d)).toMatch(/Alpha and Charlie/);
  });

  it("counts dumbbells and kettlebells as one rack, not two", () => {
    const d = withTracks(
      { charlie: "Air Squat", bravo: "KB Goblet Squat", alpha: "Back Squat" },
      { charlie: ["DB step-ups x10"], bravo: ["Jump rope"], alpha: ["Burpees"] }
    );
    expect(equipmentClash(d)).toMatch(/dumbbells and kettlebells/i);
  });

  it("sees a goblet squat as a hand weight even though it never says so", () => {
    const d = withTracks(
      { charlie: "Goblet Squat", bravo: "Heavy Goblet Squat", alpha: "Back Squat" },
      { charlie: ["Burpees"], bravo: ["Jump rope"], alpha: ["Med ball slams"] }
    );
    expect(equipmentClash(d)).not.toBeNull();
  });
});

describe("dayProblem — the room, then the kit", () => {
  it("reports the room first, because a session nobody can perform is worse", () => {
    const d = day("Squat", "Air Squat", "Goblet Squat", "Back Squat");
    const bad: NbtDay = {
      ...d,
      work: { ...d.work, charlie: ["Run 400m"], bravo: ["Bike 60 sec"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(bad, "tuesday")).toMatch(/no room to run/i);
  });

  it("falls through to equipment once the room is fine", () => {
    const d = day("Squat", "Air Squat", "Goblet Squat", "Back Squat");
    const bad: NbtDay = {
      ...d,
      work: { ...d.work, charlie: ["Burpees"], bravo: ["Bike 60 sec"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(bad, "tuesday")).toMatch(/bikes/i);
  });

  it("passes a day that fits both", () => {
    const d = day("Squat", "Air Squat", "Goblet Squat", "Back Squat");
    const ok: NbtDay = {
      ...d,
      work: { ...d.work, charlie: ["Burpees x10"], bravo: ["Row 250m"], alpha: ["Assault bike 60 sec"] },
    };
    expect(dayProblem(ok, "tuesday")).toBeNull();
  });
});

describe("equipmentClash — the rowing machine versus the rowing exercise", () => {
  const ladder = { charlie: "Inverted Row", bravo: "DB Row", alpha: "Barbell Row" };
  const build = (work: Record<Track, string[]>): NbtDay => {
    const d = day("Pull", ladder.charlie, ladder.bravo, ladder.alpha);
    return {
      ...d,
      lift: {
        ...d.lift,
        charlie: { name: ladder.charlie, detail: "3 × 8" },
        bravo: { name: ladder.bravo, detail: "4 × 6" },
        alpha: { name: ladder.alpha, detail: "4 × 5" },
      },
      work: { ...d.work, ...work },
    };
  };

  it("does not let a rest line further down turn a DB row into the erg", () => {
    // Bravo's lift is a DB row. Its circuit mentions "2 min" on a LATER line.
    // Before the lookahead was line-bounded that read as "row ... 2 min" = erg,
    // and clashed with Charlie's genuine rower.
    const d = build({
      charlie: ["Row 250m easy"],
      bravo: ["Burpees x10", "Rest 2 min"],
      alpha: ["Med ball slams"],
    });
    expect(equipmentClash(d)).toBeNull();
  });

  it("does count a rower written with a pace instead of a distance", () => {
    const d = build({
      charlie: ["Row: easy conversational pace"],
      bravo: ["Row: strong, sustainable pace"],
      alpha: ["Med ball slams"],
    });
    expect(equipmentClash(d)).toMatch(/rowers/i);
  });

  it("tells the model how to split the stations, not just that they clash", () => {
    const d = build({
      charlie: ["Assault bike 45 sec"],
      bravo: ["Bike 60 sec"],
      alpha: ["Bike 60 sec hard"],
    });
    const msg = equipmentClash(d)!;
    expect(msg).toMatch(/Alpha, Bravo and Charlie are all/);
    expect(msg).toMatch(/different station/i);
  });
});
