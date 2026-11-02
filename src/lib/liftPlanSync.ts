// The lift plan drives the practice plan's Strength / S&C column (Josh,
// 2026-11-02: "because I created the practice plan first and Thursday didn't
// include the Battle Team workout plan, when I included it later, it didn't
// update the practice plan").
//
// After a lift week is built, every night it lifts gets a weights column in
// that team's practice column for the week — if there is not one already —
// marked "this week only" and from_lift, with the lift as its line. A rebuild
// keeps that line current. A night the lift week dropped loses the column
// build made, as long as nobody wrote anything else into it. A column Josh
// made or the template gave is never touched. The template is never touched.
import { supabase } from "@/integrations/supabase/client";
import { isWeightsBlock } from "@/lib/practicePlan";
import { weekdayOf, type WeekdayKey } from "@/lib/programWeek";

export type LiftGroup = "battle_team" | "non_battle_team";

interface Row { id: string; weekday: number; position: number; category: string; detail: string | null; hidden?: boolean; from_lift?: boolean }

const COLUMN: Record<LiftGroup, string> = { battle_team: "Strength", non_battle_team: "S&C" };

/**
 * Line the practice week's weights columns up with a lift week. `sessions`
 * is each night the lift week runs on and the line to show for it. Returns
 * what changed, or null when there is no practice week to line up with yet.
 */
export async function syncLiftColumns(weekStart: string, group: LiftGroup, sessions: { night: WeekdayKey; line: string }[]): Promise<{ added: number; updated: number; removed: number } | null> {
  const { data: wk } = await supabase.from("practice_weeks" as never).select("id").eq("week_start", weekStart).maybeSingle();
  const weekId = (wk as unknown as { id: string } | null)?.id;
  if (!weekId) return null;
  const { data } = await supabase.from("practice_blocks" as never).select("id, weekday, position, category, detail, hidden, from_lift").eq("week_id", weekId).eq("group", group);
  const blocks = ((data ?? []) as unknown as Row[]);
  const wanted = new Map(sessions.map((s) => [weekdayOf(s.night), s.line]));
  let added = 0, updated = 0, removed = 0;

  for (const [weekday, line] of wanted) {
    const weights = blocks.filter((b) => b.weekday === weekday && isWeightsBlock(b.category));
    const shown = weights.find((b) => !b.hidden);
    if (shown) {
      // Build's own column keeps its line current; a column from the template or Josh keeps its words.
      if (shown.from_lift && (shown.detail ?? "") !== line) {
        await supabase.from("practice_blocks" as never).update({ detail: line } as never).eq("id", shown.id);
        updated += 1;
      }
      continue;
    }
    const hiddenOne = weights.find((b) => b.hidden);
    if (hiddenOne) {
      // Left hidden when a workout was moved away: it is wanted again.
      await supabase.from("practice_blocks" as never).update({ hidden: false, ...(hiddenOne.from_lift ? { detail: line } : {}) } as never).eq("id", hiddenOne.id);
      updated += 1;
      continue;
    }
    const inColumn = blocks.filter((b) => b.weekday === weekday);
    const position = inColumn.length ? Math.min(...inColumn.map((b) => b.position)) - 1 : 0;
    const { error } = await supabase.from("practice_blocks" as never).insert({
      week_id: weekId, group, weekday, position, category: COLUMN[group], detail: line, category_overridden: true, from_lift: true,
    } as never);
    if (!error) added += 1;
  }

  // Nights the lift week dropped: build's own, untouched columns come off.
  const stale = blocks.filter((b) => b.from_lift && !b.hidden && !wanted.has(b.weekday) && isWeightsBlock(b.category));
  for (const b of stale) {
    const touched = (b.detail ?? "").trim() && !sessions.some((s) => s.line === b.detail) && b.detail !== COLUMN[group];
    if (touched) continue;
    const { error } = await supabase.from("practice_blocks" as never).delete().eq("id", b.id);
    if (!error) removed += 1;
  }
  return { added, updated, removed };
}

/** One line for the toast. */
export const syncSummary = (r: { added: number; updated: number; removed: number } | null, team: string) => {
  if (!r) return null;
  const parts = [
    r.added ? `${r.added} ${team} column${r.added === 1 ? "" : "s"} added to the practice plan` : null,
    r.updated ? `${r.updated} updated` : null,
    r.removed ? `${r.removed} taken off` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};
