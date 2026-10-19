import { describe, it, expect } from "vitest";
import { runningOrder, segments, checkpoints, pointAt, arcPath, crossedPillar, streak, type RingTopic } from "@/lib/lap/ring";

const t = (pillar: RingTopic["pillar"], n: number): RingTopic[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${pillar}-${i}`, pillar, title: `${pillar} ${i}` }));
// The real ring: 11 / 6 / 4, given out of order to prove the sort.
const topics = [...t("finance", 4), ...t("operations", 11), ...t("sales_marketing", 6)];

describe("The Lap — the ring", () => {
  it("runs Operations, then Sales & Marketing, then Finance, whatever order the topics arrive in", () => {
    const order = runningOrder(topics);
    expect(order.map((x) => x.pillar)).toEqual([...Array(11).fill("operations"), ...Array(6).fill("sales_marketing"), ...Array(4).fill("finance")]);
  });

  it("gives each pillar a stretch in proportion to its checkpoints — Operations about half the track", () => {
    const segs = segments(topics);
    expect(segs.map((s) => s.pillar)).toEqual(["operations", "sales_marketing", "finance"]);
    expect(segs[0].from).toBe(0);
    expect(segs[0].to).toBeCloseTo(11 / 21, 6);
    expect(segs[1].to).toBeCloseTo(17 / 21, 6);
    expect(segs[2].to).toBeCloseTo(1, 6);
  });

  it("spaces checkpoints inside their stretch, never on a boundary, in running order", () => {
    const cps = checkpoints(runningOrder(topics));
    expect(cps).toHaveLength(21);
    expect(cps.map((c) => c.index)).toEqual([...Array(21).keys()]);
    const segs = segments(topics);
    for (const cp of cps) {
      const seg = segs.find((s) => s.pillar === cp.pillar)!;
      expect(cp.t).toBeGreaterThan(seg.from);
      expect(cp.t).toBeLessThan(seg.to);
    }
    for (let i = 1; i < cps.length; i++) expect(cps[i].t).toBeGreaterThan(cps[i - 1].t);
  });

  it("puts the start line at the top and runs clockwise", () => {
    const top = pointAt(0, 100, 100, 50);
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
    const right = pointAt(0.25, 100, 100, 50);
    expect(right.x).toBeCloseTo(150); expect(right.y).toBeCloseTo(100);
    expect(arcPath(0, 0.25, 100, 100, 50)).toMatch(/^M 100 50 A 50 50 0 0 1 150 100$/);
    expect(arcPath(0.3, 0.2, 100, 100, 50)).toBe("");
  });

  it("knows when the runner crosses into a new pillar", () => {
    const order = runningOrder(topics);
    expect(crossedPillar(order, 10, 11)).toBe("sales_marketing");
    expect(crossedPillar(order, 16, 17)).toBe("finance");
    expect(crossedPillar(order, 3, 4)).toBeNull();
  });

  it("counts a streak of laps a week apart, and breaks it on a gap", () => {
    expect(streak([])).toBe(0);
    expect(streak(["2026-10-19"])).toBe(1);
    expect(streak(["2026-10-19", "2026-10-12", "2026-10-05"])).toBe(3);
    expect(streak(["2026-10-19", "2026-10-12", "2026-09-21"])).toBe(2);
    expect(streak(["2026-10-12", "2026-10-19", "2026-10-19"])).toBe(2);
  });
});
