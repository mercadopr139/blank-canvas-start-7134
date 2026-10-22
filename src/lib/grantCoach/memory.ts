// Grant Coach's memory: every answer Josh approves, kept for the next grant
// (2026-10-22). The Grant Vault holds NLA's facts; this holds NLA's answers.
// One row per approved question (grant_answer_memory.item_id is unique), so
// re-approving replaces it and un-approving takes it back out.
import { supabase } from "@/integrations/supabase/client";
import { LEAVE_BLANK } from "@/lib/grantCoach/answers";

export interface MemoryRow {
  id: string; question: string; help: string | null; kind: string; answer: string; funder: string | null;
  folder_id: string | null; item_id: string | null; source: string | null;
  limit_kind: string | null; limit_value: number | null; updated_at: string;
}

interface Rememberable {
  id: string; label: string; detail: string | null; kind: string; answer: string | null; status: string;
  answer_source?: string | null; limit_kind?: string | null; limit_value?: number | null;
}

/**
 * Worth remembering: an approved answer with something in it. Vault facts are
 * already in the Vault, and "Leave blank" is not an answer.
 */
export const shouldRemember = (it: Rememberable) =>
  it.status === "done" && !!it.answer?.trim() && it.answer.trim() !== LEAVE_BLANK && it.answer_source !== "vault";

export async function loadMemory(): Promise<MemoryRow[]> {
  const { data, error } = await supabase.from("grant_answer_memory" as never).select("*").order("updated_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MemoryRow[];
}

/** Keep (or replace) the memory of one approved question. Quiet on failure: memory never blocks the application. */
export async function remember(it: Rememberable, ctx: { folderId: string; funder: string; userId: string | null }) {
  if (!shouldRemember(it)) return;
  await supabase.from("grant_answer_memory" as never).upsert({
    item_id: it.id, folder_id: ctx.folderId, funder: ctx.funder, question: it.label, help: it.detail, kind: it.kind,
    answer: it.answer!.trim(), source: it.answer_source ?? null, limit_kind: it.limit_kind ?? null, limit_value: it.limit_value ?? null,
    updated_at: new Date().toISOString(), created_by: ctx.userId,
  } as never, { onConflict: "item_id" } as never);
}

/** The question is no longer approved: its answer is not NLA's final word any more. */
export async function forget(itemIds: string[]) {
  if (!itemIds.length) return;
  await supabase.from("grant_answer_memory" as never).delete().in("item_id", itemIds);
}
