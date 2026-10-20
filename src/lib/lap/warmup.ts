// The Lap's warm-up: last lap's commitments, reviewed before the start line
// (docs/LAP_PLAN.md, step 3). Pure rules, so the screen and the tests agree.
//
// A commitment is one Workbench task per owner, tied by lap_commitment_id.
// After a lap finishes, each commitment is one of:
//   done     — every owner's row is Complete: a check and a small burst;
//   open     — still Pending on the lap it was made in: it must be carried
//              forward or dropped before the next lap can start;
//   carried  — already carried: its rows wait between laps (lap_id null) and
//              join the next lap at their checkpoint when it starts.
// The gate: no open commitment left.

export interface WarmupRow {
  id: string;
  title: string;
  status: string;
  source: string | null;
  lap_id: string | null;
  lap_topic_id: string | null;
  lap_checklist_item_id?: string | null;
  lap_commitment_id: string | null;
  carry_count: number;
  is_archived?: boolean;
}

export type WarmupState = "done" | "open" | "carried";

export interface WarmupGroup {
  key: string;
  title: string;
  rows: WarmupRow[];
  state: WarmupState;
  carryCount: number;
  topicId: string | null;
}

/** Rows → goals, each with its state. Dropped (archived, not done) rows are left out; a done goal archived off the tiles at the finish still shows as done. */
export const groupForWarmup = (rows: WarmupRow[], lastLapId: string | null): WarmupGroup[] => {
  const by = new Map<string, WarmupRow[]>();
  for (const r of rows) {
    if (r.is_archived && r.status !== "Complete") continue;
    const k = r.lap_commitment_id ?? r.id;
    (by.get(k) ?? by.set(k, []).get(k)!).push(r);
  }
  const out: WarmupGroup[] = [];
  for (const [key, group] of by) {
    const done = group.every((r) => r.status === "Complete");
    const inFlight = group.every((r) => r.lap_id === null);
    const fromLastLap = !!lastLapId && group.some((r) => r.lap_id === lastLapId);
    if (!done && !inFlight && !fromLastLap) continue; // some other lap's business
    out.push({
      key,
      title: group[0].title,
      rows: group,
      state: done ? "done" : inFlight ? "carried" : "open",
      carryCount: Math.max(...group.map((r) => r.carry_count)),
      topicId: group[0].lap_topic_id,
    });
  }
  // Open ones first — they are the work; then carried; done last.
  const rank: Record<WarmupState, number> = { open: 0, carried: 1, done: 2 };
  return out.sort((a, b) => rank[a.state] - rank[b.state] || b.carryCount - a.carryCount);
};

/** May the next lap start? Only when nothing from the last one is still open. */
export const warmupGate = (groups: WarmupGroup[]) => {
  const open = groups.filter((g) => g.state === "open").length;
  return { ready: open === 0, open };
};

/** Carried three laps running: no more carrying — split it, hand it on, or drop it. */
export const mustDecide = (carryCount: number) => carryCount >= 3;
