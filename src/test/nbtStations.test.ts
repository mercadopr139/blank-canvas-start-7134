import { describe, it, expect } from "vitest";
import { stationMove, stationPictures } from "@/lib/nbtStations";

describe("Cardio Stations as moves worth a picture", () => {
  it("keeps the move and drops counts, times and directions", () => {
    expect(stationMove("12 band pull-aparts")).toBe("band pull-aparts");
    expect(stationMove("then 10 wall balls")).toBe("wall balls");
    expect(stationMove("farmer carry, two dumbbells")).toBe("farmer carry");
    expect(stationMove("30 sec plank")).toBe("plank");
    expect(stationMove("bear crawl baseline to baseline and back")).toBe("bear crawl");
  });
  it("names the machines the way the libraries know them, and drops directions", () => {
    expect(stationMove("row")).toBe("rowing machine");
    expect(stationMove("bike")).toBe("stationary bike");
    expect(stationMove("baseline to baseline")).toBeNull();
  });
  it("reads tonight's stations in order", () => {
    const got = stationPictures([
      "6 stations · 2 min each · rotate on the whistle",
      "Station 1 · The Racks — 12 band pull-aparts, then 10 wall balls, repeat — controlled pace",
      "Station 2 · The Rowers — row — steady pace, long pulls",
      "Station 4 · Open Court — 10 KB swings, then baseline to baseline, repeat — hips snap, flat back",
      "Station 6 · Open Court — hollow hold rocks — slow, ribs down",
    ]);
    expect(got.map((s) => [s.n, s.place, s.moves])).toEqual([
      ["1", "The Racks", ["band pull-aparts", "wall balls"]],
      ["2", "The Rowers", ["rowing machine"]],
      ["4", "Open Court", ["KB swings"]],
      ["6", "Open Court", ["hollow hold rocks"]],
    ]);
  });
});

import { onePictureCue } from "@/components/strength/ExercisePictures";
describe("a one-picture move says what to do", () => {
  it("uses the plan's cue first, then the kind of move", () => {
    expect(onePictureCue("hollow hold rocks", "slow, ribs down")).toBe("slow, ribs down");
    expect(onePictureCue("hollow hold rocks")).toBe("Hold this position");
    expect(onePictureCue("farmer carry")).toBe("Walk tall, shoulders back");
    expect(onePictureCue("stationary bike")).toBe("Steady pace the whole time");
    expect(onePictureCue("wall balls", "controlled pace")).toBe("Squat deep · drive up · throw it to the target");
    expect(onePictureCue("goblet squat")).toBe("Copy this position");
  });
});

import { stationLines, workLines, withStations, type NbtDay } from "@/lib/nbt";
describe("the Cardio Stations are stored once", () => {
  const lines = ["6 stations · 2 min each · rotate on the whistle", "Station 1 · The Racks — 12 band pull-aparts"];
  const base: { work: NbtDay["work"] } = { work: { emphasis: "", title: "Cardio Stations", alpha: [], bravo: [], result_unit: "rounds" } };
  it("writes them once, to the shared block, with no track copies", () => {
    const d = withStations(base, lines);
    expect(d.work.shared).toEqual(lines);
    expect(d.work.alpha).toEqual([]);
    expect(d.work.bravo).toEqual([]);
  });
  it("reads the stations as the room's one work block, and still reads the old Alpha copy", () => {
    const d = withStations(base, lines);
    expect(workLines(d)).toEqual(lines);
    expect(stationLines({ work: { ...base.work, alpha: lines, bravo: lines } })).toEqual(lines);
    expect(workLines({ work: { ...base.work, alpha: lines, bravo: lines } })).toEqual(lines);
  });
  it("reads a circuit written before the stations as one list: Alpha's, else Bravo's", () => {
    const d = { work: { ...base.work, alpha: ["Bike — 30 sec"], bravo: ["Row — 30 sec"] } };
    expect(stationLines(d)).toEqual([]);
    expect(workLines(d)).toEqual(["Bike — 30 sec"]);
    expect(workLines({ work: { ...base.work, alpha: [], bravo: ["Row — 30 sec"] } })).toEqual(["Row — 30 sec"]);
  });
});
