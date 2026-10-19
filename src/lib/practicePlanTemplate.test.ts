import { describe, it, expect } from "vitest";
import { templateSlotFor, standingDetailFor, effectiveDetail, isInherited, detailToStore, type TemplateBlock } from "./practicePlan";

const template: TemplateBlock[] = [
  { id: "t1", group: "battle_team", weekday: 1, position: 0, category: "Strength", detail: "Chest\nSee workout plan" },
  { id: "t2", group: "battle_team", weekday: 1, position: 1, category: "Boxing", detail: null },
  { id: "t3", group: "littles", weekday: 1, position: 0, category: "Boxing", detail: "  " },
];
const slot = (over: Partial<{ group: "battle_team" | "non_battle_team" | "littles"; weekday: number; position: number; category: string; category_overridden: boolean; detail: string | null }> = {}) => ({
  group: "battle_team" as const, weekday: 1, position: 0, category: "Strength", detail: null, ...over,
});

describe("the template's standing text", () => {
  it("finds the slot by group, night, position and name", () => {
    expect(templateSlotFor(slot(), template)?.id).toBe("t1");
    expect(templateSlotFor(slot({ category: "strength " }), template)?.id).toBe("t1");
  });
  it("a renamed one-off matches nothing", () => {
    expect(templateSlotFor(slot({ category: "Run" }), template)).toBeNull();
    expect(templateSlotFor(slot({ category_overridden: true }), template)).toBeNull();
  });
  it("an empty week block inherits the standing text", () => {
    expect(standingDetailFor(slot(), template)).toBe("Chest\nSee workout plan");
    expect(effectiveDetail(slot(), template)).toBe("Chest\nSee workout plan");
    expect(isInherited(slot(), template)).toBe(true);
  });
  it("typed text overrides for the week", () => {
    const b = slot({ detail: "Legs" });
    expect(effectiveDetail(b, template)).toBe("Legs");
    expect(isInherited(b, template)).toBe(false);
  });
  it("a slot with no standing text stays empty", () => {
    expect(effectiveDetail(slot({ position: 1, category: "Boxing" }), template)).toBeNull();
    expect(standingDetailFor(slot({ group: "littles", category: "Boxing" }), template)).toBeNull();
    expect(isInherited(slot({ position: 1, category: "Boxing" }), template)).toBe(false);
  });
  it("saving the template's own words stores nothing, so the block keeps inheriting", () => {
    expect(detailToStore("Chest\nSee workout plan", slot(), template)).toBeNull();
    expect(detailToStore("  Chest\nSee workout plan ", slot(), template)).toBeNull();
    expect(detailToStore("Legs", slot(), template)).toBe("Legs");
    expect(detailToStore("", slot(), template)).toBeNull();
    expect(detailToStore("Bags", slot({ position: 1, category: "Boxing" }), template)).toBe("Bags");
  });
});
