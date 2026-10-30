// The riders' own demographics by pick-up zone (2026-10-30): one sentence per
// zone from the Transport Intelligence math, counts with the matched base.
import { describe, expect, it } from "vitest";
import { riderDemographics } from "@/lib/grantCoach/liveFacts";
import type { ZoneStats } from "@/lib/transportIntelligence";

const zone: ZoneStats = {
  trips: 40, pickups: 20, dropoffs: 20, rides: 400, uniqueYouth: 49, assessedYouth: 46, avgYouthPerTrip: "10.0", drivers: [],
  age: [{ label: "7", count: 3 }, { label: "11", count: 30 }, { label: "16", count: 13 }],
  gender: [{ label: "Male", count: 30 }, { label: "Female", count: 16 }],
  race: [{ label: "Hispanic or Latino", count: 25 }, { label: "Black or African American", count: 12 }, { label: "White", count: 9 }],
  district: [{ label: "Woodbine", count: 40 }, { label: "Middle Township", count: 6 }],
  singleParentCount: 20, singleParentPct: "43", povertyCount: 41, povertyPct: "89",
};

describe("rider demographics by zone", () => {
  it("quotes the page's counts with the matched base, ages as a range and median", () => {
    const s = riderDemographics(zone);
    expect(s).toContain("46 of 49 riders matched to a registration form.");
    expect(s).toContain("Ages 7–16 (median 11).");
    expect(s).toContain("Sex: Male 30, Female 16.");
    expect(s).toContain("Race/ethnicity: Hispanic or Latino 25, Black or African American 12, White 9.");
    expect(s).toContain("School district: Woodbine 40, Middle Township 6.");
    expect(s).toContain("Single-parent households: 20 of 46 (43%).");
    expect(s).toContain("Economically disadvantaged: 41 of 46 (89%).");
  });

  it("says so when no rider matched a form", () => {
    expect(riderDemographics({ ...zone, assessedYouth: 0 })).toBe("49 riders, none matched to a registration form, so no demographics.");
  });

  it("never invents a breakdown that is not recorded", () => {
    expect(riderDemographics({ ...zone, district: [] })).toContain("School district: not recorded.");
  });
});
