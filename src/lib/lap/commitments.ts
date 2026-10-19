// The Lap — commitments (docs/LAP_PLAN.md).
//
// A commitment made in the weekly agenda is an ordinary Workbench task in
// the owner's "Agenda Meeting" tile. One row per owner, tied by
// lap_commitment_id; the database keeps their status in step. These helpers
// say which tile a row belongs to and how many laps a commitment has been
// carried, so the lap screen, the warm-up and the Workbench agree.

/** The Agenda Meeting tile's key on every Workbench. */
export const AGENDA_TILE_KEY = "agenda";
export const AGENDA_TILE_TITLE = "Agenda Meeting";

/**
 * The `source` a commitment row carries for one manager, following the
 * Workbench's convention: the Program Director's tiles use the bare title,
 * every other manager prefixes its key.
 */
export const commitmentSourceFor = (managerType: string): string =>
  managerType === "PD" ? AGENDA_TILE_TITLE : `${managerType}:${AGENDA_TILE_TITLE}`;

/** Is this `source` a commitment row (any manager)? */
export const isCommitmentSource = (source: string | null | undefined): boolean =>
  !!source && (source === AGENDA_TILE_TITLE || source.endsWith(`:${AGENDA_TILE_TITLE}`));

export type CarryTone = "fresh" | "once" | "warning" | "decide";

/** How loud a carried-forward commitment should be: red at 2, a forced decision at 3. */
export const carryTone = (carryCount: number): CarryTone =>
  carryCount <= 0 ? "fresh" : carryCount === 1 ? "once" : carryCount === 2 ? "warning" : "decide";

/** Pillar colours, the message board's — the one place the lap takes them from. */
export const PILLAR_COLOR: Record<"operations" | "sales_marketing" | "finance", string> = {
  operations: "#bf0f3e",
  sales_marketing: "#22c55e",
  finance: "#38bdf8",
};
