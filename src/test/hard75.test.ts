import { describe, it, expect } from "vitest";
import {
  HARD75_LENGTH,
  ROTATION,
  addDays,
  daysBetween,
  dayNumberFor,
  endDateOf,
  rotationIndex,
  cycleIndex,
  isMobilityDay,
  phaseFor,
  buildStrength,
  buildCardio,
  buildPlan,
  dayComplete,
  doneCount,
  dayStatus,
  firstFailedDay,
  streak,
  CHECKLIST,
  ChecklistKey,
  SESSION_SECONDS,
  elapsedSeconds,
  remainingSeconds,
  formatClock,
  minutesOf,
} from "@/lib/hard75";

/** A day with every box ticked, then override what the test cares about. */
const day = (
  n: number,
  date: string,
  over: Partial<Record<ChecklistKey, boolean>> = {}
) => ({
  day_number: n,
  date,
  strength_done: true,
  cardio_done: true,
  outdoor_done: true,
  water_done: true,
  reading_done: true,
  diet_done: true,
  ...over,
});

describe("dates", () => {
  it("counts days without drifting across a timezone", () => {
    expect(addDays("2026-09-08", 1)).toBe("2026-09-09");
    expect(addDays("2026-09-08", 74)).toBe("2026-11-21");
    expect(daysBetween("2026-09-08", "2026-11-21")).toBe(74);
  });

  it("survives a month boundary and a DST change", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    // US DST ends 1 November 2026 — a naive +86400000ms would land on Oct 31.
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });

  it("puts Rob's start date on day 1 and ends 21 November", () => {
    expect(dayNumberFor("2026-09-08", "2026-09-08")).toBe(1);
    expect(dayNumberFor("2026-09-08", "2026-09-09")).toBe(2);
    expect(endDateOf("2026-09-08")).toBe("2026-11-21");
  });
});

describe("the rotation", () => {
  it("runs six days and repeats", () => {
    expect(ROTATION).toHaveLength(6);
    expect(rotationIndex(1)).toBe(0);
    expect(rotationIndex(6)).toBe(5);
    expect(rotationIndex(7)).toBe(0);
    expect(cycleIndex(1)).toBe(0);
    expect(cycleIndex(7)).toBe(1);
  });

  it("puts the deload on every sixth day", () => {
    expect(isMobilityDay(6)).toBe(true);
    expect(isMobilityDay(12)).toBe(true);
    expect(isMobilityDay(5)).toBe(false);
    // Across 75 days that is twelve recovery sessions, never two in a row.
    const mobility = Array.from({ length: 75 }, (_, i) => i + 1).filter(isMobilityDay);
    expect(mobility).toHaveLength(12);
    mobility.forEach((d, i) => {
      if (i > 0) expect(d - mobility[i - 1]).toBe(6);
    });
  });
});

describe("progression", () => {
  it("moves through three phases across the 75", () => {
    expect(phaseFor(1).name).toBe("Foundation");
    expect(phaseFor(25).name).toBe("Foundation");
    expect(phaseFor(26).name).toBe("Build");
    expect(phaseFor(50).name).toBe("Build");
    expect(phaseFor(51).name).toBe("Peak");
    expect(phaseFor(75).name).toBe("Peak");
  });

  it("adds a set once past the foundation phase", () => {
    expect(phaseFor(10).sets).toBe(3);
    expect(phaseFor(40).sets).toBe(4);
  });
});

describe("strength sessions", () => {
  it("puts abs in every single one", () => {
    for (let d = 1; d <= HARD75_LENGTH; d++) {
      const names = buildStrength(d).blocks.map((b) => b.name.toLowerCase()).join(" ");
      const hasCore = /crunch|plank|raise|rollout|sit-up|pallof|hollow/.test(names);
      expect(hasCore, `day ${d} has no core work`).toBe(true);
    }
  });

  it("names a home substitute for every single movement", () => {
    // A shift at the firehouse should cost him the gym, not the session.
    for (let d = 1; d <= HARD75_LENGTH; d++) {
      buildStrength(d).blocks.forEach((b) => {
        expect(b.home, `day ${d}: "${b.name}" has no home option`).toBeTruthy();
      });
    }
  });

  it("keeps the deload day genuinely light", () => {
    const w = buildStrength(6);
    expect(w.title).toBe("Mobility + Core");
    const heavy = w.blocks.some((b) => /squat|deadlift|bench|press|row/i.test(b.name));
    expect(heavy).toBe(false);
  });

  it("does not repeat the identical session every six days", () => {
    // Day 1 and day 7 are both chest, but should not be the same workout.
    const a = buildStrength(1).blocks.map((b) => b.name).join("|");
    const b = buildStrength(7).blocks.map((b) => b.name).join("|");
    expect(a).not.toBe(b);
  });
});

describe("cardio", () => {
  it("never puts a hard session on a heavy leg day", () => {
    // Quads land on rotation slot 3, posterior on slot 5.
    expect(buildCardio(3).focus).not.toBe("Hard");
    expect(buildCardio(5).focus).not.toBe("Hard");
    expect(buildCardio(9).focus).not.toBe("Hard");
    expect(buildCardio(11).focus).not.toBe("Hard");
  });

  it("never states a duration longer than the 45 the timer counts", () => {
    // A session that reads "60 minutes" against a 45-minute clock is simply
    // wrong, and it shipped once. It does not get to ship again.
    for (let d = 1; d <= HARD75_LENGTH; d++) {
      const w = buildCardio(d);
      const text = [w.title, ...w.blocks.map((b) => `${b.name} ${b.detail}`)].join(" ");
      for (const m of text.matchAll(/(d+)s*min/gi)) {
        expect(
          Number(m[1]),
          `day ${d} ("${w.title}") says ${m[0]}`
        ).toBeLessThanOrEqual(45);
      }
    }
  });

  it("offers an outdoor option most days, since the program demands one", () => {
    const outdoorDays = Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (d) => buildCardio(d).outdoor
    );
    expect(outdoorDays.length).toBeGreaterThanOrEqual(8);
  });
});

describe("buildPlan", () => {
  const plan = buildPlan("2026-09-08");

  it("writes all 75 days, consecutively", () => {
    expect(plan).toHaveLength(75);
    expect(plan[0].date).toBe("2026-09-08");
    expect(plan[74].date).toBe("2026-11-21");
    plan.forEach((d, i) => expect(d.day_number).toBe(i + 1));
  });

  it("gives every day both a strength and a cardio session", () => {
    plan.forEach((d) => {
      expect(d.strength.blocks.length).toBeGreaterThan(0);
      expect(d.cardio.blocks.length).toBeGreaterThan(0);
    });
  });
});

describe("the checklist", () => {
  it("needs all six to count the day", () => {
    expect(dayComplete(day(1, "2026-09-08"))).toBe(true);
    expect(dayComplete(day(1, "2026-09-08", { reading_done: false }))).toBe(false);
    expect(CHECKLIST).toHaveLength(6);
  });

  it("counts partial progress", () => {
    expect(doneCount(day(1, "2026-09-08", { water_done: false, diet_done: false }))).toBe(4);
  });
});

describe("dayStatus", () => {
  const today = "2026-09-10";

  it("never calls today missed, however little is ticked", () => {
    // The day isn't over. Marking it failed at 9am would be wrong and cruel.
    const d = day(3, today, {
      strength_done: false, cardio_done: false, outdoor_done: false,
      water_done: false, reading_done: false, diet_done: false,
    });
    expect(dayStatus(d, today)).toBe("today");
  });

  it("reads a finished today as complete", () => {
    expect(dayStatus(day(3, today), today)).toBe("complete");
  });

  it("separates a past day half-done from one never started", () => {
    expect(dayStatus(day(1, "2026-09-08", { diet_done: false }), today)).toBe("partial");
    const nothing = day(1, "2026-09-08", {
      strength_done: false, cardio_done: false, outdoor_done: false,
      water_done: false, reading_done: false, diet_done: false,
    });
    expect(dayStatus(nothing, today)).toBe("missed");
  });

  it("leaves the future alone", () => {
    const d = day(20, "2026-09-27", {
      strength_done: false, cardio_done: false, outdoor_done: false,
      water_done: false, reading_done: false, diet_done: false,
    });
    expect(dayStatus(d, today)).toBe("future");
  });
});

describe("firstFailedDay", () => {
  const today = "2026-09-12";
  const days = [
    day(1, "2026-09-08"),
    day(2, "2026-09-09"),
    day(3, "2026-09-10", { water_done: false }),
    day(4, "2026-09-11"),
    day(5, today, { strength_done: false }),
  ];

  it("finds the earliest incomplete day in the past", () => {
    expect(firstFailedDay(days, today)?.day_number).toBe(3);
  });

  it("ignores today, because the day isn't over", () => {
    const clean = [day(1, "2026-09-08"), day(2, today, { diet_done: false })];
    expect(firstFailedDay(clean, today)).toBeUndefined();
  });

  it("returns nothing when every past day is clean", () => {
    expect(firstFailedDay([day(1, "2026-09-08"), day(2, "2026-09-09")], today)).toBeUndefined();
  });
});

describe("streak", () => {
  it("counts consecutive complete days from day one", () => {
    expect(streak([day(1, "a"), day(2, "b"), day(3, "c")])).toBe(3);
  });

  it("stops dead at the first gap", () => {
    expect(streak([day(1, "a"), day(2, "b", { water_done: false }), day(3, "c")])).toBe(1);
  });

  it("is zero when day one was missed", () => {
    expect(streak([day(1, "a", { diet_done: false }), day(2, "b")])).toBe(0);
  });

  it("does not care what order the days arrive in", () => {
    expect(streak([day(3, "c"), day(1, "a"), day(2, "b")])).toBe(3);
  });
});

describe("session timers", () => {
  const now = new Date("2026-09-08T18:30:00");

  it("is just the accumulated time when paused", () => {
    expect(elapsedSeconds(600, null, now)).toBe(600);
    expect(elapsedSeconds(0, null, now)).toBe(0);
  });

  it("adds the running stretch to what was already banked", () => {
    // Ten minutes banked, running for five more.
    const startedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(elapsedSeconds(600, startedAt, now)).toBe(900);
  });

  it("keeps counting while the phone is locked", () => {
    // The whole reason this is stored rather than held in component state: he
    // starts it, pockets the phone, and comes back forty minutes later.
    const startedAt = new Date(now.getTime() - 40 * 60 * 1000).toISOString();
    expect(elapsedSeconds(0, startedAt, now)).toBe(40 * 60);
  });

  it("never subtracts time already earned if a clock runs backwards", () => {
    const future = new Date(now.getTime() + 60 * 1000).toISOString();
    expect(elapsedSeconds(600, future, now)).toBe(600);
  });

  it("counts down from forty-five and then goes negative", () => {
    expect(remainingSeconds(0)).toBe(SESSION_SECONDS);
    expect(remainingSeconds(SESSION_SECONDS)).toBe(0);
    expect(remainingSeconds(SESSION_SECONDS + 90)).toBe(-90);
  });

  it("formats a clock the way a clock looks", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(59)).toBe("00:59");
    expect(formatClock(SESSION_SECONDS)).toBe("45:00");
    expect(formatClock(3750)).toBe("1:02:30");
    // Overtime is shown as a positive number with a minus in front of it.
    expect(formatClock(-90)).toBe("01:30");
  });

  it("rounds the record of a session to whole minutes", () => {
    expect(minutesOf(2700)).toBe(45);
    expect(minutesOf(2729)).toBe(45);
    expect(minutesOf(0)).toBe(0);
  });
});
