import { describe, it, expect } from "vitest";
import {
  DAYS, mondayOf, addDays, firstOfMonth, mondaysInMonth, weekInBlock,
  dateOfDay, todayDayKey, blankSets, heaviestSet, totalReps, hasLogged,
  liftOf, withLift, workLines, asTrack, NbtDay,
  SESSION_CAP_MINUTES, DEFAULT_MINUTES, minutesOf, totalMinutes, withinCap,
  readableLines, formatClock, elapsedOf,
} from "@/lib/nbt";

describe("dates", () => {
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-09-09")).toBe("2026-09-07"); // Wednesday → Monday
    expect(mondayOf("2026-09-07")).toBe("2026-09-07"); // Monday → itself
  });

  it("counts Sunday as the week ahead, not the one just gone", () => {
    // A coach opening the board on Sunday night is looking at the week starting
    // tomorrow, not the one that finished yesterday.
    expect(mondayOf("2026-09-13")).toBe("2026-09-14");
  });

  it("does not drift across a month boundary or a DST change", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    // US DST ends 1 November 2026 — a naive +86400000ms would land on Oct 31.
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });
});

describe("blocks", () => {
  it("takes the month from any date in it", () => {
    expect(firstOfMonth("2026-09-23")).toBe("2026-09-01");
  });

  it("lists the Mondays of a month", () => {
    // September 2026 starts on a Tuesday, so the first Monday is the 7th.
    expect(mondaysInMonth("2026-09-01")).toEqual([
      "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
    ]);
  });

  it("gives a week to exactly one block, never two", () => {
    // The week of 28 Sept runs into October. It belongs to September, because
    // its Monday does — otherwise the same session would appear in two blocks
    // and the progression would count it twice.
    expect(mondaysInMonth("2026-09-01")).toContain("2026-09-28");
    expect(mondaysInMonth("2026-10-01")).not.toContain("2026-09-28");
    expect(mondaysInMonth("2026-10-01")[0]).toBe("2026-10-05");
  });

  it("handles a month that opens on a Monday", () => {
    // June 2026 starts on a Monday — that week must not be skipped.
    expect(mondaysInMonth("2026-06-01")[0]).toBe("2026-06-01");
  });

  it("numbers the weeks within the block from one", () => {
    expect(weekInBlock("2026-09-01", "2026-09-07")).toBe(1);
    expect(weekInBlock("2026-09-01", "2026-09-28")).toBe(4);
    expect(weekInBlock("2026-09-01", "2026-10-05")).toBe(0); // not in this block
  });

  it("gives a five-Monday month five weeks", () => {
    // March 2027 has five Mondays. The block just carries one more week.
    expect(mondaysInMonth("2027-03-01").length).toBe(5);
  });
});

describe("training days", () => {
  it("trains Monday, Tuesday and Thursday", () => {
    expect(DAYS.map((d) => d.key)).toEqual(["monday", "tuesday", "thursday"]);
  });

  it("puts each day on the right date of its week", () => {
    expect(dateOfDay("2026-09-07", "monday")).toBe("2026-09-07");
    expect(dateOfDay("2026-09-07", "tuesday")).toBe("2026-09-08");
    expect(dateOfDay("2026-09-07", "thursday")).toBe("2026-09-10");
  });

  it("knows when today is not a training day", () => {
    expect(todayDayKey("2026-09-07")).toBe("monday");
    expect(todayDayKey("2026-09-10")).toBe("thursday");
    expect(todayDayKey("2026-09-09")).toBeNull(); // Wednesday
    expect(todayDayKey("2026-09-12")).toBeNull(); // Saturday
  });
});

describe("logging", () => {
  it("hands out empty sets to tap into", () => {
    expect(blankSets(3)).toEqual([
      { set: 1, weight: null, reps: null },
      { set: 2, weight: null, reps: null },
      { set: 3, weight: null, reps: null },
    ]);
  });

  it("reports the heaviest set of the day", () => {
    const sets = [
      { set: 1, weight: 45, reps: 8 },
      { set: 2, weight: 65, reps: 6 },
      { set: 3, weight: 55, reps: 6 },
    ];
    expect(heaviestSet(sets)).toBe(65);
    expect(totalReps(sets)).toBe(20);
  });

  it("returns nothing rather than zero when no weight was entered", () => {
    // Bodyweight work has no weight. Reporting 0 lb would be a lie.
    expect(heaviestSet(blankSets(3))).toBeNull();
    expect(heaviestSet([{ set: 1, weight: null, reps: 12 }])).toBeNull();
  });

  it("counts a bodyweight session as logged", () => {
    expect(hasLogged({ sets: blankSets(3), work_result: null })).toBe(false);
    expect(hasLogged({ sets: [{ set: 1, weight: null, reps: 12 }], work_result: null })).toBe(true);
    // Reps left blank but the circuit finished — still logged.
    expect(hasLogged({ sets: blankSets(3), work_result: 4 })).toBe(true);
  });
});

describe("reading a day — one group, one lift (2026-11-09)", () => {
  const day = {
    focus: "Own the basics",
    prep: ["Air squats × 10", "Ramp up: 2 easy sets of 5 with the empty bar"],
    lift: {
      pattern: "Squat",
      main: { name: "Back Squat", detail: "4 × 5 — four to a rack, rotate every set" },
      easier: "Goblet squat with a kettlebell — same sets, 8 reps",
      harder: "Add a 3-second pause at the bottom",
      cues: ["Chest up"],
    },
    work: {
      emphasis: "intervals",
      title: "Cardio Stations",
      shared: ["6 stations · 2 min each · rotate on the whistle", "Station 1 · The Racks — 10 wall balls"],
      bravo: [],
      alpha: [],
      result_unit: "rounds",
    },
    reset: ["Water", "Wraps on"],
  } as NbtDay;

  // A day written while there were still two tracks.
  const twoTracks = {
    ...day,
    lift: {
      pattern: "Squat",
      bravo: { name: "Heavy Goblet Squat", detail: "4 × 8 — one kettlebell by the horns; groups of 3 rotate" },
      alpha: { name: "Back Squat", detail: "4 × 5" },
      cues: ["Chest up"],
    },
    work: { ...day.work, shared: undefined, bravo: ["400m run", "10 step-ups"], alpha: ["600m run", "15 step-ups"] },
  } as NbtDay;

  it("reads the one lift with its easier and harder versions", () => {
    expect(liftOf(day)).toEqual({
      name: "Back Squat",
      detail: "4 × 5 — four to a rack, rotate every set",
      easier: "Goblet squat with a kettlebell — same sets, 8 reps",
      harder: "Add a 3-second pause at the bottom",
    });
  });

  it("reads a two-track day as one lift: Alpha's, with Bravo's as the easier version", () => {
    expect(liftOf(twoTracks)).toEqual({
      name: "Back Squat",
      detail: "4 × 5",
      // The dose comes along; the run-it cue written for a second group does not.
      easier: "Heavy Goblet Squat — 4 × 8",
      harder: "",
    });
  });

  it("falls back to Bravo's lift when a two-track day has no Alpha", () => {
    const d = { ...twoTracks, lift: { ...twoTracks.lift, alpha: undefined } } as NbtDay;
    expect(liftOf(d).name).toBe("Heavy Goblet Squat");
    expect(liftOf(d).easier).toBe("");
  });

  it("writes a lift the one-group way and drops the retired tracks", () => {
    const next = withLift(twoTracks, { harder: "Slower lowering" });
    expect(next.lift.main).toEqual({ name: "Back Squat", detail: "4 × 5" });
    expect(next.lift.easier).toBe("Heavy Goblet Squat — 4 × 8");
    expect(next.lift.harder).toBe("Slower lowering");
    expect(next.lift.alpha).toBeUndefined();
    expect(next.lift.bravo).toBeUndefined();
    // The pattern, the cues and the rest of the day are untouched; the original is not mutated.
    expect(next.lift.pattern).toBe("Squat");
    expect(next.lift.cues).toEqual(["Chest up"]);
    expect(next.work).toBe(twoTracks.work);
    expect(twoTracks.lift.alpha?.name).toBe("Back Squat");
  });

  it("changes one field of the lift and keeps the others", () => {
    const next = withLift(day, { detail: "5 × 5" });
    expect(liftOf(next)).toEqual({ ...liftOf(day), detail: "5 × 5" });
  });

  it("reads the work block as one list: the stations, or an older week's circuit", () => {
    expect(workLines(day)).toEqual(day.work.shared);
    expect(workLines(twoTracks)).toEqual(["600m run", "15 step-ups"]);
  });

  it("files an athlete still stored as the retired Charlie track under Bravo", () => {
    // History only: old logs still carry a level, and the NBT Intelligence page reads it.
    expect(asTrack("charlie")).toBe("bravo");
    expect(asTrack("bravo")).toBe("bravo");
    expect(asTrack("alpha")).toBe("alpha");
    expect(asTrack(null)).toBe("bravo");
  });

  it("copes with a day that has not been generated yet", () => {
    expect(liftOf(undefined)).toEqual({ name: "", detail: "", easier: "", harder: "" });
    expect(workLines({})).toEqual([]);
  });
});

describe("session length", () => {
  const withMinutes = (m: Partial<typeof DEFAULT_MINUTES>) =>
    ({ minutes: m } as unknown as NbtDay);

  it("caps a session at forty minutes", () => {
    // They box straight afterwards. Overrunning costs the session that matters.
    expect(SESSION_CAP_MINUTES).toBe(40);
  });

  it("leaves room under the cap at the top of every block range", () => {
    // Prep 5 + lift 10 + work 20 + reset 3 is the longest the rules allow.
    const longest = { prep: 5, lift: 10, work: 20, reset: 3 };
    expect(totalMinutes(withMinutes(longest))).toBe(38);
    expect(withinCap(withMinutes(longest))).toBe(true);
  });

  it("rejects a session that runs over", () => {
    expect(withinCap(withMinutes({ prep: 8, lift: 12, work: 25, reset: 5 }))).toBe(false);
  });

  it("falls back for days written before the generator stated times", () => {
    expect(minutesOf(undefined)).toEqual(DEFAULT_MINUTES);
    expect(totalMinutes(undefined)).toBe(38);
    // A partially stated day keeps the defaults for whatever is missing.
    expect(minutesOf(withMinutes({ work: 15 })).work).toBe(15);
    expect(minutesOf(withMinutes({ work: 15 })).prep).toBe(DEFAULT_MINUTES.prep);
  });
});

describe("readableLines — what the screen actually shows", () => {
  it("joins a heading with nothing on it to the line beneath", () => {
    const out = readableLines(["Bike station:", ":30 strong effort", "Jump rope :30"]);
    expect(out.map((l) => l.text)).toEqual(["Bike station — 30 sec strong effort", "Jump rope 30 sec"]);
  });

  it("hoists the rounds line to the top wherever it was written", () => {
    const out = readableLines(["Row 250m", "Jump rope 30 sec", "Rest 45 sec, repeat 4 rounds"]);
    expect(out[0]).toEqual({ text: "Rest 45 sec, repeat 4 rounds", kind: "rounds", level: 0 });
    expect(out.slice(1).every((l) => l.kind === "station")).toBe(true);
  });

  it("leaves a well-written circuit alone", () => {
    const lines = ["4 rounds — rest 45 sec between rounds", "Assault bike — 30 sec — strong", "Jump rope — 30 sec — steady"];
    expect(readableLines(lines).map((l) => l.text)).toEqual(lines);
  });

  it("drops blank lines", () => {
    expect(readableLines(["", "Burpees x10", "  "]).length).toBe(1);
  });

  it("keeps the nesting a coach typed — the Practice Plan's bullet rule, three levels", () => {
    const out = readableLines(["3 rounds", "Bike station", "- 30 sec strong", "  - then 15 sec easy", "Jump rope"]);
    expect(out.map((l) => [l.text, l.level])).toEqual([
      ["3 rounds", 0],
      ["Bike station", 0],
      ["30 sec strong", 1],
      ["then 15 sec easy", 2],
      ["Jump rope", 0],
    ]);
    expect(out[0].kind).toBe("rounds");
  });

  it("a heading with a nested detail under it stays two lines, not one", () => {
    const out = readableLines(["Bike station:", "- :30 strong effort"]);
    expect(out.map((l) => [l.text, l.level])).toEqual([["Bike station:", 0], ["30 sec strong effort", 1]]);
  });
});

describe("the board's clock", () => {
  it("formats m:ss of the magnitude", () => {
    expect(formatClock(1200)).toBe("20:00");
    expect(formatClock(59)).toBe("0:59");
    expect(formatClock(-75)).toBe("1:15");
  });

  it("adds the live stretch only while running", () => {
    const start = new Date("2026-09-09T18:00:00Z").toISOString();
    const now = new Date("2026-09-09T18:00:30Z").getTime();
    expect(elapsedOf(100, null, now)).toBe(100);
    expect(elapsedOf(100, start, now)).toBe(130);
  });
});
