// Weekly goals, acted on mid-week (Josh, 2026-10-19: "some will not be
// completed; I need a way to carry them over or discard them").
//
// A goal is one Workbench task per owner sharing a lap_commitment_id, so
// every action here works on the whole set. Between laps the warm-up still
// makes the final call on anything left open; these are the mid-week moves.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Every screen that lists goals, refreshed after any move. */
export const GOAL_QUERY_KEYS = ["lap-commitments", "lap-line-goals", "lap-checklist-ticks", "lap-warmup", "task-manager-home-core", "signals"];
export const refreshGoals = (qc: QueryClient) => { for (const key of GOAL_QUERY_KEYS) qc.invalidateQueries({ queryKey: [key] }); };

/** Drop a goal now, with one line on why, for the record. It leaves every owner's tile. */
export const dropGoal = async (commitmentId: string, reason: string): Promise<string | null> => {
  const { error } = await supabase.from("signals")
    .update({ dropped_reason: reason, is_archived: true, archived_at: new Date().toISOString() } as never)
    .eq("lap_commitment_id" as never, commitmentId).eq("is_trashed", false);
  return error?.message ?? null;
};

/** Carry a goal to next week now: it leaves this lap, waits, and joins the next lap at the start line — one more carry on its count. */
export const carryGoalNow = async (commitmentId: string): Promise<string | null> => {
  const { data, error } = await supabase.from("signals").select("id, carry_count" as never).eq("lap_commitment_id" as never, commitmentId).eq("is_trashed", false).eq("is_archived", false);
  if (error) return error.message;
  for (const r of (data ?? []) as unknown as { id: string; carry_count: number }[]) {
    const { error: e } = await supabase.from("signals").update({ lap_id: null, carry_count: r.carry_count + 1 } as never).eq("id", r.id);
    if (e) return e.message;
  }
  return null;
};

/** When the next lap starts, the done goals of earlier laps clear off the
 *  tiles. Through the week they stay, struck through, for both owners to
 *  see; Monday's warm-up shows them done; then they have served their
 *  purpose (Josh, 2026-10-19). The lap's record and history keep them. */
export const archiveDoneGoalsBefore = async (newLapId: string): Promise<string | null> => {
  const { error } = await supabase.from("signals")
    .update({ is_archived: true, archived_at: new Date().toISOString() } as never)
    .neq("lap_id" as never, newLapId).not("lap_id" as never, "is", null)
    .eq("status", "Complete").eq("is_archived", false).eq("is_trashed", false).not("lap_commitment_id" as never, "is", null);
  return error?.message ?? null;
};

/** The titles of goals still open anywhere — this lap or waiting for the next — so the window can catch a duplicate. */
export const openGoalTitles = async (): Promise<string[]> => {
  const { data } = await supabase.from("signals").select("title" as never).not("lap_commitment_id" as never, "is", null).eq("is_archived", false).eq("is_trashed", false).neq("status", "Complete");
  return [...new Set(((data ?? []) as unknown as { title: string | null }[]).map((r) => (r.title ?? "").trim()).filter(Boolean))];
};

/** Same words, ignoring case and spacing. */
export const sameGoal = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
