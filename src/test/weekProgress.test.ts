import { describe, it, expect } from "vitest";
import { weekSteps, weekReady } from "@/lib/weekProgress";

describe("The week's four jobs", () => {
  it("start as nothing done", () => {
    const steps = weekSteps({ plan: null, verse: null, battle: null, nbt: null });
    expect(steps.map((s) => s.state)).toEqual(["todo", "todo", "todo", "todo"]);
    expect(weekReady(steps)).toBe(false);
  });

  it("show where each one stands while it's in progress", () => {
    const steps = weekSteps({
      plan: { status: "draft", filled: 9, total: 32 },
      verse: { theme: "Perseverance", is_published: false },
      battle: { status: "draft", days: 2 },
      nbt: { built: true, locked: false },
    });
    expect(steps.map((s) => s.state)).toEqual(["doing", "doing", "doing", "doing"]);
    expect(steps[0].status).toBe("9 of 32 drills · draft");
    expect(steps[2].status).toBe("2 of 3 days · draft");
  });

  it("are done only when the kids can see them on the wall", () => {
    const steps = weekSteps({
      plan: { status: "published", filled: 32, total: 32 },
      verse: { theme: "Perseverance", is_published: true },
      battle: { status: "locked", days: 3 },
      nbt: { built: true, locked: true },
    });
    expect(weekReady(steps)).toBe(true);
  });

  it("treat a blank theme and an empty lift week as not started", () => {
    const steps = weekSteps({
      plan: null,
      verse: { theme: "  ", is_published: true },
      battle: { status: "locked", days: 0 },
      nbt: { built: false, locked: true },
    });
    expect(steps.map((s) => s.state)).toEqual(["todo", "todo", "todo", "todo"]);
  });
});

describe("The planning week", () => {
  it("is this week Monday to Friday, and next week from Saturday", async () => {
    const { planningWeekOf, mondayOf } = await import("@/lib/practicePlan");
    const wed = new Date("2026-09-30T10:00:00");
    const sat = new Date("2026-10-03T09:00:00");
    const sun = new Date("2026-10-04T20:00:00");
    expect(planningWeekOf(wed)).toBe(mondayOf(wed));
    expect(planningWeekOf(wed)).toBe("2026-09-28");
    expect(planningWeekOf(sat)).toBe("2026-10-05");
    expect(planningWeekOf(sun)).toBe("2026-10-05");
  });
});
