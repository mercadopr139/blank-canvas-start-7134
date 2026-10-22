// Grant Coach — one grant's folder: the questions read off screenshots of
// the funder's portal (each one a conversation with Grant Coach), the
// funder's documents and NLA's, and the facts of the grant (due date,
// amount, period). See the REVISED PLAN in docs/grant-coach/README.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Check, Circle, X, ClipboardPaste, CircleDot, MinusCircle, Loader2, Upload, Link2, ExternalLink, Trash2, CalendarClock, ChevronDown, ChevronRight,
  Sparkles, Download, RefreshCw, Images, MessageSquareText, Printer,
} from "lucide-react";
import { buildAnswersPdf, answersPdfFileName, printableItems } from "@/lib/grantCoach/answersPdf";
import { checklistProgress } from "@/lib/grantCoach/oceanChecklist";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { gatherLiveFacts, factYearLabel } from "@/lib/grantCoach/liveFacts";
import {
  loadLibrary, draftWithGrantCoach, readPortalScreens, narrativeItems, narrativeWordCount, NARRATIVE_SECTION, NARRATIVE_WORD_LIMIT,
} from "@/lib/grantCoach/writer";
import { downloadNarrativeDocx, headingFromLabel } from "@/lib/grantCoach/narrativeDocx";
import GrantQuestionPanel from "@/components/admin/grantCoach/GrantQuestionPanel";
import { useAsk } from "@/components/admin/AskDialog";

const NLA_RED = "#bf0f3e";

interface Folder {
  id: string; name: string; funder: string; program_name: string | null; status: string; due_at: string | null;
  amount_requested: number | null; amount_awarded: number | null; period_start: string | null; period_end: string | null;
  portal_url: string | null; notes: string | null; template_key: string | null;
}
interface Item {
  id: string; folder_id: string; section: string; label: string; detail: string | null; kind: string; required: boolean;
  status: "todo" | "in_progress" | "done" | "na"; owner: string | null; due_on: string | null; answer: string | null; sort_order: number;
  limit_kind?: "words" | "characters" | null; limit_value?: number | null; source_path?: string | null; pasted_at?: string | null;
}
interface Doc {
  id: string; folder_id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null;
  size_bytes: number | null; link_url: string | null; uploaded_at: string;
}

const STATUS: Record<Item["status"], { label: string; icon: typeof Check; cls: string }> = {
  todo: { label: "To do", icon: Circle, cls: "text-white/35" },
  in_progress: { label: "In progress", icon: CircleDot, cls: "text-amber-300" },
  done: { label: "Done", icon: Check, cls: "text-emerald-300" },
  na: { label: "N/A", icon: MinusCircle, cls: "text-white/25" },
};
const NEXT: Record<Item["status"], Item["status"]> = { todo: "in_progress", in_progress: "done", done: "todo", na: "todo" };

const whenAt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const whenOn = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const money = (n: number | null) => (n == null ? "" : `$${Number(n).toLocaleString()}`);
const kb = (n: number | null) => (n == null ? "" : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const docPath = (folderId: string, fileName: string) => `grants/${folderId}/${Date.now()}_${fileName.replace(/[^\w.-]+/g, "_").slice(0, 80)}`;

const AdminGrantFolder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { ask, dialog } = useAsk();

  const { data: folder, isLoading } = useQuery({
    queryKey: ["grant-folder", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_folders" as never).select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as unknown as Folder | null;
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["grant-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_checklist_items" as never).select("*").eq("folder_id", id!).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Item[];
    },
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["grant-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_documents" as never).select("*").eq("folder_id", id!).order("uploaded_at");
      if (error) throw error;
      return (data ?? []) as unknown as Doc[];
    },
  });

  const progress = checklistProgress(items);
  const sections = useMemo(() => {
    const out: { name: string; items: Item[] }[] = [];
    for (const it of items) {
      const last = out[out.length - 1];
      if (last && last.name === it.section) last.items.push(it);
      else out.push({ name: it.section, items: [it] });
    }
    return out;
  }, [items]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);

  /* ───── Grant Coach, the writer ─────
     A draft is built from three things the page gathers here: the About NLA
     library, the live numbers from the back end, and what is already written
     in this folder. The numbers are shown in the sidebar so Josh sees exactly
     what the writer was told. */
  const { data: facts = [], isFetching: factsLoading, refetch: refetchFacts } = useQuery({
    queryKey: ["grant-facts"],
    queryFn: () => gatherLiveFacts(),
    staleTime: 10 * 60_000,
  });
  const { data: library = [] } = useQuery({ queryKey: ["grant-library"], queryFn: loadLibrary, staleTime: 5 * 60_000 });
  const [drafting, setDrafting] = useState<string | null>(null);
  const [factsOpen, setFactsOpen] = useState(false);

  const answered = () => items.filter((i) => i.answer?.trim()).map((i) => ({ section: i.section, label: i.label, answer: i.answer!.trim() }));
  const draftFolder = () => ({
    name: folder!.name, funder: folder!.funder, program_name: folder!.program_name, amount_requested: folder!.amount_requested,
    period_start: folder!.period_start, period_end: folder!.period_end, due_at: folder!.due_at, notes: folder!.notes,
  });

  /* ───── Questions from the portal ─────
     Screenshots of the funder's online application go up, Grant Coach reads
     every question off them, and each becomes a checklist row under its
     screen's heading, with the funder's limit. From there each row is a
     conversation (GrantQuestionPanel). */
  const screensInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const importScreens = async (files: FileList | File[] | null) => {
    if (!files?.length || !folder) return;
    const list = Array.from(files).slice(0, 12);
    setReading(`Uploading ${list.length} screenshot${list.length === 1 ? "" : "s"}…`);
    try {
      const paths: string[] = [];
      for (const file of list) {
        const path = `grants/${id}/screens/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_").slice(0, 60)}`;
        const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        paths.push(path);
        await supabase.from("grant_documents" as never).insert({
          folder_id: id, side: "funder", title: `Portal screen: ${file.name.replace(/\.[^.]+$/, "")}`, storage_path: path, file_name: file.name,
          mime_type: file.type || null, size_bytes: file.size, uploaded_by: user?.id ?? null,
        } as never);
      }
      setReading("Grant Coach is reading the questions…");
      const questions = await readPortalScreens(paths);
      if (!questions.length) throw new Error("No questions were found on those screens.");
      const base = items.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1;
      const rows = questions.map((q, i) => ({
        folder_id: id,
        section: `Portal · ${q.screen || "Application"}`,
        label: q.text,
        detail: q.help || null,
        kind: q.kind === "choice" ? "field" : (q.kind || "field"),
        required: q.required !== false,
        status: "todo",
        owner: null,
        answer: null,
        sort_order: base + i,
        limit_kind: q.limit_kind ?? null,
        limit_value: q.limit_value ?? null,
        source_path: paths[Math.min(paths.length - 1, Math.floor((i / questions.length) * paths.length))],
      }));
      const { error } = await supabase.from("grant_checklist_items" as never).insert(rows as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["grant-items", id] });
      qc.invalidateQueries({ queryKey: ["grant-docs", id] });
      toast.success(`${questions.length} questions read from ${paths.length} screen${paths.length === 1 ? "" : "s"}. Each one is now a row you can talk through.`);
    } catch (e) {
      toast.error(`Couldn't read the screens: ${(e as Error).message}`);
    } finally {
      setReading(null);
      if (screensInput.current) screensInput.current.value = "";
    }
  };
  const [grantTalkOpen, setGrantTalkOpen] = useState(false);

  /* Paste screenshots (Josh, 2026-10-22): Win+Shift+S or Ctrl+C on a screen,
     then Ctrl+V anywhere on this page, the same way screenshots go into a
     chat. Each paste joins a numbered tray in paste order; "Read" sends the
     whole tray at once so questions keep their screens and order. Only image
     pastes are caught; pasting text into a conversation box still works. */
  const [tray, setTray] = useState<{ file: File; url: string }[]>([]);
  const trayRef = useRef(tray);
  trayRef.current = tray;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      e.preventDefault();
      setTray((t) => {
        const room = 12 - t.length;
        if (room <= 0) { toast.error("The tray holds 12 screens. Read these first, then paste the rest."); return t; }
        const added = images.slice(0, room).map((img, i) => {
          const n = t.length + i + 1;
          const file = new File([img], `screen-${String(n).padStart(2, "0")}.${img.type.split("/")[1] || "png"}`, { type: img.type });
          return { file, url: URL.createObjectURL(file) };
        });
        return [...t, ...added];
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
  useEffect(() => () => trayRef.current.forEach((t) => URL.revokeObjectURL(t.url)), []);
  const dropFromTray = (i: number) => setTray((t) => { URL.revokeObjectURL(t[i].url); return t.filter((_, j) => j !== i); });
  const readTray = async () => {
    const files = tray.map((t) => t.file);
    await importScreens(files);
    tray.forEach((t) => URL.revokeObjectURL(t.url));
    setTray([]);
  };

  /* Wipe this folder: its checklist, conversations, documents and files.
     The Grant Vault is untouched; it belongs to NLA, not to one grant. */
  const removeFolder = async () => {
    if (!folder) return;
    const ok = await ask.confirm({
      title: `Remove "${folder.name}"?`,
      body: "Everything in it goes: the checklist, the conversations, the documents and files. The Grant Vault is not affected. This cannot be undone.",
      confirmLabel: "Remove the folder",
      danger: true,
    });
    if (!ok) return;
    try {
      // Files first: everything under grants/<id>/, one level of subfolders deep.
      const prefix = `grants/${id}`;
      const { data: top } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).list(prefix, { limit: 1000 });
      const paths: string[] = [];
      for (const entry of top ?? []) {
        if (entry.id) paths.push(`${prefix}/${entry.name}`);
        else {
          const { data: inner } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).list(`${prefix}/${entry.name}`, { limit: 1000 });
          (inner ?? []).forEach((e) => { if (e.id) paths.push(`${prefix}/${entry.name}/${e.name}`); });
        }
      }
      if (paths.length) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove(paths);
      const { error } = await supabase.from("grant_folders" as never).delete().eq("id", id!);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["grant-folders"] });
      qc.invalidateQueries({ queryKey: ["grant-folder-progress"] });
      toast.success(`"${folder.name}" removed.`);
      navigate("/admin/finance/grant-coach");
    } catch (e) {
      toast.error(`Couldn't remove the folder: ${(e as Error).message}`);
    }
  };

  const draftNarrative = async (instruction?: string) => {
    if (!folder) return;
    const seven = narrativeItems(items);
    if (seven.length !== 7) { toast.error("This folder doesn't have the seven narrative items."); return; }
    setDrafting("narrative");
    try {
      const liveFacts = facts.length ? facts : (await refetchFacts()).data ?? [];
      const res = await draftWithGrantCoach({
        mode: "narrative", folder: draftFolder(), narrativeItems: seven, answered: answered().filter((a) => a.section !== NARRATIVE_SECTION), library, facts: liveFacts, instruction,
      });
      const sections = res.sections ?? [];
      for (const sec of sections) {
        const it = seven[sec.n - 1];
        if (it && sec.text) await patchItem(it, { answer: sec.text.trim(), status: it.status === "todo" ? "in_progress" : it.status });
      }
      const words = res.words ?? 0;
      toast.success(`Narrative drafted · ${words} words${words > NARRATIVE_WORD_LIMIT ? " — over the three-page limit, trim it" : ""}.`);
    } catch (e) {
      toast.error(`Grant Coach couldn't draft the narrative: ${(e as Error).message}`);
    } finally {
      setDrafting(null);
    }
  };

  const revise = (what: (instruction?: string) => Promise<void>, prompt: string) => async () => {
    const got = await ask.prompt({ title: "Revise the draft", body: prompt, fields: [{ key: "instruction", label: "What should change?", placeholder: "e.g. shorter, lead with the meals, more on partners", required: false }], confirmLabel: "Redraft" });
    if (!got) return;
    await what(got.instruction.trim() || undefined);
  };

  const downloadNarrative = async () => {
    if (!folder) return;
    const seven = narrativeItems(items);
    if (seven.some((i) => !i.answer?.trim())) { toast.error("All seven narrative items need an answer first."); return; }
    try {
      await downloadNarrativeDocx(
        seven.map((i) => ({ n: Number(i.label[0]), heading: headingFromLabel(i.label), text: i.answer!.trim() })),
        { org: "No Limits Academy", grant: folder.name, program: folder.program_name },
        `NoLimitsAcademy_Narrative_${folder.funder.replace(/[^A-Za-z0-9]+/g, "")}${folder.period_end ? "_" + folder.period_end.slice(0, 4) : ""}.docx`,
      );
      toast.success("Word file saved. Upload it on the narrative screen of the portal.");
    } catch (e) {
      toast.error(`Couldn't build the file: ${(e as Error).message}`);
    }
  };
  const narrativeWords = narrativeWordCount(narrativeItems(items));
  const narrativeReady = narrativeItems(items).length === 7 && narrativeItems(items).every((i) => i.answer?.trim());

  const patchItem = async (it: Item, patch: Partial<Item>) => {
    const { error } = await supabase.from("grant_checklist_items" as never).update({ ...patch, updated_at: new Date().toISOString() } as never).eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-items", id] });
  };
  const patchFolder = async (patch: Partial<Folder>) => {
    const { error } = await supabase.from("grant_folders" as never).update({ ...patch, updated_at: new Date().toISOString() } as never).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-folder", id] });
    qc.invalidateQueries({ queryKey: ["grant-folders"] });
  };

  /* ───── The hardcopy ─────
     After the online application is submitted, the folder is NLA's only
     record of what went in. Print downloads every question and answer in
     portal order and files the same PDF under our documents. */
  const [printing, setPrinting] = useState(false);
  const printAnswers = async () => {
    if (!folder) return;
    const rows = printableItems(items);
    if (!rows.length) { toast.error("Nothing to print yet. Read the portal screenshots in first."); return; }
    setPrinting(true);
    try {
      const pdf = await buildAnswersPdf(folder, rows);
      const name = answersPdfFileName(folder);
      pdf.save(name);
      const blob = pdf.output("blob");
      const path = docPath(id!, name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, blob, { contentType: "application/pdf" });
      if (error) throw error;
      const { error: e2 } = await supabase.from("grant_documents" as never).insert({
        folder_id: id, side: "ours", title: `Our answers, printed ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`,
        storage_path: path, file_name: name, mime_type: "application/pdf", size_bytes: blob.size, uploaded_by: user?.id ?? null,
      } as never);
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["grant-docs", id] });
      toast.success("Answers printed. A copy is filed under our documents.");
    } catch (e) {
      toast.error(`Couldn't print: ${(e as Error).message}`);
    } finally {
      setPrinting(false);
    }
  };

  /* ───── Documents ───── */
  const fileInput = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<"funder" | "ours">("funder");
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = docPath(id!, file.name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const { error: e2 } = await supabase.from("grant_documents" as never).insert({
        folder_id: id, side, title: file.name.replace(/\.[^.]+$/, ""), storage_path: path, file_name: file.name,
        mime_type: file.type || null, size_bytes: file.size, uploaded_by: user?.id ?? null,
      } as never);
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["grant-docs", id] });
      toast.success(`${file.name} added.`);
    } catch (e) {
      toast.error(`Couldn't upload: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const link = async () => {
    const got = await ask.prompt({
      title: "Add a link",
      body: "The funder's portal, a Drive file, or any web address.",
      fields: [{ key: "url", label: "Web address", placeholder: "https://…" }, { key: "title", label: "Call it", defaultValue: "Link" }],
      confirmLabel: "Add link",
    });
    if (!got) return;
    const url = got.url;
    if (!/^https?:\/\//i.test(url.trim())) { toast.error("That doesn't look like a web address."); return; }
    const title = got.title.trim() || "Link";
    const { error } = await supabase.from("grant_documents" as never).insert({ folder_id: id, side, title, link_url: url.trim(), uploaded_by: user?.id ?? null } as never);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-docs", id] });
  };
  const openDoc = async (d: Doc) => {
    if (d.link_url) { window.open(d.link_url, "_blank", "noopener"); return; }
    if (!d.storage_path) return;
    const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).createSignedUrl(d.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Couldn't open that file."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const removeDoc = async (d: Doc) => {
    if (!(await ask.confirm({ title: `Remove "${d.title}"?`, body: "It comes off this folder's documents. A file is deleted; a link is just forgotten.", confirmLabel: "Remove", danger: true }))) return;
    if (d.storage_path) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove([d.storage_path]);
    const { error } = await supabase.from("grant_documents" as never).delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-docs", id] });
  };

  if (isLoading) return <p className="text-white/50 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Opening the folder…</p>;
  if (!folder) return <p className="text-white/50">That folder isn't here. <button className="underline" onClick={() => navigate("/admin/finance/grant-coach")}>Back to Grant Coach</button></p>;

  const left = folder.due_at ? daysLeft(folder.due_at) : null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/admin/finance/grant-coach")} className="text-sm text-white/50 hover:text-white inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Grant Coach
      </button>

      {/* The grant at a glance */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{folder.funder}</p>
            <h1 className="text-2xl font-bold mt-0.5">{folder.name}</h1>
            {folder.program_name && <p className="text-sm text-white/60">Program: {folder.program_name}</p>}
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide bg-white/10 text-white/80">{folder.status}</span>
            {folder.due_at && (
              <p className={`mt-2 text-sm inline-flex items-center gap-1.5 ${left != null && left <= 7 ? "text-amber-300" : "text-white/60"}`}>
                <CalendarClock className="w-4 h-4" /> Due {whenAt(folder.due_at)}{left != null && ` · ${left} day${left === 1 ? "" : "s"} left`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-white/[0.04] p-3"><p className="text-[11px] text-white/40 uppercase tracking-wide">Requesting</p><p className="font-semibold">{money(folder.amount_requested) || "—"}</p></div>
          <div className="rounded-lg bg-white/[0.04] p-3"><p className="text-[11px] text-white/40 uppercase tracking-wide">Grant period</p><p className="font-semibold">{folder.period_start && folder.period_end ? `${whenOn(folder.period_start + "T12:00:00")} – ${whenOn(folder.period_end + "T12:00:00")}, ${folder.period_end.slice(0, 4)}` : "—"}</p></div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <p className="text-[11px] text-white/40 uppercase tracking-wide">Checklist</p>
            <p className="font-semibold">{progress.done} of {progress.total} done</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, backgroundColor: NLA_RED }} /></div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {folder.portal_url && (
            <a href={folder.portal_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200"><ExternalLink className="w-4 h-4" /> Open the funder's portal</a>
          )}
          <button type="button" onClick={() => void removeFolder()} className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-red-300">
            <Trash2 className="w-3.5 h-3.5" /> Remove this folder
          </button>
        </div>
        <Textarea
          key={folder.notes ?? ""}
          defaultValue={folder.notes ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (folder.notes ?? null)) void patchFolder({ notes: v }); }}
          placeholder="Notes on this grant — who you spoke to, what they said, what to remember."
          className="mt-4 bg-neutral-950 border-neutral-800 text-white text-sm"
          rows={2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* The checklist */}
        <section className="space-y-3 min-w-0">
          {/* Questions in by screenshot */}
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <p className="font-semibold text-sm inline-flex items-center gap-2"><Images className="w-4 h-4 text-white/50" /> Questions from the funder's portal</p>
              <p className="text-[12px] text-white/45 mt-0.5">Screenshot each screen of the online application and <span className="text-white/75 font-medium">paste it here with Ctrl+V</span>, in order, or upload the files. Grant Coach reads every question in, with its limit, and each becomes a row below to talk through. Your typed answers on the screens are ignored.</p>
            </div>
            <input ref={screensInput} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void importScreens(e.target.files)} />
            <Button size="sm" onClick={() => screensInput.current?.click()} disabled={reading != null} className="text-white" style={{ backgroundColor: NLA_RED }}>
              {reading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} {reading ?? "Upload screenshots"}
            </Button>
            {tray.length > 0 ? (
              <div className="w-full border-t border-white/[0.06] pt-3 space-y-2.5">
                <div className="flex flex-wrap gap-2">
                  {tray.map((t, i) => (
                    <div key={t.url} className="relative w-24 h-16 rounded-md overflow-hidden border border-white/15 bg-black">
                      <img src={t.url} alt={`Screen ${i + 1}`} className="w-full h-full object-cover object-top" />
                      <span className="absolute bottom-0.5 left-0.5 text-[10px] font-bold bg-black/75 text-white rounded px-1">{i + 1}</span>
                      <button type="button" onClick={() => dropFromTray(i)} disabled={reading != null} title="Take this screen out" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/75 text-white/80 hover:text-white flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => void readTray()} disabled={reading != null} className="text-white" style={{ backgroundColor: NLA_RED }}>
                    {reading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                    {reading ?? `Read ${tray.length} screen${tray.length === 1 ? "" : "s"}`}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { tray.forEach((t) => URL.revokeObjectURL(t.url)); setTray([]); }} disabled={reading != null} className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">Clear</Button>
                  <span className="text-[12px] text-white/45">Keep pasting the next screen. Read when the tray holds the whole application, up to 12.</span>
                </div>
              </div>
            ) : (
              <p className="w-full text-[11px] text-white/35 inline-flex items-center gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Paste a screenshot anywhere on this page to start the tray.</p>
            )}
          </div>

          {/* The grant as a whole */}
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
            <button type="button" onClick={() => setGrantTalkOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03]">
              <span className="font-semibold text-sm inline-flex items-center gap-2">
                {grantTalkOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                <MessageSquareText className="w-4 h-4 text-white/50" /> Talk to Grant Coach about this grant
              </span>
              <span className="text-[11px] text-white/40">which program · how much · what to lead with</span>
            </button>
            {grantTalkOpen && folder && (
              <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
                <GrantQuestionPanel folderId={id!} folder={draftFolder()} item={null} library={library} facts={facts} answered={answered()} onPatch={async () => {}} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Checklist</h2>
            <Button size="sm" variant="outline" onClick={() => void printAnswers()} disabled={printing || items.length === 0} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
              {printing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />} Print my answers
            </Button>
            <p className="text-[12px] text-white/45 w-full">Tap the circle to move an item along. Tap a row to open it: talk it through with Grant Coach, approve the answer, copy it into the portal, mark it pasted. After you submit, Print my answers keeps NLA's copy.</p>
          </div>
          {sections.map((sec) => {
            const p = checklistProgress(sec.items);
            const hidden = collapsed[sec.name];
            return (
              <div key={sec.name} className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
                <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [sec.name]: !hidden }))} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03]">
                  <span className="font-semibold text-sm inline-flex items-center gap-2">{hidden ? <ChevronRight className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />} {sec.name}</span>
                  <span className={`text-[11px] font-bold ${p.total && p.done === p.total ? "text-emerald-300" : "text-white/40"}`}>{p.done}/{p.total}</span>
                </button>
                {!hidden && sec.name === NARRATIVE_SECTION && (
                  <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3">
                    <Button size="sm" onClick={() => void draftNarrative()} disabled={drafting != null} className="text-white" style={{ backgroundColor: NLA_RED }}>
                      {drafting === "narrative" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                      {narrativeReady ? "Redraft all seven" : "Draft all seven with Grant Coach"}
                    </Button>
                    {narrativeReady && (
                      <Button size="sm" variant="outline" onClick={revise((i) => draftNarrative(i), "What should change in the narrative? (e.g. shorter, lead with the meals, more on partners)")} disabled={drafting != null} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                        Revise…
                      </Button>
                    )}
                    <span className={`text-[12px] tabular-nums ${narrativeWords > NARRATIVE_WORD_LIMIT ? "text-amber-300" : "text-white/50"}`}>
                      {narrativeWords.toLocaleString()} / {NARRATIVE_WORD_LIMIT.toLocaleString()} words{narrativeWords > NARRATIVE_WORD_LIMIT ? " · over three pages, trim" : " · about three pages"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void downloadNarrative()} disabled={!narrativeReady} className="ml-auto bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download Word file
                    </Button>
                  </div>
                )}
                {!hidden && (
                  <div className="divide-y divide-white/[0.06]">
                    {sec.items.map((it) => {
                      const S = STATUS[it.status];
                      const Icon = S.icon;
                      const isOpen = open === it.id;
                      return (
                        <div key={it.id} className={`px-4 py-2.5 ${isOpen ? "bg-white/[0.03]" : ""}`}>
                          <div className="flex items-start gap-3">
                            <button type="button" onClick={() => void patchItem(it, { status: NEXT[it.status] })} title={`${S.label} — tap to change`} className={`mt-0.5 shrink-0 ${S.cls} hover:text-white`}>
                              <Icon className="w-5 h-5" />
                            </button>
                            <button type="button" onClick={() => setOpen(isOpen ? null : it.id)} className="flex-1 min-w-0 text-left">
                              <p className={`text-sm ${it.status === "done" ? "line-through text-white/40" : it.status === "na" ? "text-white/30" : ""}`}>
                                {it.label}{!it.required && <span className="ml-1.5 text-[10px] text-white/30 uppercase">optional</span>}
                              </p>
                              {it.detail && !isOpen && <p className="text-[12px] text-white/40 truncate">{it.detail}</p>}
                            </button>
                            <div className="shrink-0 text-right text-[11px] text-white/40">
                              {it.pasted_at ? <p className="text-sky-300">Pasted</p> : it.status === "done" && it.answer ? <p className="text-emerald-300">Approved</p> : it.answer ? <p className="text-amber-300">Drafted</p> : null}
                              {it.limit_value && <p>{it.limit_value} {it.limit_kind}</p>}
                              {it.owner && <p>{it.owner}</p>}
                              {it.due_on && <p>{whenOn(it.due_on + "T12:00:00")}</p>}
                            </div>
                          </div>
                          {isOpen && (
                            <div className="mt-3 ml-8 space-y-3">
                              {it.detail && <p className="text-[12px] text-white/50">{it.detail}</p>}
                              <Textarea
                                key={`${it.id}-${it.answer ?? ""}`}
                                defaultValue={it.answer ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value.trim() || null;
                                  if (v === (it.answer ?? null)) return;
                                  // Approved means this exact text. A changed answer goes back to In progress (and un-pasted) until it is approved again.
                                  void patchItem(it, it.status === "done" ? { answer: v, status: "in_progress", pasted_at: null } : { answer: v });
                                }}
                                placeholder={it.kind === "narrative" ? "The answer, as it will go in the form." : it.kind === "upload" ? "Where the file is, or a note." : "The value, or a note."}
                                rows={it.kind === "narrative" ? 6 : 2}
                                className="bg-neutral-950 border-neutral-800 text-white text-sm"
                              />
                              {(it.kind === "narrative" || it.kind === "field") && (
                                <GrantQuestionPanel
                                  folderId={id!}
                                  folder={draftFolder()}
                                  item={it}
                                  library={library}
                                  facts={facts}
                                  answered={answered().filter((a) => a.label !== it.label)}
                                  onPatch={(patch) => patchItem(it, patch as Partial<Item>)}
                                />
                              )}
                              <div className="flex flex-wrap items-center gap-3 text-sm">
                                <label className="inline-flex items-center gap-2 text-white/60">Owner
                                  <select key={`${it.id}-${it.owner ?? ""}`} defaultValue={it.owner ?? ""} onChange={(e) => void patchItem(it, { owner: e.target.value || null })} className="rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-white">
                                    <option value="">—</option><option>Josh</option><option>Chrissy</option>
                                  </select>
                                </label>
                                <label className="inline-flex items-center gap-2 text-white/60">Due
                                  <Input type="date" key={`${it.id}-${it.due_on ?? ""}`} defaultValue={it.due_on ?? ""} onBlur={(e) => { const v = e.target.value || null; if (v !== it.due_on) void patchItem(it, { due_on: v }); }} className="h-8 w-40 bg-neutral-950 border-neutral-800 text-white" />
                                </label>
                                <label className="inline-flex items-center gap-2 text-white/60">Status
                                  <select key={`${it.id}-${it.status}`} defaultValue={it.status} onChange={(e) => void patchItem(it, { status: e.target.value as Item["status"] })} className="rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-white">
                                    {(Object.keys(STATUS) as Item["status"][]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                                  </select>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Documents, and the numbers the writer uses */}
        <aside className="space-y-3 min-w-0">
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 overflow-hidden">
            <button type="button" onClick={() => setFactsOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.03]">
              <span className="font-semibold text-sm inline-flex items-center gap-2">
                {factsOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                <Sparkles className="w-4 h-4 text-white/50" /> The numbers Grant Coach uses
              </span>
              <span className="text-[11px] text-white/40">{factsLoading ? "reading…" : `${facts.length} facts`}</span>
            </button>
            {factsOpen && (
              <div className="px-4 pb-3 border-t border-white/[0.06]">
                <p className="text-[12px] text-white/45 py-2">Program year {factYearLabel()}, the last complete year, pulled live from the back end. Every number about NLA's youth in a draft comes from here, never from the website or the CPF proposal; the library supplies the story, not the statistics. Nothing is made up.</p>
                <ul className="space-y-2">
                  {facts.map((f) => (
                    <li key={f.key} className="text-[12px]">
                      <span className="text-white/80">{f.label}:</span> <span className="text-white">{f.value}</span>
                      <span className="block text-[11px] text-white/35">{f.period} · {f.source}</span>
                    </li>
                  ))}
                  {!facts.length && !factsLoading && <li className="text-[12px] text-white/35">Nothing read yet.</li>}
                </ul>
                <Button size="sm" variant="outline" onClick={() => void refetchFacts()} disabled={factsLoading} className="mt-3 bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${factsLoading ? "animate-spin" : ""}`} /> Refresh the numbers
                </Button>
              </div>
            )}
          </div>

          <h2 className="font-bold">Documents</h2>
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4 space-y-3">
            <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1 text-xs">
              {(["funder", "ours"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setSide(s)} className={`flex-1 rounded-md px-2 py-1.5 font-semibold ${side === s ? "bg-white/10 text-white" : "text-white/50 hover:text-white"}`}>
                  {s === "funder" ? "From the funder" : "Ours"}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-white/45">
              {side === "funder" ? "The RFP, guidelines, budget template, rubric, reporting rules — everything they sent." : "What NLA wrote for them: narrative, budget workbook, the printed application, the award letter."}
            </p>
            <input ref={fileInput} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => fileInput.current?.click()} disabled={busy} className="text-white" style={{ backgroundColor: NLA_RED }}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Upload
              </Button>
              <Button size="sm" variant="outline" onClick={() => void link()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Link2 className="w-3.5 h-3.5 mr-1.5" /> Link</Button>
            </div>
            <ul className="divide-y divide-white/[0.06]">
              {docs.filter((d) => d.side === side).map((d) => (
                <li key={d.id} className="py-2 flex items-center gap-2">
                  <button type="button" onClick={() => void openDoc(d)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">{d.title}</p>
                    <p className="text-[11px] text-white/40">{d.link_url ? "Link" : d.file_name}{d.size_bytes ? ` · ${kb(d.size_bytes)}` : ""} · {whenOn(d.uploaded_at)}</p>
                  </button>
                  <button type="button" onClick={() => void removeDoc(d)} className="text-white/30 hover:text-red-400 p-1" aria-label={`Remove ${d.title}`}><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
              {docs.filter((d) => d.side === side).length === 0 && <li className="py-2 text-[12px] text-white/35">Nothing here yet.</li>}
            </ul>
          </div>
        </aside>
      </div>
      {dialog}
    </div>
  );
};

export default AdminGrantFolder;
