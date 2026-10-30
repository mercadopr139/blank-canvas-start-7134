// Grant Coach — the application, answered (Josh, 2026-10-22).
//
// The Wawa standard: one big tile. Paste the funder's screens (or drop a PDF,
// a Word file, or the question text) and Grant Coach does the rest — reads
// every question, fills the facts exactly from the Grant Vault, writes the
// rest from the Vault and the back end's live numbers. The person only says
// Approve, or click the answer to edit it in place (one place to edit;
// Josh, 2026-10-29). An approved answer that changes is "Changed · approve again".
// Coach what to change. Anything it can't stand behind says "Needs you".
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check, Copy, Loader2, Upload, X, FileQuestion, Globe, History, BookHeart, Award, RefreshCw, Sparkles, Eye, Printer, MoreHorizontal, Trash2, AlertCircle, Pencil, Vault, Paperclip, ExternalLink,
} from "lucide-react";
import AttachPicker from "@/components/admin/grantCoach/AttachPicker";
import { attachedAnswer, openFolderDoc, readAttachment, readLabel, type FolderDoc } from "@/lib/grantCoach/attachments";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { ORG_FIELDS } from "@/lib/grantCoach/orgProfile";
import { readApplication, matchToVault, draftWithGrantCoach, measure, questionKey, NARRATIVE_SECTION, type LibraryEntry, type DraftFolder, type CaseBrief, type FunderBrief } from "@/lib/grantCoach/writer";
import NarrativeTools, { NarrativeBlurb } from "@/components/admin/grantCoach/ProgramNarrative";
import type { PromptAsk } from "@/components/admin/AskDialog";
import QuestionChat from "@/components/admin/grantCoach/QuestionChat";
import NeedMarks from "@/components/admin/grantCoach/NeedMarks";
import type { ReactNode } from "react";
import GrantReviewer from "@/components/admin/grantCoach/GrantReviewer";
import type { Review } from "@/lib/grantCoach/review";
import { loadStories, usableStories } from "@/lib/grantCoach/stories";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import { vaultAnswer, documentAnswer, needsFrom, isFactRow, vaultCatalog, pieceIsEmpty, sameValue, LEAVE_BLANK, type VaultPart } from "@/lib/grantCoach/answers";
import { readDocxText } from "@/lib/grantCoach/readDocx";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { loadMemory, remember, forget, shouldRemember, type MemoryRow } from "@/lib/grantCoach/memory";
import { isEdit, loadRules, addRules } from "@/lib/grantCoach/corrections";
import { overlapPercent, rewriteInstruction, siblingForWriter, TOO_CLOSE, type SiblingContext } from "@/lib/grantCoach/sibling";
import { learnFromEdit } from "@/lib/grantCoach/writer";

/** The kinds the database accepts (grant_checklist_items_kind_check). Anything else the reader says is saved as a plain field. */
const QUESTION_KINDS = new Set(["eligibility", "field", "narrative", "upload", "acknowledgment", "signature", "task", "choice"]);
const WRITERS_AT_ONCE = 3;
/** Pastes that land within this window are read together, so screens stay in one batch. */
const PASTE_GATHER_MS = 1200;

export interface AppItem {
  id: string; folder_id: string; section: string; label: string; detail: string | null; kind: string; required: boolean;
  status: "todo" | "in_progress" | "done" | "na"; answer: string | null; sort_order: number;
  limit_kind?: "words" | "characters" | null; limit_value?: number | null; source_path?: string | null; pasted_at?: string | null;
  attachment_id?: string | null; vault_key?: string | null; vault_part?: string | null; answer_source?: "vault" | "coach" | "you" | "portal" | "memory" | null; memory_id?: string | null; needs_case?: boolean; story_id?: string | null; score_note?: string | null; updated_at?: string; left_out?: string[]; needs?: string | null;
  /** The sister application's row this one is rewritten from (2026-10-29). */
  rewrite_from?: string | null;
}

interface Props {
  folderId: string;
  folder: DraftFolder;
  items: AppItem[];
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  userId: string | null;
  onPrint: () => void;
  printing: boolean;
  confirm: (o: { title: string; body: string; confirmLabel: string; danger?: boolean; typeToConfirm?: string }) => Promise<boolean>;
  prompt: (a: PromptAsk) => Promise<Record<string, string> | null>;
  /** The case Josh locked in the strategy session; story questions wait for it. */
  caseBrief: CaseBrief | null;
  caseLockedAt: string | null;
  /** The reviewer's last read, and when. */
  review: Review | null;
  reviewedAt: string | null;
  /** What the funder's own documents say: every answer is written to it. */
  funderBrief: FunderBrief | null;
  /** Where the progress bar and the whole-application actions draw: the folder header (Josh, 2026-10-29). Unset, they sit above the screens. */
  actionsHost?: HTMLElement | null;
  /** Past Applying (submitted, awarded, closed): the application is a record — no next screen, the reviewer folded to its score. */
  submitted?: boolean;
  /** The sister application this folder was started from (2026-10-29): its answers are context for every rewrite, and what the sameness check reads against. */
  sibling?: SiblingContext | null;
}

/** Run jobs a few at a time. */
async function pool<T>(list: T[], n: number, job: (t: T) => Promise<void>) {
  const queue = [...list];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) await job(t);
  }));
}

const cleanName = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 60);
const sectionTitle = (s: string) => s.replace(/^Portal · /, "");

export default function GrantApplication({ folderId, folder, items, library, getFacts, userId, onPrint, printing, confirm, prompt, caseBrief, caseLockedAt, review, reviewedAt, funderBrief, actionsHost, submitted = false, sibling = null }: Props) {
  const caseLocked = !!caseBrief && !!caseLockedAt;
  const qc = useQueryClient();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["grant-items", folderId] }), [qc, folderId]);

  /* The Vault as saved, and which organization documents are on file — the exact sources for facts. */
  const { data: vault = {} } = useQuery({
    queryKey: ["grant-vault-raw"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value");
      if (error) throw error;
      return Object.fromEntries(((data ?? []) as { key: string; value: string | null }[]).map((r) => [r.key, r.value])) as Record<string, string | null>;
    },
  });
  const { data: docsOnFile = new Set<string>() } = useQuery({
    queryKey: ["grant-org-docs-on-file"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_documents" as never).select("key, storage_path, link_url");
      if (error) throw error;
      return new Set(((data ?? []) as { key: string; storage_path: string | null; link_url: string | null }[]).filter((d) => d.storage_path || d.link_url).map((d) => d.key));
    },
  });

  /* This folder's documents: what an "Upload" row can point at. */
  const { data: folderDocs = [] } = useQuery({
    queryKey: ["grant-docs", folderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_documents" as never).select("*").eq("folder_id", folderId).order("uploaded_at");
      if (error) throw error;
      return (data ?? []) as unknown as FolderDoc[];
    },
  });
  const docById = useMemo(() => new Map(folderDocs.map((d) => [d.id, d])), [folderDocs]);

  /* Every answer approved on a past grant (and this one): checked before anything is written. */
  const { data: memory = [] } = useQuery({ queryKey: ["grant-memory"], queryFn: loadMemory });
  const { data: stories = [] } = useQuery({ queryKey: ["grant-stories"], queryFn: loadStories });
  const storyTitle = useMemo(() => new Map(stories.map((s) => [s.id, s.title])), [stories]);
  const memoryById = useMemo(() => new Map(memory.map((m) => [m.id, m])), [memory]);
  const ctx = useMemo(() => ({ folderId, funder: folder.funder, userId }), [folderId, folder.funder, userId]);
  const remembered = useCallback(() => qc.invalidateQueries({ queryKey: ["grant-memory"] }), [qc]);
  /* Answers approved before the memory existed (or while it was unreachable) catch up once the page opens. */
  const { isSuccess: memoryLoaded } = useQuery({ queryKey: ["grant-memory"], queryFn: loadMemory });
  const caughtUp = useRef(false);
  useEffect(() => {
    if (caughtUp.current || !memoryLoaded || !items.length) return;
    caughtUp.current = true;
    const known = new Set(memory.map((m) => m.item_id));
    const missing = items.filter((i) => shouldRemember(i) && !known.has(i.id));
    if (!missing.length) return;
    void (async () => { for (const it of missing) await remember(it, ctx); remembered(); })();
  }, [memoryLoaded, items, memory, ctx, remembered]);

  const patch = useCallback(async (id: string, p: Partial<AppItem>) => {
    const { error } = await supabase.from("grant_checklist_items" as never).update({ ...p, updated_at: new Date().toISOString() } as never).eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  /* ───── The pipeline: read → match to the Vault → fill facts → write the rest ───── */
  const [stage, setStage] = useState<string | null>(null);
  const [writing, setWriting] = useState<Set<string>>(new Set());
  const busy = stage != null;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const answered = () => itemsRef.current.filter((i) => i.answer?.trim()).map((i) => ({ section: i.section, label: i.label, answer: i.answer!.trim() }));

  /** Write one question with the writer (optionally told what to change). */
  const writeOne = useCallback(async (it: AppItem, facts: Fact[], instruction?: string, past?: MemoryRow, useCase?: CaseBrief | null) => {
    setWriting((w) => new Set(w).add(it.id));
    try {
      // A past approved answer to the same question is the starting draft, adapted to this funder and limit.
      const fromPast = past
        ? `This question was answered and approved for ${past.funder ?? "an earlier grant"}. Keep what is true and strong; adapt it to this funder's question and limit; refresh any number from the live numbers.`
        : undefined;
      // The sister application's answer: context, never a template — same facts, new sentences (Josh, 2026-10-29).
      const twin = sibling && it.rewrite_from ? sibling.answers.get(it.rewrite_from)?.answer?.trim() : null;
      const fromTwin = twin ? rewriteInstruction(sibling!, folder.program_name, twin) : undefined;
      const res = await draftWithGrantCoach({
        mode: "item", folder, library, facts, answered: answered(), instruction: [fromPast, fromTwin, instruction].filter(Boolean).join("\n\n") || undefined,
        sibling: siblingForWriter(sibling),
        caseBrief: it.needs_case ? (useCase ?? caseBrief) : null,
        funderBrief,
        // Stories only where an answer tells NLA's story; never one already told in this application.
        stories: it.kind === "narrative" || it.needs_case ? usableStories(stories) : [],
        usedStoryIds: itemsRef.current.filter((x) => x.id !== it.id && x.story_id).map((x) => x.story_id!),
        item: { id: it.id, section: it.section, label: it.label, detail: it.detail, kind: it.kind, answer: past ? past.answer : instruction ? it.answer : null, limit_kind: it.limit_kind, limit_value: it.limit_value },
      });
      const answer = (res.answer ?? "").trim();
      await forget([it.id]);
      await patch(it.id, { answer, needs: res.needs ?? needsFrom(answer), answer_source: past ? "memory" : "coach", memory_id: past?.id ?? null, story_id: res.story_id ?? null, score_note: res.score_note ?? null, left_out: res.left_out ?? [], status: "in_progress", pasted_at: null });
    } finally {
      setWriting((w) => { const n = new Set(w); n.delete(it.id); return n; });
      refresh();
    }
  }, [folder, library, patch, refresh, caseBrief, stories, funderBrief, sibling]);

  /** Match rows to the Vault, fill what the Vault holds, and write everything else. */
  const answerRows = useCallback(async (rows: AppItem[]) => {
    if (!rows.length) return;
    // 1. Which Vault field (or document) each row wants — only for rows not matched yet.
    const unmatched = rows.filter((r) => !r.vault_key);
    let matches: Map<string, { vault_key: string | null; part: string | null; document_key: string | null; memory_id?: string | null; needs_case?: boolean }> = new Map();
    if (unmatched.length) {
      setStage("Matching the questions to your Grant Vault…");
      const got = await matchToVault(
        unmatched.map((r, i) => ({ i, screen: sectionTitle(r.section), text: r.label, help: r.detail ?? "", kind: r.kind })),
        vaultCatalog(),
        memory.filter((m) => m.folder_id !== folderId).map((m) => ({ id: m.id, question: m.question, funder: m.funder })),
      );
      matches = new Map(got.map((m) => [unmatched[m.i]?.id, m]).filter(([id]) => !!id) as [string, typeof got[number]][]);
    }
    // 2. Facts, filled exactly. Attachments matched to the documents on file.
    setStage("Filling the facts from your Grant Vault…");
    const toWrite: { row: AppItem; past?: MemoryRow }[] = [];
    let filledVault = 0;
    let reused = 0;
    for (const r of rows) {
      const m = matches.get(r.id);
      const key = r.vault_key ?? (m?.document_key ? `doc:${m.document_key}` : m?.vault_key ?? null);
      const part = (r.vault_part ?? m?.part ?? null) as VaultPart | null;
      if (r.answer_source === "portal" && r.answer?.trim()) {
        // Already typed into the portal: keep it. A gap in the Vault is filled from it;
        // a difference is shown, never overwritten.
        if (key && !key.startsWith("doc:") && !part) {
          const inVault = vaultAnswer(key, null, vault);
          if (!inVault) {
            const { error } = await supabase.from("grant_org_fields" as never).upsert({ key, value: r.answer.trim(), updated_at: new Date().toISOString(), updated_by: userId } as never, { onConflict: "key" } as never);
            if (!error) filledVault += 1;
            await patch(r.id, { vault_key: key, vault_part: null, needs: null });
          } else if (!sameValue(inVault, r.answer)) {
            await patch(r.id, { vault_key: key, vault_part: null, needs: `Your Vault says "${inVault}". Save the portal's answer to the Vault if it's the new one.` });
          } else {
            await patch(r.id, { vault_key: key, vault_part: null, needs: null });
          }
        } else if (key) {
          await patch(r.id, { vault_key: key, vault_part: part });
        }
        continue;
      }
      if (key?.startsWith("doc:")) {
        const d = documentAnswer(key.slice(4), docsOnFile);
        await patch(r.id, { vault_key: key, answer: d.answer, needs: d.needs, answer_source: "vault", status: d.answer ? "in_progress" : "todo" });
      } else if (key) {
        const value = vaultAnswer(key, part, vault) ?? (pieceIsEmpty(key, part, vault) ? LEAVE_BLANK : null);
        const label = ORG_FIELDS.find((f) => f.key === key)?.label ?? key;
        await patch(r.id, value
          ? { vault_key: key, vault_part: part, answer: value, needs: null, answer_source: "vault", status: "in_progress" }
          : { vault_key: key, vault_part: part, answer: null, needs: `Not in your Grant Vault yet (${label}). Type it below; it saves to the Vault for every grant after this.`, answer_source: "vault", status: "todo" });
      } else {
        const needsCase = !!r.needs_case || m?.needs_case === true;
        const past = m?.memory_id && !(sibling && r.rewrite_from && !isFactRow(r)) ? memoryById.get(m.memory_id) : undefined;
        if (needsCase && !caseLocked) {
          // A story question: it waits for the strategy session, and nothing is written yet.
          await patch(r.id, { needs_case: true, status: "todo", needs: null });
          continue;
        }
        if (needsCase && !r.needs_case) await patch(r.id, { needs_case: true });
        if (past && isFactRow(r) && !needsCase) {
          // A short answer approved before is used as is.
          await patch(r.id, { answer: past.answer, needs: null, answer_source: "memory", memory_id: past.id, status: "in_progress" });
          reused += 1;
        } else {
          if (past) reused += 1;
          toWrite.push({ row: { ...r, needs_case: needsCase }, past });
        }
      }
    }
    if (reused) toast.success(`${reused} answer${reused === 1 ? "" : "s"} from past grants reused.`);
    if (filledVault) {
      qc.invalidateQueries({ queryKey: ["grant-vault-raw"] });
      qc.invalidateQueries({ queryKey: ["grant-library"] });
      toast.success(`${filledVault} new fact${filledVault === 1 ? "" : "s"} from the portal saved to your Grant Vault.`);
    }
    refresh();
    // 3. Everything else, written — a few at a time, each card fills as it lands.
    if (toWrite.length) {
      setStage(`Writing ${toWrite.length} answer${toWrite.length === 1 ? "" : "s"}…`);
      const facts = await getFacts();
      let failed = 0;
      await pool(toWrite, WRITERS_AT_ONCE, async ({ row, past }) => { try { await writeOne(row, facts, undefined, past); } catch { failed += 1; } });
      if (failed) toast.error(`${failed} answer${failed === 1 ? "" : "s"} didn't come back. Use "Answer the rest" to try again.`);
    }
  }, [docsOnFile, vault, patch, refresh, getFacts, writeOne, qc, userId, memory, memoryById, folderId, caseLocked, sibling]);

  /** Everything that came in from the tile: files and/or text. */
  /** A read that found nothing, or failed: it stays in the tile until it is tried again or dismissed. */
  const [problem, setProblem] = useState<{ message: string; paths: string[]; text: string } | null>(null);

  /** Read questions off what is already uploaded (or text), add the new ones, and answer them. */
  const readAndAnswer = useCallback(async (paths: string[], allText: string) => {
    setProblem(null);
    try {
      setStage("Reading the application…");
      const { questions, note } = await readApplication({ paths, text: allText });
      if (!questions.length) {
        setProblem({ message: `Grant Coach found no questions on ${paths.length === 1 ? "that screen" : "those screens"}.${note ? ` It saw: ${note}` : ""}`, paths, text: allText });
        return;
      }
      // A screen pasted twice adds nothing twice.
      // Same screen, same question = already here, whatever the help text under it says.
      const have = new Set(itemsRef.current.map((i) => `${sectionTitle(i.section)}|${questionKey(i.label)}`.toLowerCase()));
      const fresh = questions.filter((q) => !have.has(`${q.screen || "Application"}|${questionKey(q.text)}`.toLowerCase()));
      const skipped = questions.length - fresh.length;
      if (!fresh.length) { toast(`Those ${questions.length} questions are already in the application.`); return; }
      const base = itemsRef.current.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1;
      const { data: inserted, error } = await supabase.from("grant_checklist_items" as never).insert(fresh.map((q, i) => ({
        folder_id: folderId, section: `Portal · ${q.screen || "Application"}`, label: q.text, detail: q.help || null,
        kind: QUESTION_KINDS.has(q.kind) ? q.kind : "field", required: q.required !== false, sort_order: base + i, owner: null,
        ...(q.typed?.trim()
          ? { answer: q.typed.trim(), answer_source: "portal", status: "done", pasted_at: new Date().toISOString() }
          : { answer: null, status: "todo" }),
        limit_kind: q.limit_kind ?? null, limit_value: q.limit_value ?? null,
        source_path: paths.length ? paths[Math.min(paths.length - 1, Math.floor((i / fresh.length) * paths.length))] : null,
      })) as never).select("*");
      if (error) throw new Error(error.message);
      refresh();
      const added = (inserted ?? []) as unknown as AppItem[];
      for (const it of added) if (it.answer_source === "portal") await remember(it, ctx);
      remembered();
      await answerRows(added);
      toast.success(`${fresh.length} question${fresh.length === 1 ? "" : "s"} answered${skipped ? ` (${skipped} already in the application, skipped)` : ""}. Approve what's right; reject what isn't.`);
    } catch (e) {
      setProblem({ message: `Grant Coach couldn't read ${paths.length === 1 ? "that screen" : "those screens"}: ${(e as Error).message}`, paths, text: allText });
    } finally {
      setStage(null);
      refresh();
    }
  }, [folderId, refresh, answerRows, ctx, remembered]);

  const ingest = useCallback(async (files: File[], text: string) => {
    if (!files.length && !text.trim()) return;
    const paths: string[] = [];
    let allText = text.trim();
    try {
      // Word files become text; screenshots and PDFs go to storage for the reader.
      setStage("Uploading…");
      for (const [n, file] of files.entries()) {
        if (/\.docx$/i.test(file.name) || file.type.includes("wordprocessingml")) {
          allText += `${allText ? "\n\n" : ""}${await readDocxText(file)}`;
          continue;
        }
        const path = `grants/${folderId}/screens/${Date.now()}_${n}_${cleanName(file.name)}`;
        const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error(error.message);
        paths.push(path);
        await supabase.from("grant_documents" as never).insert({
          folder_id: folderId, side: "funder", title: `Application: ${file.name.replace(/\.[^.]+$/, "")}`, storage_path: path, file_name: file.name,
          mime_type: file.type || null, size_bytes: file.size, uploaded_by: userId,
        } as never);
      }
      qc.invalidateQueries({ queryKey: ["grant-docs", folderId] });
    } catch (e) {
      setStage(null);
      setProblem({ message: `Couldn't upload: ${(e as Error).message}`, paths: [], text: "" });
      return;
    }
    await readAndAnswer(paths, allText);
  }, [folderId, userId, qc, readAndAnswer]);

  /* ───── The tile: paste anywhere, drop, or choose files ───── */
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /* One click arms the tile for a paste (Ctrl+V works anywhere on the page, but
     the tile says so and lights up); a double click opens the file picker. */
  const [armed, setArmed] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const [gathered, setGathered] = useState(0);
  const pending = useRef<{ files: File[]; text: string }>({ files: [], text: "" });
  const timer = useRef<number | null>(null);
  const running = useRef<Promise<void>>(Promise.resolve());
  const ingestRef = useRef(ingest);
  ingestRef.current = ingest;

  /** Collect what arrives within a moment of each other, then read it as one batch (in order). */
  const gather = useCallback((files: File[], text: string) => {
    pending.current.files.push(...files);
    if (text) pending.current.text += `${pending.current.text ? "\n\n" : ""}${text}`;
    setGathered(pending.current.files.length + (pending.current.text ? 1 : 0));
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const batch = pending.current;
      pending.current = { files: [], text: "" };
      setGathered(0);
      running.current = running.current.then(() => ingestRef.current(batch.files, batch.text));
    }, PASTE_GATHER_MS);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Only a paste into the tile counts (click it first). A screenshot pasted
      // anywhere else on the page — one taken of Grant Coach itself to share — is ignored.
      if (!tileRef.current || document.activeElement !== tileRef.current) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (files.length) {
        e.preventDefault();
        const stamp = Date.now();
        gather(files.map((f, i) => new File([f], `screen-${stamp}-${i + 1}.${f.type.split("/")[1] || "png"}`, { type: f.type })), "");
        return;
      }
      // Text pasted into the tile is the application's questions.
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text && text.length > 15) { e.preventDefault(); gather([], text); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [gather]);

  const takeFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => /^image\//.test(f.type) || f.type === "application/pdf" || /\.docx$/i.test(f.name) || f.type.includes("wordprocessingml"));
    if (!files.length) { toast.error("Screenshots, PDFs or Word files only."); return; }
    gather(files.slice(0, 20), "");
  };

  /* ───── Decisions ───── */
  const approve = async (it: AppItem) => { await patch(it.id, { status: "done" }); await remember({ ...it, status: "done" }, ctx); remembered(); refresh(); };
  const unapprove = async (it: AppItem) => { await patch(it.id, { status: "in_progress", pasted_at: null }); await forget([it.id]); remembered(); refresh(); };
  const copy = async (text: string, what = "Copied") => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what}. Paste it into the portal.`); } catch { toast.error("Couldn't copy. Select the text and copy it by hand."); }
  };
  const removeRow = async (it: AppItem) => {
    const { error } = await supabase.from("grant_checklist_items" as never).delete().eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    refresh();
    toast(`Removed "${it.label.slice(0, 50)}"`, {
      action: { label: "Undo", onClick: async () => { await supabase.from("grant_checklist_items" as never).insert(it as never); refresh(); } },
    });
  };

  /** A whole card off at once (a misread or wrong screenshot), with an undo. */
  const removeRows = async (rows: AppItem[], what: string) => {
    const { error } = await supabase.from("grant_checklist_items" as never).delete().in("id", rows.map((r) => r.id));
    if (error) { toast.error(error.message); return; }
    refresh();
    toast(`Removed ${rows.length} question${rows.length === 1 ? "" : "s"} from ${what}`, {
      action: { label: "Undo", onClick: async () => { await supabase.from("grant_checklist_items" as never).insert(rows as never); refresh(); } },
    });
  };

  const live = items.filter((i) => i.status !== "na");
  const numberOf = new Map(live.map((r, i) => [r.id, i + 1]));
  const approvedCount = live.filter((i) => i.status === "done").length;
  const readyFacts = live.filter((i) => isFactRow(i) && i.status === "in_progress" && i.answer?.trim() && !i.needs);
  const waiting = live.filter((i) => !i.answer?.trim() && !writing.has(i.id) && !(i.vault_key && i.needs) && !(i.needs_case && !caseLocked));

  const needYou = live.filter((i) => i.needs);

  const approveAllFacts = async () => {
    for (const it of readyFacts) { await patch(it.id, { status: "done" }); await remember({ ...it, status: "done" }, ctx); }
    remembered();
    refresh();
    toast.success(`${readyFacts.length} fact${readyFacts.length === 1 ? "" : "s"} approved.`);
  };
  const answerTheRest = async () => {
    try { await answerRows(waiting); } catch (e) { toast.error(`Grant Coach: ${(e as Error).message}`); } finally { setStage(null); refresh(); }
  };
  /* A folder just started from its sister lands with its written answers empty: Grant Coach starts on them
     by itself, once, so Josh arrives to drafts landing — not to a button (2026-10-29). */
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !sibling || busy || !items.length) return;
    const fresh = items.filter((i) => i.rewrite_from && !i.answer?.trim() && i.kind !== "upload" && i.status === "todo");
    const begun = items.some((i) => i.answer_source === "coach");
    autoStarted.current = true;
    if (!fresh.length || begun) return;
    void (async () => {
      try { await answerRows(waiting); } catch (e) { toast.error(`Grant Coach: ${(e as Error).message}`); } finally { setStage(null); refresh(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the folder's rows first arrive
  }, [sibling, items, busy]);
  const startOver = async () => {
    if (!(await confirm({ title: "Start over?", body: `Every one of the ${live.length} questions and answers in this application comes off, approved or not. The Grant Vault, the documents and the screenshots stay. This cannot be undone.`, confirmLabel: "Clear the application", danger: true, typeToConfirm: "DELETE" }))) return;
    const { error } = await supabase.from("grant_checklist_items" as never).delete().eq("folder_id", folderId);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  /* Sections in portal order. The portal's "Program Narrative" screen is one upload slot;
     Grant Coach writes it as seven items (NARRATIVE_SECTION) and builds the file — so that
     screen and the seven items are ONE card, and the slot itself is not a question (Josh,
     2026-10-28: "there's an 8 on the card and only 7 questions"). */
  const sections = useMemo(() => {
    const out: { name: string; rows: AppItem[] }[] = [];
    const isNarrative = (s: string) => s === NARRATIVE_SECTION || /program narrative/i.test(sectionTitle(s));
    for (const it of items) {
      if (isNarrative(it.section) && it.kind === "upload") continue;
      const name = isNarrative(it.section) ? NARRATIVE_SECTION : it.section;
      const last = out[out.length - 1];
      if (last && last.name === name) last.rows.push(it); else out.push({ name, rows: [it] });
    }
    return out;
  }, [items]);

  const [viewOpen, setViewOpen] = useState(false);
  const applicationText = () =>
    sections.map((s) => `${sectionTitle(s.name).toUpperCase()}\n\n` + s.rows.filter((r) => r.status !== "na").map((r) => `${r.label}\n${r.answer?.trim() || "(not answered)"}`).join("\n\n")).join("\n\n\n");

  const empty = items.length === 0;

  const [focusId, setFocusId] = useState<string | null>(null);
  /** The question whose box is open (Answer, Jump, or "Approve and next"). */
  const [openId, setOpenId] = useState<string | null>(null);

  /** Josh changed Grant Coach's answer: there is a reason. Learn the lesson in the background; it never blocks him. */
  const learnFrom = (question: string, before: string, after: string) => {
    void (async () => {
      try {
        const rules = await learnFromEdit({ question, before, after, rules: await loadRules() });
        const added = rules.length ? await addRules(rules, userId) : [];
        if (added.length) {
          qc.invalidateQueries({ queryKey: ["grant-library"] });
          toast.success(`Grant Coach learned from your edit: ${added.join(" · ")}`, { description: "Saved to Josh's corrections in the Grant Vault. Every draft follows it.", duration: 9000 });
        }
      } catch { /* learning is a bonus; the answer is already saved */ }
    })();
  };

  /** Approve this answer, then open the next question that still needs one — top to bottom. */
  const approveAndNext = async (r: AppItem, answer: string, source: "coach" | "you", storyId: string | null, before: string | null) => {
    await patch(r.id, { answer, status: "done", left_out: [], answer_source: source, story_id: storyId ?? r.story_id ?? null, needs: null, score_note: source === "you" ? null : r.score_note, pasted_at: null });
    const edited = isEdit(before, answer);
    await remember({ ...r, answer, status: "done", answer_source: source }, ctx, edited ? before : null);
    if (edited) learnFrom(r.label, before!, answer);
    remembered();
    refresh();
    const order = itemsRef.current.filter((i) => i.status !== "na");
    const at = order.findIndex((i) => i.id === r.id);
    const next = [...order.slice(at + 1), ...order.slice(0, at)].find((i) => i.id !== r.id && i.status !== "done");
    if (!next) { setOpenId(null); toast.success("That was the last open question. Run the reviewer at the bottom when you're ready."); return; }
    setOpenId(next.id);
    window.setTimeout(() => document.getElementById(`q-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };
  /** Other questions on the screen that Grant Coach filled because Josh asked: drafts, not approvals. */
  const fillOthers = async (fills: { id: string; answer: string }[]) => {
    for (const f of fills) await patch(f.id, { answer: f.answer, answer_source: "coach", status: "in_progress", needs: null, pasted_at: null });
    await forget(fills.map((f) => f.id));
    refresh();
  };
  /* The reviewer's Fix it: the rewrite is a draft card in the question's
     conversation, never the answer itself. Josh reads it there and clicks
     "Use this", or asks for something else. */
  const openQuestion = (it: AppItem) => {
    setOpenId(it.id);
    setFocusId(it.id);
    window.setTimeout(() => { document.getElementById(`q-${it.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setFocusId((f) => (f === it.id ? null : f)); }, 300);
  };
  const sayOn = (it: AppItem) => async (role: "user" | "coach", content: string, payload: Record<string, unknown> | null = null) => {
    const { error } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: it.id, role, content, payload, created_by: userId } as never);
    if (error) throw new Error(error.message);
    qc.invalidateQueries({ queryKey: ["grant-chat", it.id] });
  };
  /** A finished draft (from the reviewer's conversation) lands on the question as a draft card, and the question opens. */
  const postDraft = async (it: AppItem, note: string, text: string, words: number) => {
    const say = sayOn(it);
    await say("user", note);
    await say("coach", "Here is the rewrite from the reviewer's conversation. Use it, or tell me what to change.", { draft: text, draft_story_id: null, draft_words: words });
    openQuestion(it);
  };
  const fixInChat = async (it: AppItem, w: { problem: string; fix: string; instruction: string }) => {
    openQuestion(it);
    const say = sayOn(it);
    setWriting((w2) => new Set(w2).add(it.id));
    try {
      await say("user", `The reviewer: ${w.problem}\n\nFix: ${w.fix}`);
      const res = await draftWithGrantCoach({
        mode: "item", folder, library, facts: await getFacts(), answered: answered(), instruction: w.instruction || w.fix,
        sibling: siblingForWriter(sibling),
        caseBrief: it.needs_case ? caseBrief : null, funderBrief,
        stories: it.kind === "narrative" || it.needs_case ? usableStories(stories) : [],
        usedStoryIds: itemsRef.current.filter((x) => x.id !== it.id && x.story_id).map((x) => x.story_id!),
        item: { id: it.id, section: it.section, label: it.label, detail: it.detail, kind: it.kind, answer: it.answer, limit_kind: it.limit_kind, limit_value: it.limit_value },
      });
      const answer = (res.answer ?? "").trim();
      if (!answer) throw new Error("Grant Coach came back with nothing.");
      const left = res.left_out ?? [];
      const reply = (res.reply ?? "Here is the rewrite the reviewer asked for. Use it, or tell me what to change.") + (left.length ? `\n\nLeft out: ${left.join("; ")}` : "");
      await say("coach", reply, { draft: answer, draft_story_id: res.story_id ?? null, draft_words: res.words });
    } finally {
      setWriting((w2) => { const n = new Set(w2); n.delete(it.id); return n; });
    }
  };

  const jumpTo = (id: string) => {
    const it = items.find((i) => i.id === id);
    const target = document.getElementById(`q-${id}`);
    setFocusId(id);
    if (it && it.status !== "done") setOpenId(id);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFocusId((f) => (f === id ? null : f)), 2600);
  };

  const problemEl = (
    <>
    {problem && !busy && (
      <div className="rounded-xl border border-amber-400/40 bg-amber-400/[0.07] p-4 flex flex-wrap items-center gap-3">
        <AlertCircle className="w-5 h-5 text-amber-300 shrink-0" />
        <p className="flex-1 min-w-[220px] text-sm text-amber-100">{problem.message}</p>
        {(problem.paths.length > 0 || problem.text) && (
          <Button size="sm" onClick={() => void readAndAnswer(problem.paths, problem.text)} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><RefreshCw className="w-4 h-4 mr-1.5" /> Try again</Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setProblem(null)} className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Dismiss</Button>
      </div>
    )}
    </>
  );
  const tileEl = (
    <>
    {/* ── The tile ── */}
    <GcCard
      icon={<Upload className="w-4 h-4" />}
      title={empty ? "Upload Grant Questions Here" : "Upload the Next Screen Here"}
      blurb="Screenshots of the funder's portal, a PDF, or a Word file"
    >
    <div className="p-3">
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); takeFiles(e.dataTransfer.files); }}
      onClick={(e) => { if (!busy) { setArmed(true); (e.currentTarget as HTMLDivElement).focus(); } }}
      onDoubleClick={() => { if (!busy) { setArmed(false); fileInput.current?.click(); } }}
      onBlur={() => setArmed(false)}
      // Back from taking a screenshot in another window, the tile still has focus: it is armed again.
      onFocus={() => { if (!busy) setArmed(true); }}
      ref={tileRef}
      role="button"
      tabIndex={0}
      aria-label="Upload grant questions: click, then paste; double-click to choose a file"
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) fileInput.current?.click(); }}
      className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center outline-none ${dragging || armed ? "bg-sky-400/[0.06]" : "border-white/15 hover:border-sky-400/40 bg-black/30"} ${empty ? "px-6 py-12" : "px-5 py-5"}`}
      style={dragging || armed ? { borderColor: GC_BLUE } : undefined}
    >
      <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,.pdf,.docx" className="hidden" onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
      {busy ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: GC_BLUE }} />
          <p className="font-semibold">{stage}</p>
          <p className="text-[12px] text-white/45">Answers appear below as they land. You can keep pasting the next screens.</p>
        </div>
      ) : gathered > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-white/60" />
          <p className="font-semibold">{gathered} screen{gathered === 1 ? "" : "s"} in. Paste the next one, or wait a moment.</p>
        </div>
      ) : armed ? (
        <div className="flex flex-col items-center gap-2">
          <Upload className={`${empty ? "w-10 h-10" : "w-6 h-6"}`} style={{ color: GC_BLUE }} />
          <p className={`${empty ? "text-xl" : "text-base"} font-bold`} style={{ color: GC_BLUE }}>Ready. Press Ctrl+V to paste.</p>
          <p className="text-[13px] text-white/55">Or double-click to choose a file from your computer.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className={`${empty ? "w-10 h-10" : "w-6 h-6"} text-white/60`} />
          <p className={`${empty ? "text-xl" : "text-base"} font-bold`}>Click here, then press <span style={{ color: GC_BLUE }}>Ctrl+V</span></p>
          <p className="text-[13px] text-white/55 max-w-lg">
            Double-click to choose a file, or drop one here. Grant Coach reads every question and answers it.
          </p>
        </div>
      )}
    </div>
    </div>
    </GcCard>
    </>
  );

  return (
    <div className="space-y-4">
      {empty && <>{problemEl}{tileEl}</>}

      {!empty && (
        <>
          {/* ── Where it stands, and the few things to do with the whole application.
                Drawn in the folder header when it offers a place (Josh, 2026-10-29: "put it in the same section above"). ── */}
          {(() => { const bar = (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold">{approvedCount} of {live.length} approved</p>
                <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${live.length ? Math.round((approvedCount / live.length) * 100) : 0}%` }} />
                </div>
                {needYou.length > 0 && <p className="mt-1.5 text-[12px] text-amber-300">{needYou.length} need{needYou.length === 1 ? "s" : ""} you</p>}
              </div>
              {readyFacts.length > 0 && (
                <Button size="sm" onClick={() => void approveAllFacts()} disabled={busy} className="bg-emerald-700 hover:bg-emerald-600 text-white">
                  <Check className="w-4 h-4 mr-1.5" /> Approve all {readyFacts.length} facts
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setViewOpen(true)} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white">
                <Eye className="w-4 h-4 mr-1.5" /> View application
              </Button>
              <Button size="sm" variant="outline" onClick={onPrint} disabled={printing} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white">
                {printing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Printer className="w-4 h-4 mr-1.5" />} Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white px-2" aria-label="More"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-neutral-900 border-white/[0.08] text-white">
                  <DropdownMenuItem disabled={busy || !waiting.length} onSelect={() => void answerTheRest()} className="focus:bg-white/10 focus:text-white">
                    <Sparkles className="w-4 h-4 mr-2" /> Answer the rest{waiting.length ? ` (${waiting.length})` : ""}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void copy(applicationText(), "The whole application is copied")} className="focus:bg-white/10 focus:text-white">
                    <Copy className="w-4 h-4 mr-2" /> Copy the whole application
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem disabled={busy} onSelect={() => void startOver()} className="text-red-300 focus:bg-red-500/15 focus:text-red-200">
                    <Trash2 className="w-4 h-4 mr-2" /> Start over
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {waiting.length > 0 && !busy && (
              <button type="button" onClick={() => void answerTheRest()} className="w-full rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] px-3 py-2 text-left text-sm inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-white/60" /> {waiting.length} question{waiting.length === 1 ? " has" : "s have"} no answer yet. <span className="font-semibold underline underline-offset-2">Answer {waiting.length === 1 ? "it" : "them"} now</span>
              </button>
            )}
          </div>
          ); return actionsHost ? createPortal(bar, actionsHost) : (
            <div className="sticky top-2 z-30 rounded-2xl border border-white/15 bg-[#141416]/95 backdrop-blur shadow-[0_0.3em_1.2em_rgba(0,0,0,0.55)] px-4 py-3" style={{ borderTop: `3px solid ${GC_BLUE}` }}>{bar}</div>
          ); })()}

          {/* ── The questions, in portal order, newest screen last ── */}
          {sections.map((s) => {
            const rows = s.rows.filter((r) => r.status !== "na");
            const done = rows.filter((r) => r.status === "done").length;
            const all = rows.length > 0 && done === rows.length;
            // The Program Narrative is one screen like the others, in the portal's order
            // (Josh, 2026-10-28): its tools and word count live in this card's own header.
            const narrative = s.name === NARRATIVE_SECTION;
            return (
            <GcCard
              key={s.name}
              icon={<FileQuestion className="w-4 h-4" />}
              title={narrative ? "Program Narrative · one upload" : sectionTitle(s.name)}
              blurb={narrative ? <NarrativeBlurb items={items} /> : `${rows.length} question${rows.length === 1 ? "" : "s"} · ${done} approved`}
              right={
                <>
                  {narrative && <NarrativeTools folder={folder} items={items} library={library} getFacts={getFacts} funderBrief={funderBrief} caseBrief={caseBrief} prompt={prompt} onChanged={refresh} sibling={sibling} />}
                  {all && <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300"><Check className="w-4 h-4" /> All approved</span>}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10" aria-label={`More for ${sectionTitle(s.name)}`}><MoreHorizontal className="w-4 h-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-neutral-900 border-white/[0.08] text-white">
                      <DropdownMenuItem disabled={busy} onSelect={() => void removeRows(s.rows, sectionTitle(s.name))} className="text-red-300 focus:bg-red-500/15 focus:text-red-200">
                        <Trash2 className="w-4 h-4 mr-2" /> Remove these {rows.length} questions
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            >
              <div className="divide-y divide-white/[0.06]">
                {rows.map((r) => (
                  <QuestionRow
                    key={r.id}
                    item={r}
                    number={numberOf.get(r.id)}
                    pastFunder={r.memory_id ? memoryById.get(r.memory_id)?.funder ?? null : null}
                    twin={(() => {
                      const prev = sibling && r.rewrite_from ? sibling.answers.get(r.rewrite_from)?.answer?.trim() : null;
                      return prev ? { program: sibling!.program, pct: overlapPercent(r.answer, prev) } : null;
                    })()}
                    focused={focusId === r.id}
                    forceOpen={openId === r.id}
                    onClosed={() => setOpenId((o) => (o === r.id ? null : o))}
                    onApproveNext={(answer, source, storyId, before) => approveAndNext(r, answer, source, storyId, before)}
                    renderChat={(draft, fill) => (
                      <QuestionChat
                        folderId={folderId}
                        item={r}
                        draft={draft}
                        siblings={rows.filter((x) => x.id !== r.id)}
                        sibling={sibling}
                        folder={folder}
                        library={library}
                        getFacts={getFacts}
                        answered={answered}
                        funderBrief={funderBrief}
                        stories={usableStories(stories)}
                        usedStoryIds={items.filter((x) => x.id !== r.id && x.story_id).map((x) => x.story_id!)}
                        userId={userId}
                        onAnswer={fill}
                        onFills={fillOthers}
                        onStartOver={async () => {
                          await patch(r.id, { answer: null, status: "todo", answer_source: null, story_id: null, score_note: null, left_out: [], needs: null, pasted_at: null });
                          await forget([r.id]);
                          remembered();
                          refresh();
                          fill("", null);
                        }}
                      />
                    )}
                    storyTitle={r.story_id ? storyTitle.get(r.story_id) ?? null : null}
                    writing={writing.has(r.id)}
                    busy={busy}
                    onApprove={() => void approve(r)}
                    onUnapprove={() => void unapprove(r)}
                    onCopy={() => void copy(r.answer ?? "")}
                    onRemove={() => void removeRow(r)}
                    folderId={folderId}
                    userId={userId}
                    folderDocs={folderDocs}
                    attachment={r.attachment_id ? docById.get(r.attachment_id) ?? null : null}
                    onAttach={async (doc) => {
                      // The file is the answer: attached is approved.
                      await patch(r.id, { attachment_id: doc.id, answer: attachedAnswer(doc), status: "done", answer_source: "you", needs: null, pasted_at: null, score_note: null, left_out: [] });
                      qc.invalidateQueries({ queryKey: ["grant-docs", folderId] });
                      refresh();
                      toast.success(`${doc.file_name ?? doc.title} attached.`);
                      // Grant Coach reads it now, so the writer and the reviewer see what is in it.
                      if (!doc.read_text?.trim() && doc.storage_path) {
                        toast("Grant Coach is reading it…");
                        readAttachment(doc)
                          .then(() => { qc.invalidateQueries({ queryKey: ["grant-docs", folderId] }); toast.success(`Read. The writer and the reviewer now see what ${doc.file_name ?? doc.title} says.`); })
                          .catch((e) => toast.error(`Couldn't read ${doc.file_name ?? doc.title}: ${(e as Error).message}`));
                      }
                    }}
                    onClear={async () => {
                      const upload = r.kind === "upload";
                      if (!(await confirm(upload
                        ? { title: "Detach this file?", body: "The row goes back to open. The file stays in this folder's documents.", confirmLabel: "Detach", danger: true }
                        : { title: "Clear this answer?", body: "The answer comes out of the box and the question goes back to open. The Grant Vault is unchanged.", confirmLabel: "Clear it", danger: true }))) return;
                      await forget([r.id]);
                      remembered();
                      await patch(r.id, { answer: null, status: "in_progress", pasted_at: null, answer_source: null, score_note: null, left_out: [], ...(upload ? { attachment_id: null } : {}) });
                      refresh();
                    }}
                    onSave={async (answer, toVault) => {
                      // Saved over Grant Coach's own answer: learn from the change now, before its draft is gone.
                      if ((r.answer_source === "coach" || r.answer_source === "memory") && isEdit(r.answer, answer)) learnFrom(r.label, r.answer!, answer);
                      const vaultable = !!r.vault_key && !r.vault_key.startsWith("doc:") && !r.vault_part;
                      if (toVault && vaultable) {
                        const { error } = await supabase.from("grant_org_fields" as never).upsert({ key: r.vault_key, value: answer, updated_at: new Date().toISOString(), updated_by: userId } as never, { onConflict: "key" } as never);
                        if (error) { toast.error(`Couldn't save to the Vault: ${error.message}`); return; }
                        qc.invalidateQueries({ queryKey: ["grant-vault-raw"] });
                        qc.invalidateQueries({ queryKey: ["grant-library"] });
                      }
                      // A portal answer saved to the Vault stays what it is: approved, in the portal.
                      if (r.answer_source === "portal" && answer === r.answer?.trim()) {
                        await patch(r.id, { needs: null });
                        toast.success("Saved to the Grant Vault. Every grant from now on uses it.");
                        refresh();
                        return;
                      }
                      // Saved to the Vault, the answer is the Vault's again; saved for this grant only, it is yours.
                      await forget([r.id]);
                      remembered();
                      await patch(r.id, { answer, needs: null, score_note: null, answer_source: toVault && vaultable ? "vault" : "you", status: "in_progress", pasted_at: null });
                      toast.success(toVault && vaultable ? "Saved to the Grant Vault. Every grant from now on uses it." : "Saved for this grant. The Grant Vault is unchanged.");
                      refresh();
                    }}
                    onRegenerate={async (instruction) => {
                      if (r.needs_case && !caseLocked && !instruction) { setOpenId(r.id); return; }
                      try { await writeOne(r, await getFacts(), instruction || undefined); } catch (e) { toast.error(`Grant Coach: ${(e as Error).message}`); }
                    }}
                  />
                ))}
              </div>
            </GcCard>
            );
          })}

          {/* ── The next screen goes in right where you are working — until the grant is submitted ── */}
          {!submitted && problemEl}
          {!submitted && tileEl}

          {/* ── Before you submit: the reviewer ── */}
          <GrantReviewer
            onPrint={onPrint}
            printing={printing}
            folderId={folderId}
            folder={folder}
            items={items}
            library={library}
            getFacts={getFacts}
            caseBrief={caseBrief}
            review={review}
            reviewedAt={reviewedAt}
            funderBrief={funderBrief}
            lastChange={items.reduce<string | null>((m, i) => (i.updated_at && (!m || i.updated_at > m) ? i.updated_at : m), null)}
            busy={busy}
            onJump={jumpTo}
            onFix={async (it, w) => { try { await fixInChat(it, w); } catch (e) { toast.error(`Grant Coach: ${(e as Error).message}`); } }}
            userId={userId}
            onDraftToQuestion={postDraft}
            submitted={submitted}
            sibling={sibling}
          />
        </>
      )}

      {/* ── The whole application, as the funder will see it ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">{folder.name}</DialogTitle>
            <p className="text-[12px] text-white/50">{folder.funder} · {approvedCount} of {live.length} approved</p>
          </DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void copy(applicationText(), "The whole application is copied")} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Copy className="w-4 h-4 mr-1.5" /> Copy all</Button>
            <Button size="sm" variant="outline" onClick={onPrint} disabled={printing} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white"><Printer className="w-4 h-4 mr-1.5" /> Print</Button>
          </div>
          <div className="overflow-y-auto pr-1 space-y-6 mt-2">
            {sections.map((s) => (
              <div key={s.name}>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45 mb-2">{sectionTitle(s.name)}</p>
                <div className="space-y-4">
                  {s.rows.filter((r) => r.status !== "na").map((r) => (
                    <div key={r.id}>
                      <p className="text-sm font-semibold text-white/90"><span className="tabular-nums text-[11px] font-normal text-white/35 mr-1.5">{numberOf.get(r.id)}</span>{r.label}{r.status === "done" && <Check className="inline w-3.5 h-3.5 ml-1.5 text-emerald-400" />}</p>
                      <p className={`text-sm whitespace-pre-wrap mt-0.5 ${r.answer?.trim() ? "text-white/75" : "text-amber-300/80 italic"}`}><NeedMarks text={r.answer?.trim() || "Not answered yet."} /></p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───── One question ───── */
function QuestionRow({ item, number, pastFunder, twin, storyTitle, focused, forceOpen, onClosed, onApproveNext, renderChat, writing, busy, onApprove, onUnapprove, onCopy, onRemove, onSave, onRegenerate, onClear, folderId, userId, folderDocs, attachment, onAttach }: {
  item: AppItem; number?: number; pastFunder?: string | null; storyTitle?: string | null; focused?: boolean; writing: boolean; busy: boolean;
  /** The sister application answered this too: which program it was for, and how much of this answer still matches it (2026-10-29). */
  twin?: { program: string | null; pct: number } | null;
  folderId: string; userId: string | null; folderDocs: FolderDoc[]; attachment: FolderDoc | null; onAttach: (doc: FolderDoc) => Promise<void>;
  forceOpen?: boolean; onClosed?: () => void;
  onApproveNext: (answer: string, source: "coach" | "you", storyId: string | null, before: string | null) => Promise<void>;
  renderChat: (draft: string, fill: (text: string, storyId: string | null) => void) => ReactNode;
  onApprove: () => void; onUnapprove: () => void; onCopy: () => void; onRemove: () => void; onClear: () => void;
  onSave: (answer: string, toVault: boolean) => Promise<void>; onRegenerate: (instruction: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  // One place to edit: the box. Open it by clicking the answer, the pencil, or
  // Answer; it stays open until Close or Approve.
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.answer ?? "");
  const [saving, setSaving] = useState(false);
  /** What Grant Coach last put in the box, so an untouched draft is credited to it. */
  const [fromCoach, setFromCoach] = useState<{ text: string; storyId: string | null } | null>(null);
  useEffect(() => { if (!open) setDraft(item.answer ?? ""); }, [item.answer, open]);
  // Opened from outside: "Approve and next", or a jump from the reviewer.
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen]);
  const close = () => { setOpen(false); setFromCoach(null); onClosed?.(); };

  const fact = isFactRow(item);
  const approved = item.status === "done";
  const hasAnswer = !!item.answer?.trim();
  /* An "Upload" row: the answer is a file. Attach picks it (Vault, this folder,
     or new); attached is approved; the file name opens the file. */
  const isUpload = item.kind === "upload";
  const [picking, setPicking] = useState(false);
  const [reading, setReading] = useState(false);
  if (isUpload) {
    const missing = !!item.attachment_id && !attachment;
    const uploadMenu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="p-2 rounded-md text-white/35 hover:text-white hover:bg-white/10" aria-label="More for this attachment"><MoreHorizontal className="w-4 h-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-neutral-900 border-white/[0.08] text-white">
          {attachment && <DropdownMenuItem onSelect={() => void openFolderDoc(attachment).then((ok) => { if (!ok) toast.error("Couldn't open that file."); })} className="focus:bg-white/10 focus:text-white"><ExternalLink className="w-4 h-4 mr-2" /> Open the file</DropdownMenuItem>}
          {attachment?.storage_path && (
            <DropdownMenuItem disabled={reading} onSelect={() => { setReading(true); toast("Grant Coach is reading it…"); readAttachment(attachment).then(() => { qc.invalidateQueries({ queryKey: ["grant-docs", folderId] }); toast.success("Read."); }).catch((e) => toast.error(`Couldn't read it: ${(e as Error).message}`)).finally(() => setReading(false)); }} className="focus:bg-white/10 focus:text-white"><RefreshCw className="w-4 h-4 mr-2" /> {attachment.read_text ? "Read it again" : "Have Grant Coach read it"}</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setPicking(true)} className="focus:bg-white/10 focus:text-white"><Paperclip className="w-4 h-4 mr-2" /> {attachment ? "Replace the file" : "Attach a file"}</DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          {(attachment || hasAnswer) && (
            <DropdownMenuItem onSelect={onClear} className="text-red-300 focus:bg-red-500/15 focus:text-red-200"><X className="w-4 h-4 mr-2" /> Detach</DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onRemove} className="text-red-300 focus:bg-red-500/15 focus:text-red-200"><Trash2 className="w-4 h-4 mr-2" /> Not a question — remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    return (
      <div id={`q-${item.id}`} className={`scroll-mt-28 px-4 py-2.5 transition-shadow ${approved ? "bg-emerald-500/[0.04]" : ""} ${focused ? "ring-2 ring-inset ring-sky-400/80 bg-sky-400/[0.06]" : ""}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/60">
              {number != null && <span className="tabular-nums text-[11px] text-white/30 mr-1.5">{number}</span>}
              {item.label}
              {!item.required && <span className="ml-1.5 text-[10px] text-white/30 uppercase">optional</span>}
            </p>
            {item.detail && <p className="text-[12px] text-white/40 mt-0.5">{item.detail}</p>}
            {attachment ? (
              <button type="button" onClick={() => void openFolderDoc(attachment).then((ok) => { if (!ok) toast.error("Couldn't open that file."); })} title="Open the file" className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-medium text-white hover:underline">
                <Paperclip className="w-4 h-4 text-white/50" /> {attachment.file_name ?? attachment.title}
                {attachment.title !== (attachment.file_name ?? "").replace(/\.[^.]+$/, "") && <span className="text-[11px] font-normal text-white/40">· {attachment.title}</span>}
                <span className={`text-[11px] font-normal ${attachment.read_text?.trim() ? "text-emerald-300/80" : "text-amber-300/80"}`}>· {reading ? "Reading…" : readLabel(attachment)}</span>
              </button>
            ) : missing ? (
              <p className="mt-1 text-sm text-amber-300 italic">The attached file was removed from this folder. Attach it again.</p>
            ) : hasAnswer ? (
              <p className="mt-1 text-sm text-white/60"><NeedMarks text={item.answer ?? ""} /></p>
            ) : (
              <p className="mt-1 text-sm text-white/35 italic">No file attached yet.</p>
            )}
            {item.needs && !attachment && <p className="mt-1.5 text-[12px] text-amber-300 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {item.needs}</p>}
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {approved && attachment ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 font-semibold pl-1"><Check className="w-4 h-4" /> Approved</span>
            ) : null}
            {attachment ? (
              <button type="button" onClick={() => setPicking(true)} title="Replace the file" className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/10"><Paperclip className="w-4 h-4" /></button>
            ) : (
              <Button size="sm" onClick={() => setPicking(true)} disabled={busy} className="font-bold h-8" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Paperclip className="w-4 h-4 mr-1" /> Attach</Button>
            )}
            {uploadMenu}
          </div>
        </div>
        <AttachPicker open={picking} onOpenChange={setPicking} folderId={folderId} label={item.label} docs={folderDocs} userId={userId} onPicked={onAttach} />
      </div>
    );
  }
  const vaultField = !!item.vault_key && !item.vault_key.startsWith("doc:") && !item.vault_part;
  // A Vault fact with nothing in the Vault: the box to type it in is open from the start.
  const typeIn = !hasAnswer && !!item.vault_key && !!item.needs && !item.vault_key.startsWith("doc:");
  const editing = open || typeIn;
  const changed = draft.trim() !== (item.answer ?? "").trim();
  const count = measure(editing ? draft : item.answer, item.limit_kind);
  const over = !!item.limit_value && count > item.limit_value;

  /** A word changed in an approved answer: it is no longer approved, on its own. */
  const onType = (text: string) => {
    setDraft(text);
    if (approved && text.trim() !== (item.answer ?? "").trim()) onUnapprove();
  };
  /** Saves as you go: when focus leaves the box, what is there is kept (for this grant). */
  const keep = async () => {
    const text = draft.trim();
    if (!text || text === (item.answer ?? "").trim()) return;
    setSaving(true);
    try { await onSave(text, false); } finally { setSaving(false); }
  };
  const saveToVault = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try { await onSave(draft.trim(), true); close(); } finally { setSaving(false); }
  };
  const approveNext = async () => {
    const text = draft.trim();
    if (!text || saving) return; // one approve at a time; the button stays enabled so the first click counts
    setSaving(true);
    try {
      const coachWrote = !!fromCoach && fromCoach.text.trim() === text;
      // What Grant Coach wrote before Josh touched it: the draft card he used, or the answer it filled in.
      const before = fromCoach?.text ?? (item.answer_source === "coach" || item.answer_source === "memory" ? item.answer : null);
      await onApproveNext(text, coachWrote ? "coach" : "you", coachWrote ? fromCoach!.storyId : null, before);
      setOpen(false); setFromCoach(null);
    } finally { setSaving(false); }
  };

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="p-2 rounded-md text-white/35 hover:text-white hover:bg-white/10" aria-label="More for this question"><MoreHorizontal className="w-4 h-4" /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-neutral-900 border-white/[0.08] text-white">
        {hasAnswer && item.answer !== LEAVE_BLANK && (
          <DropdownMenuItem onSelect={onCopy} className="focus:bg-white/10 focus:text-white"><Copy className="w-4 h-4 mr-2" /> Copy</DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={busy} onSelect={() => void onRegenerate("")} className="focus:bg-white/10 focus:text-white"><RefreshCw className="w-4 h-4 mr-2" /> Have Grant Coach write it</DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        {hasAnswer && (
          <DropdownMenuItem onSelect={onClear} className="text-red-300 focus:bg-red-500/15 focus:text-red-200"><X className="w-4 h-4 mr-2" /> Clear the answer</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onRemove} className="text-red-300 focus:bg-red-500/15 focus:text-red-200"><Trash2 className="w-4 h-4 mr-2" /> Not a question — remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div id={`q-${item.id}`} className={`scroll-mt-28 px-4 transition-shadow ${fact && !editing ? "py-2.5" : "py-4"} ${approved ? "bg-emerald-500/[0.04]" : ""} ${focused ? "ring-2 ring-inset ring-sky-400/80 bg-sky-400/[0.06]" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${fact ? "text-white/60" : "font-semibold text-white"}`}>
            {number != null && <span className="tabular-nums text-[11px] font-normal text-white/30 mr-1.5">{number}</span>}
            {item.label}
            {!item.required && <span className="ml-1.5 text-[10px] text-white/30 uppercase">optional</span>}
            {item.answer_source === "vault" && hasAnswer && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-white/35 uppercase tracking-wide"><Vault className="w-3 h-3" /> from your Vault</span>}
            {storyTitle && hasAnswer && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-white/45 uppercase tracking-wide"><BookHeart className="w-3 h-3" /> tells: {storyTitle}</span>}
            {item.answer_source === "memory" && hasAnswer && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-white/45 uppercase tracking-wide"><History className="w-3 h-3" /> {fact ? "from a past grant" : "adapted from a past grant"}{pastFunder ? ` · ${pastFunder}` : ""}</span>}
            {item.answer_source === "portal" && hasAnswer && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-white/45 uppercase tracking-wide"><Globe className="w-3 h-3" /> from the portal</span>}
            {item.answer_source === "you" && hasAnswer && item.vault_key && !item.vault_key.startsWith("doc:") && <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-sky-300/70 uppercase tracking-wide"><Pencil className="w-3 h-3" /> edited for this grant</span>}
          </p>
          {!fact && item.detail && <p className="text-[12px] text-white/40 mt-0.5">{item.detail}</p>}

          {writing ? (
            <p className="mt-2 text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Writing…</p>
          ) : editing ? (
            <div className="mt-2 space-y-2">
              {/* The conversation first, the answer box right under the typing box —
                  so the answer being talked about stays in view while typing. */}
              {renderChat(draft, (text, storyId) => { onType(text); setFromCoach({ text, storyId }); })}
              {!fact && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Your answer · what goes into the portal</p>
                  {approved && !changed
                    ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300"><Check className="w-3.5 h-3.5" /> Approved</span>
                    : changed ? <span className="text-[11px] font-semibold text-amber-300">Changed · approve again</span> : null}
                </div>
              )}
              <Textarea
                value={draft}
                onChange={(e) => onType(e.target.value)}
                onBlur={() => void keep()}
                rows={fact ? 1 : Math.min(12, Math.max(4, Math.ceil(draft.length / 90)))}
                placeholder={typeIn ? "Type it here" : "Your answer"}
                className="bg-neutral-950 border-white/15 text-white text-sm"
                autoFocus={open}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => void approveNext()} disabled={busy || !draft.trim() || (approved && !changed)} className="bg-emerald-700 hover:bg-emerald-600 text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />} {approved && !changed ? "Approved" : "Approve and next"}
                </Button>
                {vaultField && (
                  <Button size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => void saveToVault()} disabled={!draft.trim()} title="Every grant from now on starts from the Vault" className="bg-transparent border border-white/20 text-white/85 hover:bg-white/10"><Vault className="w-4 h-4 mr-1.5" /> Save to the Vault</Button>
                )}
                {!typeIn && <Button size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={close} className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Close</Button>}
                <span className="text-[11px] text-white/35">{saving ? "Saving…" : "Saves as you go"}</span>
                {item.limit_value && <span className={`ml-auto text-[11px] tabular-nums ${over ? "text-amber-300" : "text-white/40"}`}>{count.toLocaleString()} / {item.limit_value.toLocaleString()} {item.limit_kind}</span>}
              </div>
            </div>
          ) : hasAnswer ? (
            <button type="button" onClick={() => setOpen(true)} title="Click to edit" className={`mt-1 block w-full text-left whitespace-pre-wrap rounded-md -mx-1 px-1 hover:bg-white/[0.04] ${fact ? "text-[15px] font-medium text-white" : "text-sm text-white/85 leading-relaxed"}`}><NeedMarks text={item.answer ?? ""} /></button>
          ) : (
            <p className="mt-1 text-sm text-white/35 italic">{item.needs_case ? "Not answered yet. Click Answer to work it out with Grant Coach." : "No answer yet."}</p>
          )}

          {/* The sameness check (Josh, 2026-10-29: "I want it to look like a fresh version"): a fact is expected to match; prose is not. */}
          {twin && !writing && !hasAnswer && (
            <p className="mt-1.5 text-[12px] text-amber-300 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Written for {twin.program ?? "the first application"} the first time · Grant Coach writes it fresh for this one.</p>
          )}
          {twin && !writing && hasAnswer && !fact && (
            twin.pct < TOO_CLOSE ? (
              <p className="mt-1.5 text-[12px] text-emerald-300/80 inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> {twin.pct}% matches the {twin.program ?? "first"} application · reads fresh</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="text-[12px] text-amber-300 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span><span className="font-semibold">{twin.pct}% matches the {twin.program ?? "first"} application</span> — too close; a reader with both would notice.</span></p>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void onRegenerate("Too close to the first application: write it again with new sentences in a new order, the same facts, led by what matters to this program.")} className="h-7 bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white"><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Rewrite fresh</Button>
              </div>
            )
          )}
          {(item.left_out?.length ?? 0) > 0 && hasAnswer && !writing && !approved && (
            <p className="mt-2 text-[12px] text-amber-300 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span><span className="font-semibold">Left out: </span>{item.left_out!.join("; ")}. Open it and ask Grant Coach to work any of these in.</span></p>
          )}
          {item.score_note && hasAnswer && !editing && !writing && (
            <p className="mt-2 text-[12px] inline-flex items-start gap-1.5" style={{ color: GC_BLUE }}><Award className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span className="text-white/70"><span className="font-semibold" style={{ color: GC_BLUE }}>Why it scores: </span>{item.score_note}</span></p>
          )}
          {item.needs && !writing && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[12px] text-amber-300 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {item.needs}</p>
              {item.answer_source === "portal" && vaultField && hasAnswer && (
                <Button size="sm" variant="outline" onClick={() => void onSave(item.answer!.trim(), true)} className="h-7 bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white"><Vault className="w-3.5 h-3.5 mr-1.5" /> Save to the Vault</Button>
              )}
            </div>
          )}
          {!editing && !writing && item.limit_value && hasAnswer && (
            <p className={`mt-1.5 text-[11px] tabular-nums ${over ? "text-amber-300" : "text-white/35"}`}>{count.toLocaleString()} / {item.limit_value.toLocaleString()} {item.limit_kind}{over ? " · over the limit — open it and ask Grant Coach for shorter" : ""}</p>
          )}
        </div>

        {/* The decision, always in the same place on the right. */}
        {!editing && !writing && (
          <div className="shrink-0 flex items-center gap-1.5">
            {hasAnswer && item.answer !== LEAVE_BLANK && (
              <button type="button" onClick={onCopy} title="Copy" className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/10"><Copy className="w-4 h-4" /></button>
            )}
            {approved ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 font-semibold pl-1"><Check className="w-4 h-4" /> Approved</span>
            ) : hasAnswer ? (
              <Button size="sm" onClick={onApprove} className="bg-emerald-700 hover:bg-emerald-600 text-white h-8"><Check className="w-4 h-4 mr-1" /> Approve</Button>
            ) : null}
            {hasAnswer ? (
              <button type="button" onClick={() => setOpen(true)} title="Edit, or ask Grant Coach" className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/10"><Pencil className="w-4 h-4" /></button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white h-8"><Pencil className="w-4 h-4 mr-1" /> Answer</Button>
            )}
            {menu}
          </div>
        )}
        {editing && !writing && <div className="shrink-0">{menu}</div>}
      </div>
    </div>
  );
}
