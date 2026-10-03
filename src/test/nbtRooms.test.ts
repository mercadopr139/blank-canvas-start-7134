import { describe, it, expect } from "vitest";
import { ROOMS, roomFor, kitIn, absentKit, roomBrief, KIT_PATTERNS } from "@/lib/nbtRooms";
import { equipmentClash, missingKit, dayProblem, courtLanguage } from "@/lib/nbtCoaching";
import type { NbtDay } from "@/lib/nbt";

const day = (bravoLift: string, alphaLift: string, bravoWork: string[], alphaWork: string[]): NbtDay => ({
  focus: "",
  prep: ["Easy shuffle 2 min"],
  lift: {
    pattern: "Squat",
    bravo: { name: bravoLift, detail: "4 × 6" },
    alpha: { name: alphaLift, detail: "4 × 5" },
    cues: [],
  },
  work: { emphasis: "intervals", title: "Circuit", bravo: bravoWork, alpha: alphaWork, result_unit: "rounds" },
  reset: [],
});

describe("The two rooms", () => {
  it("put Monday and Thursday in the Performance Center and Tuesday in the boxing facility", () => {
    expect(roomFor("monday").name).toBe("Performance Center");
    expect(roomFor("thursday").name).toBe("Performance Center");
    expect(roomFor("tuesday").name).toBe("boxing facility");
  });

  it("know what is scarce, what there is enough of, and what is not there", () => {
    const pc = ROOMS.performance_center;
    expect(kitIn(pc, "rack")).toMatchObject({ count: 3, shared: false });
    expect(kitIn(pc, "bench")).toMatchObject({ count: 3, shared: false });
    expect(kitIn(pc, "skier")).toMatchObject({ count: 2, shared: false });
    // One sled does not work for a group: it is deliberately not in the room.
    expect(kitIn(pc, "sled")).toBeUndefined();
    expect(kitIn(pc, "box")).toMatchObject({ count: 4, shared: false });
    expect(kitIn(pc, "barbell")).toMatchObject({ count: "plenty" });
    expect(kitIn(pc, "handWeight")).toMatchObject({ count: "plenty" });

    const bf = ROOMS.boxing_facility;
    expect(kitIn(bf, "rack")).toMatchObject({ count: 6, shared: true });
    expect(kitIn(bf, "bench")).toMatchObject({ count: 6, shared: true });
    expect(absentKit(bf).sort()).toEqual(["bike", "rower", "skier", "sled"]);
    expect(absentKit(pc)).toEqual(["sled"]);
  });

  it("describe themselves for the generator from the same inventory", () => {
    const tue = roomBrief("tuesday");
    expect(tue).toMatch(/boxing facility/);
    expect(tue).toMatch(/NOT IN THIS ROOM.*bikes.*rowers.*ski ergs.*sled/);
    expect(tue).toMatch(/ENOUGH FOR BOTH TRACKS.*squat racks \(6\)/);
    const mon = roomBrief("monday");
    expect(mon).toMatch(/SCARCE.*squat racks \(3\).*benches \(3\).*assault bikes \(6\)/);
    expect(mon).toMatch(/75 ft baseline to baseline, 56 ft sideline to sideline/);
    expect(mon).toMatch(/never in metres, yards or feet/);
    expect(mon).toMatch(/baseline to baseline and back \(150 ft\).*sideline to sideline and back \(112 ft\)/);
    expect(mon).toMatch(/Never a sled/);
    expect(mon).toMatch(/NOT IN THIS ROOM.*the sled/);
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

describe("Scarce kit belongs to one track per block", () => {
  it("refuses both tracks on the three benches in the lift", () => {
    const d = day("DB Bench Press", "Barbell Bench Press", ["Push-ups x10"], ["Dips x8"]);
    expect(equipmentClash(d, "monday")).toMatch(/Alpha and Bravo are both on the benches in the lift block/);
  });

  it("lets Bravo floor press while Alpha benches", () => {
    const d = day("DB Floor Press", "Barbell Bench Press", ["Push-ups x10"], ["Dips x8"]);
    expect(equipmentClash(d, "monday")).toBeNull();
  });

  it("refuses both tracks in the three racks, but not a goblet squat on the floor", () => {
    expect(equipmentClash(day("Front Squat", "Back Squat", [], []), "monday")).toMatch(/squat racks/);
    expect(equipmentClash(day("Goblet Squat", "Back Squat", [], []), "monday")).toBeNull();
  });

  it("allows both tracks on the racks on Tuesday, where there are six", () => {
    const d = day("DB Overhead Press", "Barbell Overhead Press", ["Wall balls x12"], ["Jump rope 60 sec"]);
    expect(equipmentClash(day("Barbell Overhead Press", "Barbell Overhead Press", [], []), "tuesday")).toBeNull();
    expect(dayProblem(d, "tuesday")).toBeNull();
  });

  it("judges the lift block and the work block separately", () => {
    // Alpha squats in the rack; Bravo's circuit uses a rack later. Different times, no clash.
    const d = day("Goblet Squat", "Back Squat", ["Rack pull-ups x6"], ["Jump squats x10"]);
    expect(equipmentClash(d, "monday")).toBeNull();
  });

  it("keeps the machines one-track-per-block, and knows the ski ergs", () => {
    expect(equipmentClash(day("Goblet Squat", "Back Squat", ["Ski erg 30 sec"], ["Ski erg 45 sec"]), "monday")).toMatch(/ski ergs/);
    expect(equipmentClash(day("Goblet Squat", "Back Squat", ["Bike 45 sec"], ["Row 250m"]), "monday")).toBeNull();
  });

  it("refuses a sled push anywhere — one sled does not work for a group", () => {
    expect(missingKit(day("Goblet Squat", "Back Squat", [], ["Sled push 35 ft up and back"]), "thursday")).toMatch(/no sleds.*Alpha/);
    expect(missingKit(day("Goblet Squat", "Back Squat", ["Prowler push"], []), "monday")).toMatch(/no sleds/);
  });

  it("no longer treats dumbbells and kettlebells as scarce", () => {
    const d = day("Goblet Squat", "Back Squat", ["KB swings x15"], ["DB snatch x10"]);
    expect(equipmentClash(d, "monday")).toBeNull();
    expect(equipmentClash(day("Goblet Squat", "Heavy Goblet Squat", [], []), "monday")).toBeNull();
  });

  it("limits the four plyo boxes to one track per block", () => {
    const d = day("Goblet Squat", "Back Squat", ["Box jumps x5"], ["Box step-offs x6"]);
    expect(equipmentClash(d, "tuesday")).toMatch(/plyo boxes/);
  });
});

describe("Kit the room does not have", () => {
  it("refuses a bike, rower, ski erg or sled on Tuesday", () => {
    expect(missingKit(day("DB Press", "Barbell Press", ["Bike 45 sec"], ["Wall balls x12"]), "tuesday")).toMatch(/no bikes in the boxing facility.*Bravo/);
    expect(missingKit(day("DB Press", "Barbell Press", ["Wall balls x12"], ["Row 250m"]), "tuesday")).toMatch(/no rowers/);
    expect(missingKit(day("DB Press", "Barbell Press", ["Ski erg 30 sec"], []), "tuesday")).toMatch(/no ski ergs/);
    expect(missingKit(day("DB Press", "Barbell Press", [], ["Sled push"]), "tuesday")).toMatch(/no sleds/);
  });

  it("is fine with the same kit on Monday, and with Tuesday's own kit", () => {
    expect(missingKit(day("DB Press", "Barbell Press", ["Bike 45 sec"], ["Row 250m"]), "monday")).toBeNull();
    expect(missingKit(day("DB Press", "Barbell Press", ["Wall balls x12", "Jump rope 60 sec"], ["Box jumps x5"]), "tuesday")).toBeNull();
  });

  it("checks only the track being rewritten when asked to", () => {
    const d = day("DB Press", "Barbell Press", ["Bike 45 sec"], ["Wall balls x12"]);
    expect(missingKit(d, "tuesday", "alpha")).toBeNull();
    expect(missingKit(d, "tuesday", "bravo")).not.toBeNull();
  });

  it("is reported by dayProblem ahead of a clash", () => {
    const d = day("DB Press", "Barbell Press", ["Bike 45 sec"], ["Bike 60 sec"]);
    expect(dayProblem(d, "tuesday")).toMatch(/no bikes/);
  });
});

describe("On the court, distance is said in court", () => {
  it("refuses metres or yards for a carry, walk or shuttle on Monday and Thursday", () => {
    expect(courtLanguage(day("Goblet Squat", "Back Squat", [], ["Overhead carry 20m"]), "monday")).toMatch(/say distance in court.*Alpha.*Overhead carry 20m/);
    expect(courtLanguage(day("Goblet Squat", "Back Squat", ["Walking lunge 15 yards"], []), "thursday")).toMatch(/Bravo/);
    expect(courtLanguage(day("Goblet Squat", "Back Squat", ["Bear crawl 30 ft"], []), "monday")).not.toBeNull();
  });

  it("accepts the court's own words", () => {
    const d = day("Goblet Squat", "Back Squat",
      ["Farmer carry — baseline to baseline", "Half court and back × 2 — strong but repeatable"],
      ["Overhead carry — sideline to sideline", "Full court and back — controlled"]);
    expect(courtLanguage(d, "monday")).toBeNull();
    expect(dayProblem(d, "thursday")).toBeNull();
  });

  it("leaves machine lines alone — the rower shows metres", () => {
    expect(courtLanguage(day("Goblet Squat", "Back Squat", ["Row 250m — controlled pace"], ["Bike 45 sec"]), "monday")).toBeNull();
  });

  it("does not apply on Tuesday, where there is no court", () => {
    expect(courtLanguage(day("DB Press", "Barbell Press", ["Farmer carry 20m"], []), "tuesday")).toBeNull();
  });
});
