// What NLA knows about a funder (Josh, 2026-11-12). The funder brief is what
// the FUNDER wrote; this is what JOSH knows about them — who they are to NLA,
// who reads the applications, what the regular gift has paid for, what they
// respond to, past asks and outcomes. One row per funder in grant_funders,
// matched to folders by name (case and spacing ignored), so it follows the
// funder into every grant with them. It goes with every writer, strategy and
// reviewer call as part of the folder (DraftFolder.funder_notes).
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, type FolderStatus } from "@/lib/grantCoach/lifecycle";

export interface FunderNotes { id: string; name: string; notes: string | null; updated_at: string; updated_by: string | null }

/** The same key the database builds: lower-case, trimmed, runs of spaces collapsed. */
export const funderKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** The headings the notes box suggests, so the same things get written down for every funder. */
export const FUNDER_NOTE_PROMPTS = [
  "Who they are to NLA — how long, the regular gift and what it has paid for",
  "Who reads and decides — names, whether there is an interview",
  "What they respond to, and what to avoid",
  "History — what NLA asked for before, what happened, any feedback",
];

export async function loadFunderNotes(name: string): Promise<FunderNotes | null> {
  const key = funderKey(name);
  if (!key) return null;
  const { data, error } = await supabase.from("grant_funders" as never).select("*").eq("name_key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as FunderNotes | null) ?? null;
}

/** Save the notes for a funder; the row is made on first save. Empty notes are kept as null. */
export async function saveFunderNotes(name: string, notes: string, userId: string | null): Promise<void> {
  const clean = notes.trim() || null;
  const existing = await loadFunderNotes(name);
  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase.from("grant_funders" as never).update({ notes: clean, updated_at: now, updated_by: userId } as never).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("grant_funders" as never).insert({ name: name.trim(), notes: clean, updated_at: now, updated_by: userId } as never);
    if (error) throw new Error(error.message);
  }
}

/** A folder as the history list sees it. */
export interface FunderFolder {
  id: string; name: string; funder: string; status: string; amount_requested: number | null; amount_awarded: number | null;
  due_at: string | null; period_start: string | null; submitted_at: string | null; decided_at: string | null; decline_reason: string | null;
}

const money = (n: number | null) => (n == null ? null : `$${Number(n).toLocaleString()}`);
const yearOf = (f: FunderFolder) => (f.period_start ?? f.submitted_at ?? f.due_at ?? "").slice(0, 4) || null;

/** One line per grant NLA has in Grant Coach with this funder, newest first: "2027 · Name · Asked $X · Awarded $Y". */
export function funderHistory(folders: FunderFolder[], funder: string, exceptId?: string) {
  const key = funderKey(funder);
  return folders
    .filter((f) => f.id !== exceptId && funderKey(f.funder) === key)
    .sort((a, b) => (yearOf(b) ?? "").localeCompare(yearOf(a) ?? "") || a.name.localeCompare(b.name))
    .map((f) => {
      const status = STATUS_LABEL[f.status as FolderStatus] ?? f.status;
      const parts = [yearOf(f), f.name, f.amount_requested != null ? `asked ${money(f.amount_requested)}` : null];
      if (f.status === "active" || f.status === "closed") parts.push(f.amount_awarded != null ? `awarded ${money(f.amount_awarded)}` : "awarded");
      else if (f.status === "declined") parts.push(f.decline_reason ? `declined — ${f.decline_reason}` : "declined");
      else parts.push(status.toLowerCase());
      return { id: f.id, line: parts.filter(Boolean).join(" · ") };
    });
}

/** The heading that separates Josh's note from the history in what the writer receives; the edge function splits on it too. */
export const FUNDER_HISTORY_HEADING = "NLA's other grants with this funder in Grant Coach:";

/** The history as the writer reads it, one line each, or null when there is none. */
export const funderHistoryText = (folders: FunderFolder[], funder: string, exceptId?: string) => {
  const lines = funderHistory(folders, funder, exceptId).map((h) => h.line);
  return lines.length ? lines.join("\n") : null;
};
