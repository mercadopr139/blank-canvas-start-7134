import { describe, it, expect } from "vitest";
import { commitmentSourceFor, isCommitmentSource, carryTone, AGENDA_TILE_KEY, PILLAR_COLOR } from "@/lib/lap/commitments";

describe("The Lap — commitments live in the Agenda Meeting tile", () => {
  it("follows the Workbench's source convention for every manager", () => {
    expect(commitmentSourceFor("PD")).toBe("Agenda Meeting");
    expect(commitmentSourceFor("PC")).toBe("PC:Agenda Meeting");
    expect(commitmentSourceFor("APC")).toBe("APC:Agenda Meeting");
    expect(AGENDA_TILE_KEY).toBe("agenda");
  });

  it("recognises a commitment row by its source, and nothing else", () => {
    expect(isCommitmentSource("Agenda Meeting")).toBe(true);
    expect(isCommitmentSource("PC:Agenda Meeting")).toBe(true);
    expect(isCommitmentSource("PC:NLA")).toBe(false);
    expect(isCommitmentSource(null)).toBe(false);
    expect(isCommitmentSource("Agenda Meeting Notes")).toBe(false);
  });

  it("gets louder the more laps a commitment is carried: red at two, a decision at three", () => {
    expect(carryTone(0)).toBe("fresh");
    expect(carryTone(1)).toBe("once");
    expect(carryTone(2)).toBe("warning");
    expect(carryTone(3)).toBe("decide");
    expect(carryTone(7)).toBe("decide");
  });

  it("uses the message board's pillar colours, unchanged", () => {
    expect(PILLAR_COLOR.operations).toBe("#bf0f3e");
    expect(PILLAR_COLOR.sales_marketing).toBe("#22c55e");
    expect(PILLAR_COLOR.finance).toBe("#38bdf8");
  });
});
