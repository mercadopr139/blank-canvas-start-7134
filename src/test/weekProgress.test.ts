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
