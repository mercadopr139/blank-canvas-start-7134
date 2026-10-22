// Grant Coach's story bank (2026-10-22): the real moments that prove NLA
// works, told once and drawn on by every grant after. Consent decides use:
// 'named' — first names allowed; 'anonymous' — no names at all; 'private' —
// kept for Josh, never used in writing.
import { supabase } from "@/integrations/supabase/client";

export type Consent = "named" | "anonymous" | "private";

export interface StoryRow {
  id: string; title: string; story: string; raw: string | null; program: string | null; proves: string[];
  people: string | null; year: string | null; consent: Consent; folder_id: string | null; updated_at: string;
}

/** A write-up Grant Coach proposes; Josh picks the consent before it is saved. */
export interface StoryDraft { title: string; story: string; program?: string | null; proves?: string[]; people?: string | null; left_out?: string | null }

export const CONSENT: { key: Consent; label: string; help: string }[] = [
  { key: "named", label: "Family said yes", help: "First names may be used. Never a last name." },
  { key: "anonymous", label: "Anonymous only", help: "Told with no names at all." },
  { key: "private", label: "Don't use in writing", help: "Kept here for you; Grant Coach never uses it." },
];

/** What the writer may use: never a private story. */
export const usableStories = (list: StoryRow[]) =>
  list.filter((s) => s.consent !== "private").map((s) => ({ id: s.id, title: s.title, story: s.story, program: s.program, proves: s.proves ?? [], consent: s.consent as "named" | "anonymous" }));

export async function loadStories(): Promise<StoryRow[]> {
  const { data, error } = await supabase.from("grant_stories" as never).select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StoryRow[];
}

export async function saveStory(d: StoryDraft & { raw?: string | null; consent: Consent; folder_id?: string | null }, userId: string | null) {
  const { error } = await supabase.from("grant_stories" as never).insert({
    title: d.title.trim(), story: d.story.trim(), raw: d.raw ?? null, program: d.program?.trim() || null,
    proves: (d.proves ?? []).map((p) => p.trim()).filter(Boolean), people: d.people?.trim() || null,
    year: new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 4),
    consent: d.consent, folder_id: d.folder_id ?? null, created_by: userId,
  } as never);
  if (error) throw new Error(error.message);
}

/** Write up a story told in Josh's own words (it is not saved until he picks the consent). */
export async function writeUpStory(raw: string, library: { key: string; label: string; value: string }[]): Promise<StoryDraft> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "story", raw, library } });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return data.draft as StoryDraft;
}
