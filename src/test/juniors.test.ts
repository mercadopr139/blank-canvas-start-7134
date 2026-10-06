import { describe, it, expect } from "vitest";
import { isTuesday, nextTuesday, recentTuesdays, orderTasks, groupTasks, groupRoles, lineupName, initials, placeTask, type JuniorsTask } from "@/lib/juniors";

describe("Juniors line-up names", () => {
  it("prefers a typed adult, else the youth's full name", () => {
    expect(lineupName({ person_name: "Coach Rob", child_first_name: null, child_last_name: null })).toBe("Coach Rob");
    expect(lineupName({ person_name: null, child_first_name: "Luka", child_last_name: "Mercado" })).toBe("Luka Mercado");
    expect(lineupName({ person_name: "  ", child_first_name: "Luka", child_last_name: "Mercado" })).toBe("Luka Mercado");
  });
  it("makes initials", () => {
    expect(initials("Josh Mercado")).toBe("JM");
    expect(initials("Chrissy")).toBe("C");
  });
});

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

describe("Juniors checklist drag and drop", () => {
  const list = [task("a", "c1", 10), task("b", "c1", 20), task("c", "c1", 30), task("x", "c2", 10)];
  const order = (l: JuniorsTask[], cat: string) => l.filter((t) => t.category_id === cat).sort((a, b) => a.sort_order - b.sort_order).map((t) => t.id);

  it("moves a task down within its category and renumbers", () => {
    const next = placeTask(list, list[0], "c1", 2);
    expect(order(next, "c1")).toEqual(["b", "c", "a"]);
    expect(next.find((t) => t.id === "a")!.sort_order).toBe(30);
  });
  it("moves a task into another category at a slot", () => {
    const next = placeTask(list, list[2], "c2", 0);
    expect(order(next, "c1")).toEqual(["a", "b"]);
    expect(order(next, "c2")).toEqual(["c", "x"]);
  });
  it("drops into an empty category", () => {
    const next = placeTask(list, list[1], "c3", 0);
    expect(order(next, "c3")).toEqual(["b"]);
    expect(next.find((t) => t.id === "b")!.category_id).toBe("c3");
    expect(next.length).toBe(list.length);
  });
  it("clamps an out-of-range slot to the end", () => {
    expect(order(placeTask(list, list[0], "c1", 99), "c1")).toEqual(["b", "c", "a"]);
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
