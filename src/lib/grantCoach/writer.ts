// Asking Grant Coach to write: what the page sends the grant-writer function,
// and what comes back. The page gathers the three things a draft is built
// from — the About NLA library, the live numbers, and what is already
// written in this folder — so the function never guesses and Josh can see
// exactly what it was told.
import { supabase } from "@/integrations/supabase/client";
import { SITE_TEXT } from "@/lib/grantCoach/siteText";
import { approvedSnapshotForWriter, type WriterSnapshot } from "@/lib/grantCoach/snapshot";
import { ORG_FIELDS, orgFieldValue, formatEin } from "@/lib/grantCoach/orgProfile";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { StoryDraft } from "@/lib/grantCoach/stories";

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
export const STORY_ONLY_KEYS = new Set(["need", "demographics", "impact", "service_area", "target_population", "story", "facility", "mission", "writing_examples"]);

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
  /** The answer already typed or selected on the portal screen, or "". */
  typed?: string;
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
  /** The locked case: story answers are written from it. */
  caseBrief?: CaseBrief | null;
  /** What the funder's own documents say. */
  funderBrief?: FunderBrief | null;
  /** The story bank (never private stories), and the ones already told in this application. */
  stories?: WriterStory[];
  usedStoryIds?: string[];
  /** chat: the conversation so far, the new message last. */
  messages?: ChatMessage[];
  /** The last draft card in the conversation — what a requested change is applied to. */
  currentDraft?: string | null;
  /** The public website's words — added to every call by draftWithGrantCoach. */
  siteText?: string;
  /** The approved Program Year Snapshot — source 2, added to every call by draftWithGrantCoach. */
  snapshot?: WriterSnapshot | null;
  /** chat: the other questions on the same screen, numbered from 1, which Grant Coach fills only when asked. */
  siblings?: { i: number; label: string; help: string | null; kind: string; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
}

export interface DraftResult {
  answer?: string;
  sections?: { n: number; heading: string; text: string }[];
  words?: number;
  /** chat: what Grant Coach says back. */
  reply?: string;
  /** item: one line asking for a fact the answer needs, or null. */
  needs?: string | null;
  /** item: the story-bank story the answer tells, or null. */
  story_id?: string | null;
  /** item: which scoring criterion a story answer earns points on, and the evidence. */
  score_note?: string | null;
  /** chat: answers for other questions on the screen, by number, when Josh asked for them. */
  fills?: { i: number; answer: string }[];
  /** item / chat: what bears on the question but is not in the answer, and why. */
  left_out?: string[];
  /** chat: a story Josh just told, written up to save. */
  story_draft?: StoryDraft;
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

/** The function's own reason when it refuses or fails. */
const fail = async (error: { message: string }) => {
  let reason = error.message;
  try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
  return new Error(reason);
};

/** Read every question off an application: screenshots or PDFs in storage, and/or its text. */
export async function readApplication(input: { paths?: string[]; text?: string }): Promise<{ questions: ReadQuestion[]; note: string | null }> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "read_screens", screens: input.paths ?? [], text: input.text ?? "" } });
  if (error) throw await fail(error);
  if (data?.error) throw new Error(data.error);
  return { questions: (data?.questions ?? []) as ReadQuestion[], note: (data?.note as string | null) ?? null };
}

/** Same question, same wording: what makes a re-pasted screen a duplicate. */
export const questionKey = (label: string, help?: string | null) =>
  `${label}|${help ?? ""}`.toLowerCase().replace(/[^a-z0-9|]+/g, " ").replace(/\s+/g, " ").trim();

export interface VaultMatch { i: number; vault_key: string | null; part: string | null; document_key: string | null; memory_id?: string | null; needs_case?: boolean }

/** Which Grant Vault field (or org document) each question wants. The app fills the value itself. */
export async function matchToVault(
  questions: { i: number; screen: string; text: string; help: string; kind: string }[],
  catalog: { fields: { key: string; label: string; kind: string }[]; documents: { key: string; label: string }[] },
  memory: { id: string; question: string; funder: string | null }[] = [],
): Promise<VaultMatch[]> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "classify", questions, catalog, memory } });
  if (error) throw await fail(error);
  if (data?.error) throw new Error(data.error);
  return (data?.matches ?? []) as VaultMatch[];
}

/** How an answer measures against the funder's limit. */
export const measure = (text: string | null | undefined, kind: "words" | "characters" | null | undefined) => {
  const t = (text ?? "").trim();
  return kind === "characters" ? t.length : t ? t.split(/\s+/).length : 0;
};

/** Call the writer. Throws with the function's own reason when it refuses or fails. */
export async function draftWithGrantCoach(req: DraftRequest): Promise<DraftResult> {
  // The website goes with every call: Grant Coach's first source (Josh, 2026-10-23).
  // The approved Snapshot goes with it: source 2, its words used as written (2026-10-24).
  const snapshot = await approvedSnapshotForWriter();
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { ...req, siteText: SITE_TEXT, snapshot } });
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

/* ── The strategy session ── */

/** The one-page case every story answer is written from (grant_folders.case_brief). */
export interface CaseBrief {
  program_name: string; pitch: string; what_the_money_pays_for: string;
  ask_amount: number | null; total_cost: number | null; start_date: string | null; end_date: string | null;
  service_frequency: string | null; who_is_served: string; proof_points: string[]; outcomes: string[];
  story: string | null; reviewer_answers: string[];
}
/** One program Grant Coach puts on the table, with the proof and the weak spots. */
export interface StrategyOption { program: string; fit: number; why: string; proof: string[]; weak_spots: string[] }
/** A story as the writer sees it. */
export interface WriterStory { id: string; title: string; story: string; program: string | null; proves: string[]; consent: "named" | "anonymous" }
export interface StrategyReply { reply: string; options?: StrategyOption[]; case?: CaseBrief; story_draft?: StoryDraft; model?: string }

/** One turn of the strategy session. An empty conversation opens it: Grant Coach comes prepared. */
export async function strategyTurn(req: {
  folder: DraftFolder; library: LibraryEntry[]; facts: Fact[]; answered: DraftRequest["answered"];
  messages: ChatMessage[]; waiting: { label: string; help: string | null; kind: string; limit_kind?: string | null; limit_value?: number | null }[];
  caseBrief?: CaseBrief | null;
  stories?: WriterStory[];
  funderBrief?: FunderBrief | null;
}): Promise<StrategyReply> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "strategy", ...req } });
  if (error) throw await fail(error);
  if (data?.error) throw new Error(data.error);
  return data as StrategyReply;
}

/* ── The funder brief: what the funder's documents say, read once ── */

export interface FunderBrief {
  summary: string; funds: string[]; does_not_fund: string[];
  rubric: { criterion: string; points: number | null; what_scores: string }[];
  priorities: string[]; their_words: string[]; eligibility: string[]; data_and_reporting: string[];
  budget_rules: string[]; budget_categories: string[]; dates: string[]; marked_down: string[];
  key_quotes: string[]; open_questions: string[]; corrections?: string | null; sources?: string[];
}

/** Read the funder's documents into the brief: PDFs and images by path, Word/Excel/PowerPoint as text. */
export async function readFunderBrief(folder: DraftFolder, docs: { title: string; path?: string; text?: string }[]): Promise<FunderBrief> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "funder_brief", folder, docs, library: [], facts: [], answered: [] } });
  if (error) throw await fail(error);
  if (data?.error) throw new Error(data.error);
  return data.brief as FunderBrief;
}

/* ── The Snapshot: next year's section, redrafted from this year's ── */

/** Redraft one Snapshot section: Josh's approved wording kept sentence for sentence; only figures the live numbers now state differently change. */
export async function redraftSnapshotSection(input: {
  year: string;
  title: string;
  current: string;
  previous?: string | null;
  instruction?: string;
  library: LibraryEntry[];
  facts: Fact[];
}): Promise<{ answer: string; changed: string[] }> {
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "snapshot", ...input, siteText: SITE_TEXT } });
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
  return { answer: String(data?.answer ?? ""), changed: Array.isArray(data?.changed) ? data.changed : [] };
}

/* ── After the application: reporting, the fit check, the budget ── */

const call = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const snapshot = await approvedSnapshotForWriter();
  const { data, error } = await supabase.functions.invoke("grant-writer", { body: { answered: [], ...body, siteText: SITE_TEXT, snapshot } });
  if (error) throw await fail(error);
  if (data?.error) throw new Error(data.error);
  return data as T;
};

export interface PlannedReport { title: string; kind: "narrative" | "financial" | "data" | "reimbursement" | "other"; detail: string | null; period_start: string | null; period_end: string | null; due_on: string | null }

/** Awarded: the reporting checklist, from the funder brief's rules — or from the award letter when the requirements changed. */
export const planReporting = (folder: DraftFolder, funderBrief: FunderBrief | null, awardDocs: { title: string; path?: string; text?: string }[] = []) =>
  call<{ reports: PlannedReport[]; notes: string[] }>({ mode: "reporting_plan", folder, funderBrief, docs: awardDocs, library: [], facts: [] });

/** One report, from the period's live numbers and what the application promised. */
export const draftReport = (input: { folder: DraftFolder; funderBrief: FunderBrief | null; report: { title: string; kind: string; detail: string | null; period_start: string | null; period_end: string | null }; promised: { label: string; answer: string }[]; library: LibraryEntry[]; facts: Fact[]; instruction?: string }) =>
  call<{ answer: string; gaps: string[] }>({ mode: "report", ...input });

export interface FitCheck { verdict: "go" | "maybe" | "no_go"; score: number; summary: string; strengths: string[]; risks: string[]; must_haves: string[]; questions: string[] }
export const runFitCheck = (input: { folder: DraftFolder; funderBrief: FunderBrief | null; library: LibraryEntry[]; facts: Fact[] }) =>
  call<{ fit: FitCheck }>({ mode: "fit", ...input }).then((r) => r.fit);

export interface BudgetLine { category: string; item: string; amount: number; justification: string }
export interface BudgetDraft { lines: BudgetLine[]; total: number; notes: string[]; needs: string[] }
export const draftBudget = (input: { folder: DraftFolder; funderBrief: FunderBrief | null; library: LibraryEntry[]; facts: Fact[]; instruction?: string }) =>
  call<{ budget: BudgetDraft }>({ mode: "budget", ...input }).then((r) => r.budget);
