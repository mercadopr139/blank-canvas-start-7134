// A third application to the same funder sees every earlier one (2026-10-30):
// the instructions name all of them and the writer receives each.
import { describe, expect, it } from "vitest";
import { earlierApplications, rewriteInstruction, siblingForWriter, type SiblingContext } from "@/lib/grantCoach/sibling";

const second: SiblingContext = {
  id: "f2", name: "NBT & the Littles", program: "Non-Battle Team and the Littles",
  answers: new Map([["r1", { label: "Brief Funding Purpose", answer: "Funds the Non-Battle Team." }], ["r2", { label: "Blank", answer: "  " }]]),
  others: [{ id: "f1", name: "Battle Team 2027", program: "Battle Team", application: [{ label: "Brief Funding Purpose", answer: "Funds the Battle Team." }] }],
};

describe("sister applications", () => {
  it("names every earlier application, oldest first", () => {
    expect(earlierApplications(second)).toBe('"Battle Team 2027" (Battle Team) and "NBT & the Littles" (Non-Battle Team and the Littles)');
    expect(earlierApplications({ ...second, others: [] })).toBe('"NBT & the Littles" (Non-Battle Team and the Littles)');
  });

  it("the rewrite instruction never calls a third application the second", () => {
    const text = rewriteInstruction(second, "Transportation", "Funds the Non-Battle Team.");
    expect(text).not.toMatch(/SECOND APPLICATION/);
    expect(text).toContain("The earlier ones");
    expect(text).toContain("are already submitted");
    expect(text).toContain('"Battle Team 2027"');
    expect(rewriteInstruction({ ...second, others: [] }, "Transportation", "x")).toContain("The earlier one, ");
  });

  it("the writer receives the source and every other earlier application, blanks dropped", () => {
    const w = siblingForWriter(second)!;
    expect(w.application).toEqual([{ label: "Brief Funding Purpose", answer: "Funds the Non-Battle Team." }]);
    expect(w.others).toEqual([{ name: "Battle Team 2027", program: "Battle Team", application: [{ label: "Brief Funding Purpose", answer: "Funds the Battle Team." }] }]);
    expect(siblingForWriter({ ...second, others: [] })!.others).toBeUndefined();
    expect(siblingForWriter(null)).toBeUndefined();
  });
});
