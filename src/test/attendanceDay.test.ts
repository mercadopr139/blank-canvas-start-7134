import { describe, it, expect } from "vitest";
import { isDayClosed, closedDaysOnly, openDatesIn, hourInNY, todayInNY } from "@/lib/attendanceDay";

// 2026-10-20 16:08 Eastern (EDT, UTC-4) = 20:08Z; 20:30 Eastern = 00:30Z next day.
const afternoon = new Date("2026-10-20T20:08:00Z");
const evening = new Date("2026-10-21T00:30:00Z");

describe("when a day's attendance is final", () => {
  it("knows the Eastern date and hour", () => {
    expect(todayInNY(afternoon)).toBe("2026-10-20");
    expect(hourInNY(afternoon)).toBe(16);
    expect(todayInNY(evening)).toBe("2026-10-20");
    expect(hourInNY(evening)).toBe(20);
  });
  it("yesterday is closed, tomorrow never is", () => {
    expect(isDayClosed("2026-10-19", afternoon)).toBe(true);
    expect(isDayClosed("2026-10-21", afternoon)).toBe(false);
  });
  it("today closes at 8 PM Eastern", () => {
    expect(isDayClosed("2026-10-20", afternoon)).toBe(false);
    expect(isDayClosed("2026-10-20", evening)).toBe(true);
  });
  it("an average counts closed days only, and names what is still open", () => {
    const recs = [{ check_in_date: "2026-10-19" }, { check_in_date: "2026-10-20" }, { check_in_date: "2026-10-20" }];
    expect(closedDaysOnly(recs, afternoon)).toHaveLength(1);
    expect(closedDaysOnly(recs, evening)).toHaveLength(3);
    expect(openDatesIn(recs.map((r) => r.check_in_date), afternoon)).toEqual(["2026-10-20"]);
    expect(openDatesIn(recs.map((r) => r.check_in_date), evening)).toEqual([]);
  });
  it("midnight UTC does not roll the Eastern day early", () => {
    // 23:30 Eastern on Oct 20 is 03:30Z on Oct 21: still Oct 20 in New York, and closed.
    const late = new Date("2026-10-21T03:30:00Z");
    expect(todayInNY(late)).toBe("2026-10-20");
    expect(isDayClosed("2026-10-20", late)).toBe(true);
  });
});
