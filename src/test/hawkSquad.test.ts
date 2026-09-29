import { describe, it, expect } from "vitest";
import { isHawkPracticeDay, datesInMonth, canBeDismissed, hawkTodayET } from "@/lib/hawkSquad";

describe("Hawk Squad practice days", () => {
  it("runs Tuesday and Thursday by default", () => {
    expect(isHawkPracticeDay("2026-09-29", {})).toBe(true);  // Tue
    expect(isHawkPracticeDay("2026-10-01", {})).toBe(true);  // Thu
    expect(isHawkPracticeDay("2026-09-30", {})).toBe(false); // Wed
    expect(isHawkPracticeDay("2026-10-03", {})).toBe(false); // Sat
  });

  it("lets the calendar move a day in either direction", () => {
    expect(isHawkPracticeDay("2026-10-01", { "2026-10-01": false })).toBe(false); // Thursday off
    expect(isHawkPracticeDay("2026-09-30", { "2026-09-30": true })).toBe(true);   // Wednesday on
  });

  it("lists every date in a month once", () => {
    const sept = datesInMonth(2026, 8);
    expect(sept.length).toBe(30);
    expect(sept[0]).toBe("2026-09-01");
    expect(sept[29]).toBe("2026-09-30");
    expect(datesInMonth(2026, 1).length).toBe(28);
  });
});

describe("Hawk Squad dismissal", () => {
  it("only a signed waiver allows dismissal", () => {
    expect(canBeDismissed({ dismissal_waiver_signed_at: null })).toBe(false);
    expect(canBeDismissed({ dismissal_waiver_signed_at: "2026-09-29T20:00:00Z" })).toBe(true);
  });
});

describe("today in the gym's timezone", () => {
  it("is a YYYY-MM-DD in New York time", () => {
    // 03:30 UTC on the 30th is still the evening of the 29th in New Jersey.
    expect(hawkTodayET(new Date("2026-09-30T03:30:00Z"))).toBe("2026-09-29");
  });
});
