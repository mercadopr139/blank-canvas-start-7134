import { describe, it, expect } from "vitest";
import { addressProblem } from "@/lib/address";

describe("addressProblem — what cannot be a home", () => {
  it("lets a real address through, typed or picked", () => {
    expect(addressProblem("4 Moore Rd, Cape May Court House, NJ 08210")).toBeNull();
    expect(addressProblem("4 moore rd cape may ct house")).toBeNull();
    expect(
      addressProblem("12, West Dunbar Street, Whitesboro, Middle Township, Cape May County, New Jersey, 08210, United States")
    ).toBeNull();
    expect(addressProblem("3800 New Jersey Ave Apt 2, Wildwood, NJ 08260")).toBeNull();
  });

  it("refuses an email", () => {
    expect(addressProblem("someone@icloud.com")).toMatch(/email/i);
  });

  it("refuses a PO box, however it is written", () => {
    expect(addressProblem("PO BOX 774 CAPEMAY COURTHOUSE NJ 08210")).toMatch(/PO box/i);
    expect(addressProblem("P.O. Box 282, Green Creek NJ 08219")).toMatch(/PO box/i);
    expect(addressProblem("po box 12")).toMatch(/PO box/i);
  });

  it("wants a house number", () => {
    expect(addressProblem("Seashore Road, Cold Spring, Lower Township, NJ")).toMatch(/house number/i);
  });

  it("refuses something that is not an address at all", () => {
    expect(addressProblem("Elemental 2")).not.toBeNull();
  });

  it("leaves 'required' to the form", () => {
    expect(addressProblem("")).toBeNull();
    expect(addressProblem("   ")).toBeNull();
    expect(addressProblem(null)).toBeNull();
  });
});
