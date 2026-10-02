// The coach's note at the top of a Workout Plan on the wall.
//
// It is the text typed into the night's Strength / S&C block on the Practice
// Plan — "bring your wraps", "kettlebells from the van" — so there is nothing
// new to fill in and no second place for it to live. Read from the published
// week only: the wall never shows a draft.
import { supabase } from "@/integrations/supabase/client";
import { isWeightsBlock } from "@/lib/practicePlan";

export const fetchLiftNote = async (
  weekStart: string,
  weekday: number,
  group: "battle_team" | "non_battle_team",
): Promise<string | null> => {
  const { data: wk } = await supabase
    .from("practice_weeks" as never)
    .select("id, status")
    .eq("week_start", weekStart)
    .maybeSingle();
  const week = (wk as unknown as { id: string; status: string } | null) ?? null;
  if (!week || week.status !== "published") return null;
  const { data } = await supabase
    .from("practice_blocks" as never)
    .select("category, detail")
    .eq("week_id", week.id)
    .eq("weekday", weekday)
    .eq("group", group);
  const rows = (data ?? []) as unknown as { category: string; detail: string | null }[];
  const note = rows.find((r) => isWeightsBlock(r.category) && r.detail?.trim())?.detail?.trim();
  return note || null;
};
