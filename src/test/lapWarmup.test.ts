import { describe, it, expect } from "vitest";
import { groupForWarmup, warmupGate, mustDecide, type WarmupRow } from "@/lib/lap/warmup";

const LAST = "lap-last";
const row = (p: Partial<WarmupRow> & { id: string }): WarmupRow => ({
  title: "t", status: "Pending", source: "Agenda Meeting", lap_id: LAST, lap_topic_id: "topic-1", lap_commitment_id: null, carry_count: 0, ...p,
});

describe("The Lap — the warm-up (last lap's commitments)", () => {
  it("groups the one-row-per-owner commitment, and calls it done only when every owner's row is done", () => {
    const groups = groupForWarmup([
      row({ id: "a1", lap_commitment_id: "c-a", status: "Complete", title: "Confirm the bus" }),
      row({ id: "a2", lap_commitment_id: "c-a", status: "Pending", source: "PC:Agenda Meeting", title: "Confirm the bus" }),
      row({ id: "b1", lap_commitment_id: "c-b", status: "Complete", title: "Post the plan" }),
    ], LAST);
    expect(groups.map((g) => [g.key, g.state, g.rows.length])).toEqual([["c-a", "open", 2], ["c-b", "done", 1]]);
  });

  it("knows a carried commitment waiting between laps, and leaves dropped ones out", () => {
    const groups = groupForWarmup([
      row({ id: "c1", lap_commitment_id: "c-c", lap_id: null, carry_count: 1 }),
      row({ id: "d1", lap_commitment_id: "c-d", is_archived: true }),
      row({ id: "e1", lap_commitment_id: "c-e", lap_id: "some-older-lap" }),
    ], LAST);
    expect(groups.map((g) => [g.key, g.state])).toEqual([["c-c", "carried"]]);
  });

  it("puts open commitments first, the most-carried on top, then carried, then done", () => {
    const groups = groupForWarmup([
      row({ id: "1", lap_commitment_id: "done", status: "Complete" }),
      row({ id: "2", lap_commitment_id: "carried", lap_id: null, carry_count: 1 }),
      row({ id: "3", lap_commitment_id: "open-fresh" }),
      row({ id: "4", lap_commitment_id: "open-old", carry_count: 2 }),
    ], LAST);
    expect(groups.map((g) => g.key)).toEqual(["open-old", "open-fresh", "carried", "done"]);
  });

  it("gates the start on open commitments only", () => {
    const groups = groupForWarmup([
      row({ id: "1", lap_commitment_id: "x" }),
      row({ id: "2", lap_commitment_id: "y", status: "Complete" }),
    ], LAST);
    expect(warmupGate(groups)).toEqual({ ready: false, open: 1 });
    expect(warmupGate(groups.filter((g) => g.state !== "open"))).toEqual({ ready: true, open: 0 });
    expect(warmupGate([])).toEqual({ ready: true, open: 0 });
  });

  it("forces a decision at three carries", () => {
    expect(mustDecide(2)).toBe(false);
    expect(mustDecide(3)).toBe(true);
  });
});
