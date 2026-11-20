// The invoice's Type column (2026-11-20): from the line's rate type, else from how it was billed.
import { describe, expect, it } from "vitest";
import { invoiceTypeLabel, rateTypeLabel, RATE_TYPE_OPTIONS } from "@/lib/billingTypes";

describe("the Type column", () => {
  it("reads the line's own rate type first", () => {
    expect(invoiceTypeLabel("per_day", "per_day")).toBe("Per Day");
    expect(invoiceTypeLabel("per_hour", "hourly")).toBe("Hourly");
    expect(invoiceTypeLabel("adjustment", "flat_rate")).toBe("Adjustment");
    expect(invoiceTypeLabel("sponsorship", "flat_rate")).toBe("Sponsorship");
    expect(invoiceTypeLabel("other_service", "flat_rate")).toBe("Monthly Program Cost");
  });

  it("falls back to how a line was billed, the way the column always read", () => {
    expect(invoiceTypeLabel(null, "per_day")).toBe("Per Day");
    expect(invoiceTypeLabel(null, "hourly")).toBe("Hourly");
    expect(invoiceTypeLabel(null, "flat_rate")).toBe("Monthly Program Cost");
    expect(invoiceTypeLabel(undefined, undefined)).toBe("Monthly Program Cost");
  });

  it("names the rate types the way the forms do, Adjustment included", () => {
    expect(RATE_TYPE_OPTIONS.map((o) => o.value)).toEqual(["per_day", "per_hour", "sponsorship", "adjustment", "other_service"]);
    expect(rateTypeLabel("adjustment")).toBe("Adjustment");
    expect(rateTypeLabel("other_service")).toBe("Other");
    expect(rateTypeLabel(null)).toBe("Per Day");
    expect(rateTypeLabel("hourly_rate")).toBe("Per Hour");
  });
});
