// A second application to the same funder in the same cycle (Josh, 2026-10-29).
//
// "Start the next one from this folder" builds grant #2 from grant #1 in one
// click: the funder's files, the rules read from them, the numbers and the
// grant period come across; every question comes across too. Facts (the EIN,
// the address, a portal choice) arrive as they were. Every WRITTEN answer
// arrives empty, pointing at the answer it is rewritten from — Grant Coach
// then writes it fresh for the new program, with the first application's
// answer as context, never as a template. The same facts, new sentences: a
// reader with both in front of them sees two applications from one
// consistent organization, not one application pasted twice.
import { supabase } from "@/integrations/supabase/client";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { strategyTurn, type CaseBrief, type DraftFolder, type FunderBrief, type LibraryEntry } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";

/** The folder being cloned, as the page holds it. */
export interface SourceFolder {
  id: string; name: string; funder: string; program_name: string | null; status: string; due_at: string | null;
  amount_requested: number | null; period_start: string | null; period_end: string | null; portal_url: string | null;
  notes: string | null; template_key: string | null;
  case_brief?: CaseBrief | null; funder_brief?: FunderBrief | null; funder_brief_at?: string | null; funder_brief_docs?: string[];
}
export interface SourceDoc {
  id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null; mime_type?: string | null;
  size_bytes: number | null; link_url: string | null; read_text?: string | null; read_at?: string | null;
}
export interface SourceItem {
  id: string; section: string; label: string; detail: string | null; kind: string; required: boolean; status: string; answer: string | null;
  sort_order: number; limit_kind?: string | null; limit_value?: number | null; source_path?: string | null; owner?: string | null;
  vault_key?: string | null; vault_part?: string | null; answer_source?: string | null; needs_case?: boolean;
}

/** What the person types in the Start the next one dialog. */
export interface NextInput {
  name: string;
  program: string;
  /** What the FIRST application funds, as Josh names it (saved back to that folder when he corrects it). */
  firstProgram: string;
  amount: number | null;
  /** One or two lines on what this application funds that the first did not — the angle every rewrite takes. */
  different: string;
}

/**
 * Which rows are carried as they are, and which are rewritten. A fact is the
 * same on both applications (the EIN is the EIN); anything written in
 * sentences — and anything about the program — is written again for the new
 * program. An upload comes over empty: what NLA attaches is chosen per grant.
 */
export const carryAsIs = (it: SourceItem) => {
  if (it.kind === "upload" || it.needs_case) return false;
  if (it.vault_key) return true;
  if (it.answer_source === "portal") return true;
  const shortKind = it.kind === "field" || it.kind === "choice" || it.kind === "acknowledgment" || it.kind === "signature";
  return it.answer_source === "you" && shortKind;
};

const basename = (path: string) => path.split("/").pop() ?? path;

/** Build the next application. Returns the new folder's id. Reports progress as it goes. */
export async function startNext(input: {
  source: SourceFolder; docs: SourceDoc[]; items: SourceItem[]; next: NextInput;
  library: LibraryEntry[]; facts: Fact[]; userId: string | null;
  onStage?: (s: string) => void;
}): Promise<{ id: string; warnings: string[] }> {
  const { source, docs, items, next, library, facts, userId } = input;
  const stage = (s: string) => input.onStage?.(s);
  const warnings: string[] = [];

  // 0. The first application's program, as Josh names it now ("Battle Team", not the whole program's name).
  const firstProgram = next.firstProgram.trim() || source.program_name || null;
  if (firstProgram && firstProgram !== source.program_name) {
    await supabase.from("grant_folders" as never).update({ program_name: firstProgram, updated_at: new Date().toISOString() } as never).eq("id", source.id);
  }

  // 1. The folder: same funder, same deadline, same period, same portal; the new program and ask.
  stage("Opening the folder…");
  const { data: created, error } = await supabase.from("grant_folders" as never).insert({
    name: next.name, funder: source.funder, program_name: next.program, status: "applying",
    due_at: source.due_at, amount_requested: next.amount, period_start: source.period_start, period_end: source.period_end,
    portal_url: source.portal_url, template_key: source.template_key, sibling_of: source.id, created_by: userId,
    notes: next.different.trim() ? `What this application funds that "${source.name}" does not: ${next.different.trim()}` : null,
  } as never).select("id").single();
  if (error) throw new Error(error.message);
  const newId = (created as unknown as { id: string }).id;

  // 2. The funder's files, copied so each folder owns its own (deleting one never breaks the other).
  stage("Copying the funder's files…");
  const pathMap = new Map<string, string>();
  const docIdMap = new Map<string, string>();
  for (const d of docs.filter((x) => x.side === "funder")) {
    let storage_path: string | null = null;
    if (d.storage_path) {
      storage_path = `grants/${newId}/${d.storage_path.includes("/screens/") ? "screens/" : ""}${basename(d.storage_path)}`;
      const { error: ce } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).copy(d.storage_path, storage_path);
      if (ce) { warnings.push(`${d.title}: ${ce.message}`); continue; }
      pathMap.set(d.storage_path, storage_path);
    }
    const { data: nd, error: de } = await supabase.from("grant_documents" as never).insert({
      folder_id: newId, side: "funder", title: d.title, storage_path, file_name: d.file_name, mime_type: d.mime_type ?? null,
      size_bytes: d.size_bytes, link_url: d.link_url, read_text: d.read_text ?? null, read_at: d.read_at ?? null, uploaded_by: userId,
    } as never).select("id").single();
    if (de) { warnings.push(`${d.title}: ${de.message}`); continue; }
    docIdMap.set(d.id, (nd as unknown as { id: string }).id);
  }
  // The rules, as read: they are the funder's, so they are the same for both applications.
  if (source.funder_brief) {
    const { error: be } = await supabase.from("grant_folders" as never).update({
      funder_brief: source.funder_brief, funder_brief_at: source.funder_brief_at ?? new Date().toISOString(),
      funder_brief_docs: (source.funder_brief_docs ?? []).map((id) => docIdMap.get(id)).filter(Boolean),
    } as never).eq("id", newId);
    if (be) warnings.push(`The rules didn't copy: ${be.message}`);
  }

  // 3. Every question, in portal order. Facts as they are; everything written comes over empty, to be rewritten.
  stage("Carrying the questions over…");
  const live = items.filter((i) => i.status !== "na").sort((a, b) => a.sort_order - b.sort_order);
  const rows = live.map((i) => {
    const keep = carryAsIs(i) && !!i.answer?.trim();
    return {
      folder_id: newId, section: i.section, label: i.label, detail: i.detail, kind: i.kind, required: i.required, owner: i.owner ?? null,
      sort_order: i.sort_order, limit_kind: i.limit_kind ?? null, limit_value: i.limit_value ?? null,
      source_path: i.source_path ? pathMap.get(i.source_path) ?? null : null,
      vault_key: i.vault_key ?? null, vault_part: i.vault_part ?? null, needs_case: !!i.needs_case,
      rewrite_from: i.id,
      ...(keep
        ? { answer: i.answer, answer_source: i.answer_source ?? "you", status: "in_progress" }
        : { answer: null, answer_source: null, status: "todo" }),
    };
  });
  if (rows.length) {
    const { error: ie } = await supabase.from("grant_checklist_items" as never).insert(rows as never);
    if (ie) throw new Error(`The questions didn't carry over: ${ie.message}`);
  }

  // 4. The case for the new program — written by Grant Coach from the first application's case, then locked,
  //    so every program answer is written from one story. Without it the program questions wait.
  const folder: DraftFolder = {
    name: next.name, funder: source.funder, program_name: next.program, amount_requested: next.amount,
    period_start: source.period_start, period_end: source.period_end, due_at: source.due_at, notes: null,
  };
  stage(`Writing the case for ${next.program}…`);
  try {
    const waiting = live.filter((i) => i.needs_case).map((i) => ({ label: i.label, help: i.detail, kind: i.kind, limit_kind: i.limit_kind ?? null, limit_value: i.limit_value ?? null }));
    const ask =
      `This is NLA's SECOND application to ${source.funder} in the same cycle. The first, "${source.name}", proposes ${firstProgram ?? source.case_brief?.program_name ?? "another program"}` +
      ` and asks for ${source.amount_requested != null ? `$${Number(source.amount_requested).toLocaleString()}` : "its own amount"}; it is already submitted and must not be repeated.` +
      ` This one funds ${next.program}${next.amount != null ? ` and asks for $${Number(next.amount).toLocaleString()}` : ""}.` +
      (next.different.trim() ? ` What is different about it, in Josh's words: ${next.different.trim()}` : "") +
      ` Propose the case for THIS application now — same organization and the same facts, a different program with its own need, who is served, what the money pays for and outcomes;` +
      ` nothing the money pays for here may also be paid for by the first application. Return it in "case".`;
    const reply = await strategyTurn({
      folder, library, facts, answered: [], waiting,
      messages: [{ role: "user", content: ask }],
      caseBrief: source.case_brief ?? null, funderBrief: source.funder_brief ?? null,
    });
    if (reply.case) {
      const { error: ce } = await supabase.from("grant_folders" as never).update({ case_brief: { ...reply.case, program_name: reply.case.program_name || next.program }, case_locked_at: new Date().toISOString() } as never).eq("id", newId);
      if (ce) warnings.push(`The case didn't save: ${ce.message}`);
    } else throw new Error("Grant Coach didn't propose a case.");
  } catch (e) {
    // Without a case the program questions would wait. A plain one from what Josh typed keeps them moving;
    // the writer fills the rest from the Vault and the live numbers.
    const plain: CaseBrief = {
      program_name: next.program, pitch: next.different.trim() || `${next.program} at NLA`, what_the_money_pays_for: next.different.trim(),
      ask_amount: next.amount, total_cost: null, start_date: source.period_start, end_date: source.period_end, service_frequency: null,
      who_is_served: "", proof_points: [], outcomes: [], story: null, reviewer_answers: [],
    };
    await supabase.from("grant_folders" as never).update({ case_brief: plain, case_locked_at: new Date().toISOString() } as never).eq("id", newId);
    warnings.push(`Grant Coach couldn't write the case for ${next.program} (${(e as Error).message}); the answers are written from what you typed and the Vault instead.`);
  }

  return { id: newId, warnings };
}

/* ── The sameness check ── */

const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9$%.\s-]+/g, " ").split(/\s+/).filter(Boolean);
const SHINGLE = 6;

/**
 * How much of `text` still reads as `other`, 0–100: the share of its six-word
 * runs that appear word for word in the other answer. Facts and short fields
 * are expected to match; prose should not.
 */
export function overlapPercent(text: string | null | undefined, other: string | null | undefined): number {
  const a = words(text ?? ""), b = words(other ?? "");
  if (!a.length || !b.length) return 0;
  if (a.length < SHINGLE * 2 || b.length < SHINGLE * 2) return a.join(" ") === b.join(" ") ? 100 : 0;
  const seen = new Set<string>();
  for (let i = 0; i + SHINGLE <= b.length; i++) seen.add(b.slice(i, i + SHINGLE).join(" "));
  let hit = 0, n = 0;
  for (let i = 0; i + SHINGLE <= a.length; i++, n++) if (seen.has(a.slice(i, i + SHINGLE).join(" "))) hit++;
  return n ? Math.round((hit / n) * 100) : 0;
}

/** Too close to the first application: a reader with both would notice. */
export const TOO_CLOSE = 35;

/** The first application, as the second one's page needs it: its name, program, and every answer by row id. */
export interface SiblingContext { id: string; name: string; program: string | null; answers: Map<string, { label: string; answer: string | null }> }

export async function loadSibling(folderId: string): Promise<SiblingContext | null> {
  const { data: f, error } = await supabase.from("grant_folders" as never).select("id, name, program_name, case_brief").eq("id", folderId).maybeSingle();
  if (error || !f) return null;
  const folder = f as unknown as { id: string; name: string; program_name: string | null; case_brief: CaseBrief | null };
  const { data: rows } = await supabase.from("grant_checklist_items" as never).select("id, label, answer").eq("folder_id", folderId);
  const answers = new Map<string, { label: string; answer: string | null }>();
  for (const r of (rows ?? []) as unknown as { id: string; label: string; answer: string | null }[]) answers.set(r.id, { label: r.label, answer: r.answer });
  return { id: folder.id, name: folder.name, program: folder.program_name ?? folder.case_brief?.program_name ?? null, answers };
}

/** The writer's instruction for a rewritten answer: context, never a template. */
export const rewriteInstruction = (sib: SiblingContext, thisProgram: string | null, previous: string) =>
  `THIS IS NLA'S SECOND APPLICATION TO THE SAME FUNDER IN THE SAME CYCLE. The first, "${sib.name}", proposes ${sib.program ?? "another program"} and is already submitted. ` +
  `This one proposes ${thisProgram ?? "a different program"}. The first application answered this question as follows — CONTEXT ONLY, NEVER A TEMPLATE:\n«${previous.trim()}»\n` +
  `Write this answer FRESH for ${thisProgram ?? "this program"}: the same facts, names, dates and figures from the Vault and the live numbers (they must agree across both applications), ` +
  `but new sentences in a new order, led by what matters to ${thisProgram ?? "this program"}. Do not reuse the first application's sentences or its openings; a reader with both in front of them must see two distinct applications from one consistent organization. ` +
  `Where the question is about the organization rather than the program, keep every fact identical and change only the prose.`;

/** The sister application as the writer receives it: every answered question, label and answer (2026-10-30). */
export const siblingForWriter = (sib: SiblingContext | null | undefined) =>
  sib ? { name: sib.name, program: sib.program, application: [...sib.answers.values()].filter((a) => a.answer?.trim()).map((a) => ({ label: a.label, answer: a.answer!.trim() })) } : undefined;
