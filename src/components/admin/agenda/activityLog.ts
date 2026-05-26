// Single helper used by every code path that writes to an agenda item,
// attachment, or link. Centralizing it means the activity feed in the
// detail dialog stays comprehensive without each caller needing to
// remember to log.

import { supabase } from "@/integrations/supabase/client";

export type AgendaAction =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "attachment_added"
  | "attachment_removed"
  | "link_added"
  | "link_removed";

export interface AgendaActivityRow {
  id: string;
  item_id: string;
  user_id: string | null;
  action: AgendaAction;
  changed_fields: Record<string, unknown>;
  created_at: string;
}

export const logAgendaActivity = async (
  itemId: string,
  action: AgendaAction,
  userId: string | null,
  changedFields: Record<string, unknown> = {},
): Promise<void> => {
  // Fire-and-forget — never block the user-facing mutation on logging.
  // A failed log entry is annoying but not data-loss.
  const { error } = await supabase.from("agenda_activity_log" as any).insert({
    item_id: itemId,
    user_id: userId,
    action,
    changed_fields: changedFields,
  } as any);
  if (error) {
    // Surface in the console for debugging without disrupting UX.
    console.warn("Agenda activity log failed:", error.message);
  }
};
