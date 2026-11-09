import { describe, it, expect } from "vitest";
import { ROOMS, roomFor, kitIn, absentKit, roomBrief, KIT_PATTERNS } from "@/lib/nbtRooms";
import { courtAxisClash, missingKit, dayProblem, courtLanguage } from "@/lib/nbtCoaching";
import type { NbtDay } from "@/lib/nbt";

// One group since 2026-11-09: one lift for everyone, then the work block.
const day = (lift: string, work: string[], mods: { easier?: string; harder?: string } = {}): NbtDay => ({
  focus: "",
  prep: ["Air squats × 10"],
  lift: {
    pattern: "Squat",
    main: { name: lift, detail: "4 × 5" },
    easier: mods.easier ?? "",
    harder: mods.harder ?? "",
    cues: [],
  },
  work: { emphasis: "intervals", title: "Circuit", shared: work, bravo: [], alpha: [], result_unit: "rounds" },
  reset: [],
});

describe("The two rooms", () => {
  it("put Monday and Thursday in the Performance Center and Tuesday in the boxing facility", () => {
    expect(roomFor("monday").name).toBe("Performance Center");
    expect(roomFor("thursday").name).toBe("Performance Center");
    expect(roomFor("tuesday").name).toBe("boxing facility");
  });

  it("know what is counted, what there is plenty of, and what is not there", () => {
    const pc = ROOMS.performance_center;
    expect(kitIn(pc, "rack")).toMatchObject({ count: 3 });
    expect(kitIn(pc, "bench")).toMatchObject({ count: 3 });
    expect(kitIn(pc, "skier")).toMatchObject({ count: 2 });
    // One sled does not work for a group: it is deliberately not in the room.
    expect(kitIn(pc, "sled")).toBeUndefined();
    expect(kitIn(pc, "box")).toMatchObject({ count: 4 });
    expect(kitIn(pc, "barbell")).toMatchObject({ count: "plenty" });
    expect(kitIn(pc, "handWeight")).toMatchObject({ count: "plenty" });

    const bf = ROOMS.boxing_facility;
    expect(kitIn(bf, "rack")).toMatchObject({ count: 6 });
    expect(kitIn(bf, "bench")).toMatchObject({ count: 6 });
    expect(absentKit(bf).sort()).toEqual(["bike", "rower", "skier", "sled"]);
    expect(absentKit(pc)).toEqual(["sled"]);
  });

  it("describe themselves for the generator from the same inventory", () => {
    const tue = roomBrief("tuesday");
    expect(tue).toMatch(/boxing facility/);
    expect(tue).toMatch(/NOT IN THIS ROOM.*bikes.*rowers.*ski ergs.*sled/);
    expect(tue).toMatch(/COUNTED.*squat racks \(6\).*benches \(6\)/);
    const mon = roomBrief("monday");
    expect(mon).toMatch(/COUNTED.*squat racks \(3\).*benches \(3\).*assault bikes \(6\)/);
    expect(mon).toMatch(/75 ft baseline to baseline, 56 ft sideline to sideline/);
    expect(mon).toMatch(/never in metres, yards or feet/);
    expect(mon).toMatch(/baseline to baseline and back \(150 ft\).*sideline to sideline and back \(112 ft\)/);
    expect(mon).toMatch(/Never a sled/);
    expect(mon).toMatch(/NOT IN THIS ROOM.*the sled/);
  });

  it("describe one group sharing the room — no tracks (2026-11-09)", () => {
    for (const key of ["monday", "tuesday", "thursday"] as const) {
      const brief = roomBrief(key);
      expect(brief).toMatch(/one group of about a dozen shares these/);
      expect(brief).toMatch(/THE RACKS ARE ONE FIXTURE/);
      expect(brief).toMatch(/THE EASIER VERSION OF A RACK LIFT IS DONE OFF THE RACKS/);
      expect(brief).toMatch(/A LIFT ON HAND WEIGHTS IS ONE PIECE PER KID/);
      expect(brief).not.toMatch(/\btracks?\b|alpha|bravo/i);
    }
  });

  it("recognise the movements that need an item even when it is not named", () => {
    expect(KIT_PATTERNS.rack.test("Back Squat")).toBe(true);
    expect(KIT_PATTERNS.rack.test("Goblet Squat")).toBe(false);
    expect(KIT_PATTERNS.bench.test("DB Bench Press")).toBe(true);
    expect(KIT_PATTERNS.bench.test("DB Floor Press")).toBe(false);
    expect(KIT_PATTERNS.box.test("Box jumps x5")).toBe(true);
    expect(KIT_PATTERNS.box.test("Shadow boxing")).toBe(false);
    expect(KIT_PATTERNS.skier.test("Ski erg 30 sec")).toBe(true);
    expect(KIT_PATTERNS.sled.test("Sled push 35 ft up and back")).toBe(true);
    expect(KIT_PATTERNS.wallBall.test("Wall balls x12")).toBe(true);
  });
});

describe("One group shares the room", () => {
  const stations = [
    "6 stations · 2 min each · rotate on the whistle",
    "Station 1 · The Racks — 8 goblet squats, then 8 push-ups, repeat — strong and repeatable",
    "Station 2 · The Rowers — row steady — long pulls",
    "Station 3 · The Bikes — bike steady — keep the cadence",
    "Station 4 · Open Court — 10 med ball slams — full reach",
    "Station 5 · Open Court — 10 squat jumps, then 10 lunges, repeat — soft landings",
    "Station 6 · Open Court — farmer carry baseline to baseline — tall chest",
  ];

  it("lets the whole group lift on the three racks, then rotate through the stations", () => {
    expect(dayProblem(day("Back Squat", stations, { easier: "Box squat to a bench — same sets, 8 reps", harder: "Pause squat" }), "monday")).toBeNull();
    expect(dayProblem(day("Barbell Bench Press", stations, { easier: "Floor press with a kettlebell" }), "monday")).toBeNull();
  });

  it("lets the lift be a pull-up with the easier version on the same racks", () => {
    expect(dayProblem(day("Pull-Up", stations, { easier: "Inverted row, bar set low" }), "thursday")).toBeNull();
  });

  it("one direction of travel per day on the court (Josh, 2026-10-21)", () => {
    const mixed = day("Back Squat", [
      "6 stations · 2 min each",
      "Station 4 · Open Court — suitcase carry baseline to baseline and back",
      "Station 5 · Open Court — walking lunges sideline to sideline",
    ]);
    expect(courtAxisClash(mixed)).toMatch(/head on/);
    expect(dayProblem(mixed, "thursday")).toMatch(/head on/);
    const oneWay = day("Back Squat", [
      "Station 4 · Open Court — suitcase carry baseline to baseline and back",
      "Station 5 · Open Court — lunges baseline to baseline",
      "Station 6 · Open Court — 12 plank shoulder taps",
    ]);
    expect(courtAxisClash(oneWay)).toBeNull();
  });

  it("refuses a sled push anywhere — one sled does not work for a group", () => {
    expect(missingKit(day("Back Squat", ["Sled push 35 ft up and back"]), "thursday")).toMatch(/no sleds.*Sled push/);
    expect(missingKit(day("Back Squat", ["Prowler push"]), "monday")).toMatch(/no sleds/);
  });
});

describe("Kit the room does not have", () => {
  it("refuses a bike, rower, ski erg or sled on Tuesday", () => {
    expect(missingKit(day("Barbell Press", ["Bike 45 sec", "Wall balls x12"]), "tuesday")).toMatch(/no bikes in the boxing facility.*Bike 45 sec/);
    expect(missingKit(day("Barbell Press", ["Wall balls x12", "Row 250m"]), "tuesday")).toMatch(/no rowers/);
    expect(missingKit(day("Barbell Press", ["Ski erg 30 sec"]), "tuesday")).toMatch(/no ski ergs/);
    expect(missingKit(day("Barbell Press", ["Sled push"]), "tuesday")).toMatch(/no sleds/);
  });

  it("refuses it in the easier or harder version of the lift too", () => {
    expect(missingKit(day("Barbell Press", ["Wall balls x12"], { harder: "Finish with a sled push" }), "tuesday")).toMatch(/no sleds/);
    expect(missingKit(day("Barbell Press", ["Wall balls x12"], { easier: "Row 100 m on the rower between sets" }), "tuesday")).toMatch(/no rowers/);
  });

  it("is fine with the same kit on Monday, and with Tuesday's own kit", () => {
    expect(missingKit(day("Barbell Press", ["Bike 45 sec", "Row 250m"]), "monday")).toBeNull();
    expect(missingKit(day("Barbell Press", ["Wall balls x12", "Jump rope 60 sec", "Box jumps x5"]), "tuesday")).toBeNull();
  });

  it("is reported by dayProblem", () => {
    expect(dayProblem(day("Barbell Press", ["Bike 45 sec"]), "tuesday")).toMatch(/no bikes/);
  });
});

describe("On the court, distance is said in court", () => {
  it("refuses metres or yards for a carry, walk or shuttle on Monday and Thursday", () => {
    expect(courtLanguage(day("Back Squat", ["Overhead carry 20m"]), "monday")).toMatch(/say distance in court.*Overhead carry 20m/);
    expect(courtLanguage(day("Back Squat", ["Walking lunge 15 yards"]), "thursday")).toMatch(/Walking lunge 15 yards/);
    expect(courtLanguage(day("Back Squat", ["Side shuffle 30 ft"]), "monday")).not.toBeNull();
  });

  it("refuses it in the lift's modification too", () => {
    expect(courtLanguage(day("Farmer Carry", [], { harder: "Carry 40 yards without setting down" }), "thursday")).toMatch(/40 yards/);
  });

  it("accepts the court's own words", () => {
    const d = day("Back Squat", [
      "Farmer carry — baseline to baseline", "Half court and back × 2 — strong but repeatable",
      "Overhead carry — baseline to baseline", "Full court and back — controlled",
    ]);
    expect(courtLanguage(d, "monday")).toBeNull();
    expect(dayProblem(d, "thursday")).toBeNull();
  });

  it("leaves machine lines alone — the rower shows metres", () => {
    expect(courtLanguage(day("Back Squat", ["Row 250m — controlled pace", "Bike 45 sec"]), "monday")).toBeNull();
  });

  it("does not apply on Tuesday, where there is no court", () => {
    expect(courtLanguage(day("Barbell Press", ["Farmer carry 20m"]), "tuesday")).toBeNull();
  });
});
