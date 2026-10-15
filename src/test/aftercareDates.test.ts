import { describe, it, expect } from "vitest";
import { sessionDateFor, shiftDate } from "@/lib/aftercareDates";

describe("aftercare session dates — a report belongs to its Tuesday", () => {
  it("a Tuesday is its own session", () => {
    expect(sessionDateFor("2026-10-06")).toBe("2026-10-06");
    expect(sessionDateFor("2026-10-13")).toBe("2026-10-13");
  });

  it("any later day in the week is credited to the Tuesday before it", () => {
    expect(sessionDateFor("2026-10-07")).toBe("2026-10-06"); // Wednesday
    expect(sessionDateFor("2026-10-08")).toBe("2026-10-06"); // Thursday — Jaime's case
    expect(sessionDateFor("2026-10-09")).toBe("2026-10-06"); // Friday
    expect(sessionDateFor("2026-10-10")).toBe("2026-10-06"); // Saturday
    expect(sessionDateFor("2026-10-11")).toBe("2026-10-06"); // Sunday
    expect(sessionDateFor("2026-10-12")).toBe("2026-10-06"); // Monday
  });

  it("crosses a month boundary without drifting", () => {
    expect(sessionDateFor("2026-11-02")).toBe("2026-10-27"); // Monday → the Tuesday before
    expect(shiftDate("2026-11-01", -1)).toBe("2026-10-31");
  });
});
