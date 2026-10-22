// Asking Grant Coach to write: what the page sends the grant-writer function,
// and what comes back. The page gathers the three things a draft is built
// from — the About NLA library, the live numbers, and what is already
// written in this folder — so the function never guesses and Josh can see
// exactly what it was told.
import { supabase } from "@/integrations/supabase/client";
import { ORG_FIELDS, orgFieldValue, formatEin } from "@/lib/grantCoach/orgProfile";
import type { Fact } from "@/lib/grantCoach/liveFacts";

export interface LibraryEntry {
  key: string;
  label: string;
  value: string;
  /**
   * Story and context only. These fields were seeded from the website and the
   * CPF proposal and carry youth statistics from an earlier moment; the writer
   * takes their words and flow but never their numbers. Every count about
   * NLA's youth comes from the live numbers. (Josh, 2026-10-17.)
   */
  storyOnly?: boolean;
}

/** Library fields whose youth statistics must never be cited: the live numbers replace them. */
export const STORY_ONLY_KEYS = new Set(["need", "demographics", "impact", "service_area", "target_population", "story", "facility", "mission"]);

/** The library as the writer sees it: every field with text, saved value over website seed. */
export async function loadLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value");
  if (error) throw new Error(error.message);
  const saved: Record<string, string | null> = {};
  ((data ?? []) as { key: string; value: string | null }[]).forEach((r) => { saved[r.key] = r.value; });
  return ORG_FIELDS
    .map((f) => ({ key: f.key, label: f.label, value: f.key === "ein" ? formatEin(orgFieldValue(f, saved)) : orgFieldValue(f, saved).trim(), storyOnly: STORY_ONLY_KEYS.has(f.key) || undefined }))
    .filter((e) => e.value);
}

export interface DraftFolder {
  name: string; funder: string; program_name: string | null; amount_requested: number | null;
  period_start: string | null; period_end: string | null; due_at: string | null; notes: string | null;
}
export interface DraftItem {
  id: string; section: string; label: string; detail: string | null; kind: string; answer: string | null;
  /** The funder's length limit on this answer, if the portal states one. */
  limit_kind?: "words" | "characters" | null; limit_value?: number | null;
}

export interface ChatMessage { role: "user" | "coach"; content: string }

/** What a portal screenshot reads as: one question or field. */
export interface ReadQuestion {
  screen: string; text: string; help: string; kind: "field" | "narrative" | "upload" | "acknowledgment" | "signature" | "choice";
  required: boolean; limit_kind: "words" | "characters" | null; limit_value: number | null;
}

export interface DraftRequest {
  mode: "item" | "narrative" | "chat";
  folder: DraftFolder;
  /** The item to write (item mode). */
  item?: DraftItem;
  /** The seven narrative items, in the funder's order (narrative mode). */
  narrativeItems?: DraftItem[];
  /** Everything already answered in this folder, for consistency. */
  answered: { section: string; label: string; answer: string }[];
  library: LibraryEntry[];
  facts: Fact[];
  /** "Make it shorter", "lead with the meals", … */
  instruction?: string;
  /** chat: the conversation so far, the new message last. */
  messages?: ChatMessage[];
}

export interface DraftResult {
  answer?: string;
  sections?: { n: number; heading: string; text: string }[];
  words?: number;
  /** chat: what Grant Coach says back. */
  reply?: string;
}

/** Read the questions off uploaded portal screenshots (storage paths, in order). */
export async function readPortalScreens(paths: string[]): Promise<ReadQuestion[]> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "read_screens", screens: paths } });
  if (error) {
    let reason = error.message;
    try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return (data?.questions ?? []) as ReadQuestion[];
}

/** How an answer measures against the funder's limit. */
export const measure = (text: string | null | undefined, kind: "words" | "characters" | null | undefined) => {
  const t = (text ?? "").trim();
  return kind === "characters" ? t.length : t ? t.split(/\s+/).length : 0;
};

/** Call the writer. Throws with the function's own reason when it refuses or fails. */
export async function draftWithGrantCoach(req: DraftRequest): Promise<DraftResult> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: req });
  if (error) {
    let reason = error.message;
    try {
      const res = (error as { context?: Response }).context;
      const said = res ? await res.clone().json() : null;
      if (said?.error) reason = said.error;
    } catch { /* keep the generic message */ }
    throw new Error(reason);
  }
  if (data?.error) throw new Error(data.error);
  return data as DraftResult;
}

/* ── The three-page narrative ── */

export const NARRATIVE_SECTION = "8 · Program Narrative";
/** About three pages at 11-point type with one-inch margins. */
export const NARRATIVE_WORD_LIMIT = 1350;

/** The seven narrative items of a folder, in the funder's order. */
export const narrativeItems = <T extends { section: string; label: string; kind: string }>(items: T[]) =>
  items.filter((i) => i.section === NARRATIVE_SECTION && i.kind === "narrative" && /^\d\./.test(i.label))
    .sort((a, b) => Number(a.label[0]) - Number(b.label[0]));

export const wordCount = (text: string | null | undefined) => (text ?? "").trim().split(/\s+/).filter(Boolean).length;

export const narrativeWordCount = (items: { answer: string | null }[]) => items.reduce((n, i) => n + wordCount(i.answer), 0);
