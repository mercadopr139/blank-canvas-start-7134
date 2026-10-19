// Throwing a lap away (docs/LAP_PLAN.md): "start this week over" on an open
// lap, or deleting a test lap from history. Only the Super Admin.
//
// What goes with the lap: its decisions, and the commitments MADE in it.
// What stays: commitments carried into it from an earlier lap go back to
// waiting between laps, exactly as they were before the lap started.
import { supabase } from "@/integrations/supabase/client";

export interface DeleteLapOutcome { removedCommitments: number; returnedToWaiting: number }

export const deleteLap = async (lapId: string): Promise<DeleteLapOutcome> => {
  const { data, error } = await supabase
    .from("signals")
    .select("id, carry_count, carried_from_signal_id" as never)
    .eq("lap_id" as never, lapId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as { id: string; carry_count: number; carried_from_signal_id: string | null }[];
  const made = rows.filter((r) => r.carry_count === 0 && !r.carried_from_signal_id).map((r) => r.id);
  const carried = rows.filter((r) => !made.includes(r.id)).map((r) => r.id);
  if (made.length) {
    const { error: e1 } = await supabase.from("signals").delete().in("id", made);
    if (e1) throw e1;
  }
  if (carried.length) {
    const { error: e2 } = await supabase.from("signals").update({ lap_id: null } as never).in("id", carried);
    if (e2) throw e2;
  }
  // Topics added for this lap only go with it; decisions cascade with the lap row.
  await supabase.from("lap_topics" as never).delete().eq("this_lap_only_lap_id", lapId);
  const { error: e3 } = await supabase.from("laps" as never).delete().eq("id", lapId);
  if (e3) throw e3;
  return { removedCommitments: made.length, returnedToWaiting: carried.length };
};
