// The Standard Paragraphs (Josh, 2026-11-19; born as the Program Year
// Snapshot, 2026-10-24) — one fixed, funder-neutral paragraph per topic per
// program year, each approved word for word and locked until Josh unlocks
// it. A question that asks for what a paragraph says gets the paragraph
// VERBATIM: "Use a standard paragraph" on the question drops it in, and the
// matcher offers it by itself when the question is plainly that topic. Grant
// Coach reads the approved paragraphs as source 2 (after the website, before
// the raw live numbers) and uses their figures and sentences as written.
//
// Six paragraphs, in the order a funder reads them. The Introduction is the
// one that turns a stranger's head: "a boxing gym… no, a youth development
// center that feeds kids and serves 500 a year". A sentence lives in ONE
// paragraph; the Introduction owns the identity line and nobody repeats it.
import { supabase } from "@/integrations/supabase/client";
import { factPeriods } from "@/lib/grantCoach/liveFacts";
import type { ParagraphAttachment } from "@/lib/grantCoach/paragraphAttachments";

export const SNAPSHOT_SECTIONS = [
  { key: "intro", sort: 0, title: "The Introduction", purpose: "The opening of any application: a registered nonprofit, who it serves, the meals, the partners. For \"tell us about your organization\", \"background\", \"overview\", \"who are you\"." },
  { key: "who_we_served", sort: 1, title: "Who we serve", purpose: "The need and the youth, with the year's counts and shares. For \"who do you serve\", \"target population\", \"need\", \"demographics\"." },
  { key: "what_we_do", sort: 2, title: "The program", purpose: "The three groups, the nightly rhythm, the meals, the Launch Pad, the wrap-around support. For \"describe your program\", \"services\", \"activities\"." },
  { key: "organization", sort: 3, title: "The organization", purpose: "Founders, the building, staff, the board, the trust NLA has earned. For \"organizational history\", \"leadership\", \"structure\"." },
  { key: "capacity", sort: 4, title: "Partners and capacity", purpose: "Personnel, systems, partners, the letters of support, awards. For \"capacity\", \"partners\", \"collaboration\", \"qualifications\"." },
  { key: "sustainability", sort: 5, title: "Sustainability", purpose: "What keeps every program free when a grant ends. For \"sustainability\", \"other funding\", \"after the grant period\"." },
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

/** The program year the paragraphs describe: the last complete one ("2025-2026"). */
export const snapshotYear = (today = new Date()) => factPeriods(today)[0].year;

/** "2025-2026" → "2025–26". */
export const shortYear = (y: string) => (/^\d{4}-\d{4}$/.test(y) ? `${y.slice(0, 4)}–${y.slice(7)}` : y);

/** What a paragraph is for, in a line — the picker and the matcher read it. */
export const purposeOf = (key: string) => SNAPSHOT_SECTIONS.find((s) => s.key === key)?.purpose ?? "";

const table = () => supabase.from("grant_year_snapshots" as never);

/** Every paragraph for a year, in order; one never written comes back as an empty draft (no id). Titles and order come from code, not the row. */
export async function loadSnapshot(year: string): Promise<SnapshotSection[]> {
  const { data, error } = await (table().select("*").eq("program_year", year) as unknown as Promise<{ data: SnapshotSection[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  return SNAPSHOT_SECTIONS.map((s) => {
    const row = rows.find((r) => r.section_key === s.key);
    return row
      ? { ...row, sort: s.sort, title: s.title }
      : { id: "", program_year: year, section_key: s.key, sort: s.sort, title: s.title, body: "", status: "draft" as const, approved_at: null, updated_at: "" };
  });
}

/** The years that have paragraphs, newest first. */
export async function snapshotYears(): Promise<string[]> {
  const { data } = await (table().select("program_year") as unknown as Promise<{ data: { program_year: string }[] | null }>);
  return [...new Set((data ?? []).map((r) => r.program_year))].sort().reverse();
}

/** Save a paragraph's words (a draft; an approved paragraph is locked and must be unlocked first). */
export async function saveSection(s: SnapshotSection, body: string, userId: string | null): Promise<void> {
  if (s.status === "approved") throw new Error("This paragraph is approved and locked. Unlock it to edit.");
  const row = { program_year: s.program_year, section_key: s.section_key, sort: s.sort, title: s.title, body, status: "draft", updated_at: new Date().toISOString(), updated_by: userId };
  const { error } = await (table().upsert(row as never, { onConflict: "program_year,section_key" }) as unknown as Promise<{ error: { message: string } | null }>);
  if (error) throw new Error(error.message);
}

/** Approve: the words are final and locked until Josh unlocks them. */
export async function approveSection(s: SnapshotSection, body: string, userId: string | null): Promise<void> {
  if (!body.trim()) throw new Error("Write the paragraph before approving it.");
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

/** The whole year as one block of text, paragraphs in order. */
export const snapshotText = (sections: { body: string }[]) =>
  sections.map((s) => s.body.trim()).filter(Boolean).join("\n\n\n");

/** A paragraph's pieces: each paragraph, and each bullet on its own; the heading line is dropped. */
export const piecesOf = (body: string) =>
  body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .flatMap((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      // A run of bullets: one piece per bullet. A lead-in line before them stays its own piece.
      if (lines.some((l) => /^[-•]\s/.test(l))) return lines.map((l) => l.replace(/^[-•]\s+/, ""));
      return [lines.join(" ")];
    })
    .map((t) => t.trim())
    .filter((t) => t && !/^[A-Z0-9 ·&–—'-]+$/.test(t)); // drop ALL-CAPS headings like "WHO WE SERVED · 2025–26"

/** The paragraph as it goes into an answer: the ALL-CAPS heading line dropped, the rest as written. */
export const bodyForAnswer = (body: string) =>
  body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l, i) => !(i === 0 && /^[A-Z0-9 ·&–—'-]+$/.test(l.trim())))
    .join("\n")
    .trim();

/* ── What Grant Coach's writer, the matcher and the picker read ── */

export interface WriterSnapshot { year: string; sections: { key: string; title: string; body: string }[] }

let cached: { at: number; value: WriterSnapshot | null } | null = null;
const invalidateWriterSnapshot = () => { cached = null; };

/** The newest year's APPROVED paragraphs only — a draft or unlocked paragraph is never sent. */
export async function approvedSnapshotForWriter(): Promise<WriterSnapshot | null> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value;
  try {
    const { data } = await (table().select("program_year, section_key, sort, title, body, status").eq("status", "approved") as unknown as Promise<{ data: { program_year: string; section_key: string; sort: number; title: string; body: string }[] | null }>);
    const rows = data ?? [];
    const year = [...new Set(rows.map((r) => r.program_year))].sort().reverse()[0];
    const value = year
      ? {
          year,
          sections: rows
            .filter((r) => r.program_year === year && r.body.trim())
            .map((r) => ({ key: r.section_key, title: SNAPSHOT_SECTIONS.find((s) => s.key === r.section_key)?.title ?? r.title, body: r.body, sort: SNAPSHOT_SECTIONS.find((s) => s.key === r.section_key)?.sort ?? r.sort }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ key, title, body }) => ({ key, title, body })),
        }
      : null;
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return null; // the writer still works without it
  }
}

/* ── Talk to Grant Coach on a paragraph (2026-11-19): the thread, kept per paragraph per year ── */

export interface ParagraphMsg { id: string; role: "user" | "coach"; content: string; payload: { after?: string; why?: string; used?: boolean; /** The paragraph as it stood when this was asked, so the marks stay true after later edits. */ before?: string; /** Screenshots or PDFs pasted with the message (Josh, 2026-11-20). */ attachments?: ParagraphAttachment[] } | null }

const msgTable = () => supabase.from("grant_paragraph_messages" as never);

/** The thread under a paragraph, oldest first; [] when its table is not there yet (the migration is Josh's to apply). */
export async function paragraphMessages(year: string, key: string): Promise<ParagraphMsg[]> {
  const { data, error } = await (msgTable().select("id, role, content, payload").eq("program_year", year).eq("section_key", key).order("created_at") as unknown as Promise<{ data: ParagraphMsg[] | null; error: { message: string } | null }>);
  if (error) return [];
  return data ?? [];
}

/** Save one message of the thread; null when it could not be kept (the table missing) — the conversation still runs for the session. */
export async function saveParagraphMessage(year: string, key: string, role: "user" | "coach", content: string, payload: ParagraphMsg["payload"], userId: string | null): Promise<string | null> {
  const { data, error } = await (msgTable().insert({ program_year: year, section_key: key, role, content, payload: payload ?? {}, created_by: userId } as never).select("id").single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>);
  return error ? null : data?.id ?? null;
}

/** A message whose send failed is taken back, so a retry doesn't show the question twice (Josh, 2026-11-20). */
export async function deleteParagraphMessage(id: string): Promise<void> {
  await (msgTable().delete().eq("id", id) as unknown as Promise<unknown>);
}

/** The change went into the box: the card remembers. */
export async function markParagraphMessageUsed(id: string, payload: ParagraphMsg["payload"]): Promise<void> {
  await (msgTable().update({ payload: { ...(payload ?? {}), used: true } } as never).eq("id", id) as unknown as Promise<unknown>);
}

/** A row matched to a standard paragraph carries this key: "standard:intro". It is a Vault key the fact-fill understands. */
export const STANDARD_PREFIX = "standard:";
export const isStandardKey = (key: string | null | undefined) => !!key && key.startsWith(STANDARD_PREFIX);

export interface StandardParagraph { key: string; title: string; purpose: string; body: string; words: number }

/** The approved paragraphs as the picker and the matcher see them, with the key a question row keeps. */
export const standardParagraphs = (snapshot: WriterSnapshot | null | undefined): StandardParagraph[] =>
  (snapshot?.sections ?? []).map((s) => {
    const body = bodyForAnswer(s.body);
    return { key: `${STANDARD_PREFIX}${s.key}`, title: s.title, purpose: purposeOf(s.key), body, words: body.split(/\s+/).filter(Boolean).length };
  });
