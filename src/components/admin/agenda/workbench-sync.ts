// Single integration module for Agenda ↔ Workbench sync.
//
// The two systems have slightly different status models:
//   - Agenda: signal | on_hold | done
//   - Workbench (signals.status): Pending | Complete
// Mapping is lossy in one direction: a signal flipping back to
// Pending can't tell whether the agenda item was originally signal
// or on_hold, so we default to "signal".
//
// Signal-to-focus-area routing reuses the existing `source` field
// convention from the Workbench:
//   - manager_type = "PD"  →  source = "Agenda"
//   - manager_type = other →  source = "<TYPE>:Agenda"  (e.g., "PC:Agenda")
// The "Agenda" focus area was seeded for each manager type in the
// Phase 1 migration so this lookup never fails for users with a
// task_manager_type.

import { supabase } from "@/integrations/supabase/client";
import type { Pillar, AgendaStatus } from "./types";

const PILLAR_TO_SIGNAL_PILLAR: Record<Pillar, string> = {
  operations: "Operations",
  sales_marketing: "Sales & Marketing",
  finance: "Finance",
};

const agendaStatusToSignalStatus = (s: AgendaStatus): "Pending" | "Complete" =>
  s === "done" ? "Complete" : "Pending";

// Compute the `source` field a signal needs to land in a given
// focus area. The Workbench's source convention is:
//   - manager_type "PD"  →  source = title (e.g. "NLA")
//   - other manager_types →  source = "<TYPE>:<title>" (e.g. "PC:NLA")
const sourceForFocusArea = (managerType: string | null, title: string): string | null => {
  if (!managerType) return null;
  if (managerType === "PD") return title;
  return `${managerType}:${title}`;
};

export interface PushTarget {
  userId: string;
  focusAreaId: string;
}

export interface PushToWorkbenchInput {
  agendaItemId: string;
  title: string;
  notes: string | null;
  pillar: Pillar;
  status: AgendaStatus;
  targets: PushTarget[];
}

export interface PushToWorkbenchResult {
  inserted: number;
  alreadyPresent: number;
  noWorkbench: number;
  failed: number;
}

export const pushAgendaItemToWorkbench = async (
  input: PushToWorkbenchInput,
): Promise<PushToWorkbenchResult> => {
  const result: PushToWorkbenchResult = {
    inserted: 0,
    alreadyPresent: 0,
    noWorkbench: 0,
    failed: 0,
  };

  // Single round-trip to resolve every chosen focus area's title +
  // manager_type so we can compute the `source` field per insert.
  const focusAreaIds = Array.from(new Set(input.targets.map((t) => t.focusAreaId)));
  if (focusAreaIds.length === 0) return result;
  const { data: focusAreas } = await supabase
    .from("focus_areas")
    .select("id, title, manager_type")
    .in("id", focusAreaIds);
  const focusAreaById = new Map(
    (focusAreas || []).map((fa: { id: string; title: string; manager_type: string | null }) => [
      fa.id,
      fa,
    ]),
  );

  for (const target of input.targets) {
    const fa = focusAreaById.get(target.focusAreaId);
    if (!fa) {
      result.failed++;
      continue;
    }
    const source = sourceForFocusArea(fa.manager_type, fa.title);
    if (!source) {
      result.noWorkbench++;
      continue;
    }

    // Skip duplicates: a signal with this agenda item + this exact
    // source already exists.
    const { data: existing } = await supabase
      .from("signals")
      .select("id")
      .eq("source_agenda_item_id", input.agendaItemId)
      .eq("source", source)
      .maybeSingle();
    if (existing) {
      result.alreadyPresent++;
      continue;
    }

    const status = agendaStatusToSignalStatus(input.status);
    const { error } = await supabase.from("signals").insert({
      title: input.title,
      description: input.notes,
      pillar: PILLAR_TO_SIGNAL_PILLAR[input.pillar],
      source,
      priority_layer: "Core",
      signal_type: "Action",
      signal_kind: "Action",
      status,
      completed_at: status === "Complete" ? new Date().toISOString() : null,
      source_agenda_item_id: input.agendaItemId,
    } as any);
    if (error) {
      console.warn("pushAgendaItemToWorkbench insert failed:", error.message);
      result.failed++;
    } else {
      result.inserted++;
    }
  }

  return result;
};

// Forward sync: agenda status change → all linked signals get the
// equivalent status. Idempotent — only writes when the row differs.
export const mirrorAgendaStatusToSignals = async (
  agendaItemId: string,
  newAgendaStatus: AgendaStatus,
): Promise<void> => {
  const signalStatus = agendaStatusToSignalStatus(newAgendaStatus);
  const { error } = await supabase
    .from("signals")
    .update({
      status: signalStatus,
      completed_at: signalStatus === "Complete" ? new Date().toISOString() : null,
    } as any)
    .eq("source_agenda_item_id", agendaItemId)
    .neq("status", signalStatus);
  if (error) console.warn("mirrorAgendaStatusToSignals failed:", error.message);
};

// Reverse sync: a signal flipped → mirror its status back to the
// linked agenda item. Caller is responsible for filtering loop
// triggers (don't mirror when the underlying change was caused by
// the forward sync above).
export const mirrorSignalStatusToAgenda = async (
  agendaItemId: string,
  newSignalStatus: string,
): Promise<void> => {
  const targetAgendaStatus: AgendaStatus =
    newSignalStatus === "Complete" ? "done" : "signal";
  const { error } = await supabase
    .from("agenda_items" as any)
    .update({ status: targetAgendaStatus } as any)
    .eq("id", agendaItemId)
    .neq("status", targetAgendaStatus);
  if (error) console.warn("mirrorSignalStatusToAgenda failed:", error.message);
};
