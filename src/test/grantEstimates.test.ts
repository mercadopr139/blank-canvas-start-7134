import { describe, it, expect } from "vitest";
import { weekdayNights, mealEstimate, riderProfile } from "@/lib/grantCoach/liveFacts";

describe("estimates Josh can stand behind", () => {
  it("counts dinner nights Monday to Friday, never calendar days", () => {
    expect(weekdayNights("2026-10-01", "2026-10-31")).toBe(22);
    expect(weekdayNights("2026-10-03", "2026-10-04")).toBe(0);
  });
  it("estimates the Meal Train at this month's rate times dinner nights", () => {
    const rows = ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"].map((date) => ({ date, count: 58 }));
    const e = mealEstimate(rows, "2026-10-22")!;
    expect(e.perNight).toBe(58);
    expect(e.monthNights).toBe(22);
    expect(e.monthly).toBe(58 * 22);
    expect(e.seasonFrom).toBe("2026-10-01");
    expect(e.seasonTo).toBe("2027-06-30");
    expect(e.season).toBe(58 * weekdayNights("2026-10-01", "2027-06-30"));
  });
  it("makes no estimate from fewer than four nights", () => {
    expect(mealEstimate([{ date: "2026-10-01", count: 58 }], "2026-10-22")).toBeNull();
  });
  it("profiles riders and matches income by name and date of birth", () => {
    const base = { id: "r", youth_link_id: null, program_year: "2025-2026", child_sex: null, child_race_ethnicity: null, child_school_district: null, family_structure: null };
    const regs = [
      { ...base, id: "1", child_first_name: "Ana", child_last_name: "Diaz", child_date_of_birth: "2012-05-01", household_income_range: "Under $15,000", free_or_reduced_lunch: "Yes" },
      { ...base, id: "2", child_first_name: "Ben", child_last_name: "Ray", child_date_of_birth: "2010-01-01", household_income_range: "$100,000+", free_or_reduced_lunch: "No" },
    ];
    const p = riderProfile([
      { first_name: "ana", last_name: "DIAZ", date_of_birth: "2012-05-01", pickup_zone: "Wildwood" },
      { first_name: "Ben", last_name: "Ray", date_of_birth: "2010-01-01", pickup_zone: "Woodbine" },
      { first_name: "Cal", last_name: "Lee", date_of_birth: null, pickup_zone: "Wildwood" },
    ], regs as never, new Date("2026-08-31T12:00:00"));
    expect(p.riders).toBe(3);
    expect(p.matched).toBe(2);
    expect(p.zones[0]).toEqual(["Wildwood", 2]);
    expect(p.ageMin).toBe(14);
  });
});
