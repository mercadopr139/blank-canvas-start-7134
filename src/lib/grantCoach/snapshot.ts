// The Program Year Snapshot (Josh, 2026-10-24) — one fixed, funder-neutral
// block per program year, four sections, each approved word for word and
// locked until Josh unlocks it. Copy-paste into any application; Grant Coach
// reads the approved sections as source 2 (after the website, before the raw
// live numbers) and uses their figures and sentences as written.
import { supabase } from "@/integrations/supabase/client";
import { factPeriods } from "@/lib/grantCoach/liveFacts";

export const SNAPSHOT_SECTIONS = [
  { key: "who_we_served", sort: 1, title: "Who we served" },
  { key: "what_we_do", sort: 2, title: "What we do · More than a boxing gym" },
  { key: "organization", sort: 3, title: "Organization overview" },
  { key: "capacity", sort: 4, title: "Capacity and partners" },
] as const;

export type SnapshotKey = (typeof SNAPSHOT_SECTIONS)[number]["key"];

export interface SnapshotSection {
  id: string;
  program_year: string;
  section_key: SnapshotKey;
  sort: number;
  title: string;
  body: string;
  status: "draft" | "approved";
  approved_at: string | null;
  updated_at: string;
}

/** The program year the Snapshot describes: the last complete one ("2025-2026"). */
export const snapshotYear = (today = new Date()) => factPeriods(today)[0].year;

/** "2025-2026" → "2025–26". */
export const shortYear = (y: string) => (/^\d{4}-\d{4}$/.test(y) ? `${y.slice(0, 4)}–${y.slice(7)}` : y);

const table = () => supabase.from("grant_year_snapshots" as never);

/** Every section for a year, in order; a section never written comes back as an empty draft (no id). */
export async function loadSnapshot(year: string): Promise<SnapshotSection[]> {
  const { data, error } = await (table().select("*").eq("program_year", year) as unknown as Promise<{ data: SnapshotSection[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return SNAPSHOT_SECTIONS.map((s) => rows.find((r) => r.section_key === s.key) ?? {
    id: "", program_year: year, section_key: s.key, sort: s.sort, title: s.title, body: "", status: "draft" as const, approved_at: null, updated_at: "",
  });
}

/** The years that have a Snapshot, newest first. */
export async function snapshotYears(): Promise<string[]> {
  const { data } = await (table().select("program_year") as unknown as Promise<{ data: { program_year: string }[] | null }>);
  return [...new Set((data ?? []).map((r) => r.program_year))].sort().reverse();
}

/** Save a section's words (a draft; an approved section is locked and must be unlocked first). */
export async function saveSection(s: SnapshotSection, body: string, userId: string | null): Promise<void> {
  if (s.status === "approved") throw new Error("This section is approved and locked. Unlock it to edit.");
  const row = { program_year: s.program_year, section_key: s.section_key, sort: s.sort, title: s.title, body, status: "draft", updated_at: new Date().toISOString(), updated_by: userId };
  const { error } = await (table().upsert(row as never, { onConflict: "program_year,section_key" }) as unknown as Promise<{ error: { message: string } | null }>);
  if (error) throw new Error(error.message);
}

/** Approve: the words are final and locked until Josh unlocks them. */
export async function approveSection(s: SnapshotSection, body: string, userId: string | null): Promise<void> {
  if (!body.trim()) throw new Error("Write the section before approving it.");
  const now = new Date().toISOString();
  const row = { program_year: s.program_year, section_key: s.section_key, sort: s.sort, title: s.title, body, status: "approved", approved_at: now, approved_by: userId, updated_at: now, updated_by: userId };
  const { error } = await (table().upsert(row as never, { onConflict: "program_year,section_key" }) as unknown as Promise<{ error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  invalidateWriterSnapshot();
}

/** Unlock: back to a draft, words kept. Grant Coach stops using it until it is approved again. */
export async function unlockSection(s: SnapshotSection, userId: string | null): Promise<void> {
  const { error } = await (table().update({ status: "draft", approved_at: null, updated_at: new Date().toISOString(), updated_by: userId } as never).eq("id", s.id) as unknown as Promise<{ error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  invalidateWriterSnapshot();
}

/** The whole Snapshot as one block of text, sections in order. */
export const snapshotText = (sections: { body: string }[]) =>
  sections.map((s) => s.body.trim()).filter(Boolean).join("\n\n\n");

/* ── What Grant Coach's writer reads ── */

export interface WriterSnapshot { year: string; sections: { title: string; body: string }[] }

let cached: { at: number; value: WriterSnapshot | null } | null = null;
const invalidateWriterSnapshot = () => { cached = null; };

/** The newest year's APPROVED sections only — a draft or unlocked section is never sent. */
export async function approvedSnapshotForWriter(): Promise<WriterSnapshot | null> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  try {
    const { data } = await (table().select("program_year, sort, title, body, status").eq("status", "approved") as unknown as Promise<{ data: { program_year: string; sort: number; title: string; body: string }[] | null }>);
    const rows = data ?? [];
    const year = [...new Set(rows.map((r) => r.program_year))].sort().reverse()[0];
    const value = year
      ? { year, sections: rows.filter((r) => r.program_year === year && r.body.trim()).sort((a, b) => a.sort - b.sort).map((r) => ({ title: r.title, body: r.body })) }
      : null;
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return null; // the writer still works without it
  }
}
