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

const sourceForAgendaFocusArea = (managerType: string | null): string | null => {
  if (!managerType) return null;
  if (managerType === "PD") return "Agenda";
  return `${managerType}:Agenda`;
};

export interface PushToWorkbenchInput {
  agendaItemId: string;
  title: string;
  notes: string | null;
  pillar: Pillar;
  status: AgendaStatus;
  targetUserIds: string[];
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

  // One profile lookup query for all target users keeps this O(1).
  const { data: profiles } = await supabase
    .from("staff_profiles")
    .select("user_id, task_manager_type")
    .in("user_id", input.targetUserIds);
  const byUser = new Map(
    (profiles || []).map((p: { user_id: string; task_manager_type: string | null }) => [
      p.user_id,
      p.task_manager_type,
    ]),
  );

  for (const userId of input.targetUserIds) {
    const managerType = byUser.get(userId) ?? null;
    const source = sourceForAgendaFocusArea(managerType);
    if (!source) {
      result.noWorkbench++;
      continue;
    }

    // Skip if a signal already exists in this user's workbench for
    // the same agenda item — pushing twice would duplicate.
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
