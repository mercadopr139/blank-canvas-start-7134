import { describe, it, expect } from "vitest";
import { SNAPSHOT_SECTIONS, shortYear, snapshotText, snapshotYear } from "@/lib/grantCoach/snapshot";

describe("Program Year Snapshot", () => {
  it("has the four approved sections, in order", () => {
    expect(SNAPSHOT_SECTIONS.map((s) => s.key)).toEqual(["who_we_served", "what_we_do", "organization", "capacity"]);
    expect(SNAPSHOT_SECTIONS.map((s) => s.sort)).toEqual([1, 2, 3, 4]);
  });

  it("describes the last complete program year", () => {
    // October 2026 is in 2026-27, so the Snapshot is 2025-26.
    expect(snapshotYear(new Date("2026-10-24T12:00:00"))).toBe("2025-2026");
    expect(snapshotYear(new Date("2027-09-15T12:00:00"))).toBe("2026-2027");
  });

  it("writes the year the way the sections do", () => {
    expect(shortYear("2025-2026")).toBe("2025–26");
    expect(shortYear("odd")).toBe("odd");
  });

  it("joins the sections for Copy all, skipping empty ones", () => {
    expect(snapshotText([{ body: " A \n" }, { body: "" }, { body: "B" }])).toBe("A\n\n\nB");
  });
});
