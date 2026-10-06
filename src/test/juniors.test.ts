import { describe, it, expect } from "vitest";
import { isTuesday, nextTuesday, recentTuesdays, orderTasks, groupTasks, groupRoles, type JuniorsTask } from "@/lib/juniors";

const task = (id: string, category_id: string, sort_order: number, starred = false): JuniorsTask =>
  ({ id, category_id, title: id, details: null, photo_url: null, starred, sort_order, is_active: true });

describe("Juniors session dates", () => {
  it("knows a Tuesday", () => {
    expect(isTuesday("2026-10-06")).toBe(true);
    expect(isTuesday("2026-10-07")).toBe(false);
  });
  it("finds the next Tuesday, counting today", () => {
    expect(nextTuesday("2026-10-06")).toBe("2026-10-06"); // Tue
    expect(nextTuesday("2026-10-07")).toBe("2026-10-13"); // Wed
    expect(nextTuesday("2026-10-12")).toBe("2026-10-13"); // Mon
  });
  it("lists recent Tuesdays most recent first", () => {
    expect(recentTuesdays("2026-10-08", 3)).toEqual(["2026-10-06", "2026-09-29", "2026-09-22"]);
    expect(recentTuesdays("2026-10-06", 1)).toEqual(["2026-10-06"]);
  });
});

describe("Juniors checklist order", () => {
  it("puts starred tasks first, then sort order", () => {
    const t = [task("b", "c1", 20), task("s", "c1", 30, true), task("a", "c1", 10)];
    expect(orderTasks(t).map((x) => x.id)).toEqual(["s", "a", "b"]);
  });
  it("groups under categories in order and drops empty ones", () => {
    const cats = [
      { id: "c2", title: "Security", photo_url: null, sort_order: 20, is_active: true },
      { id: "c1", title: "Setup", photo_url: null, sort_order: 10, is_active: true },
      { id: "c3", title: "Empty", photo_url: null, sort_order: 30, is_active: true },
    ];
    const g = groupTasks(cats, [task("x", "c2", 1), task("y", "c1", 1)]);
    expect(g.map((x) => x.category.title)).toEqual(["Setup", "Security"]);
  });
  it("groups roles by label in order", () => {
    const roles = [
      { id: "1", title: "Blue Stool #2", group_label: "Blue Stools", location: "Teen Center", sort_order: 50, is_active: true },
      { id: "2", title: "Junior Boxing Head Coach", group_label: "Coaching", location: null, sort_order: 10, is_active: true },
    ];
    expect(groupRoles(roles).map((g) => g.label)).toEqual(["Coaching", "Blue Stools"]);
  });
});
