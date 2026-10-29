// Grant Coach — one grant's folder: the application, answered by Grant Coach
// (GrantApplication: paste the screens, approve or reject each answer), the
// funder's documents and NLA's, and the facts of the grant (due date,
// amount, period). See docs/grant-coach/README.md.
import { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Upload, Link2, ExternalLink, Trash2, CalendarClock,
  Sparkles, RefreshCw, FolderOpen, FileText, ChevronRight, ChevronDown,
} from "lucide-react";
import { buildAnswersPdf, answersPdfFileName, printableItems } from "@/lib/grantCoach/answersPdf";
import { planMerge, mergePdfs, setWriterFolder } from "@/lib/grantCoach/attachments";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { gatherLiveFacts, factYearLabel } from "@/lib/grantCoach/liveFacts";
import { loadLibrary, type CaseBrief, type FunderBrief as FunderBriefT } from "@/lib/grantCoach/writer";
import FunderBrief, { readAndSaveBrief } from "@/components/admin/grantCoach/FunderBrief";
import type { Review } from "@/lib/grantCoach/review";
import GrantApplication, { type AppItem } from "@/components/admin/grantCoach/GrantApplication";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { useAsk } from "@/components/admin/AskDialog";
import GrantLifecycle from "@/components/admin/grantCoach/GrantLifecycle";
import GrantReporting from "@/components/admin/grantCoach/GrantReporting";
import { loadReports } from "@/lib/grantCoach/lifecycle";


interface Folder {
  id: string; name: string; funder: string; program_name: string | null; status: string; due_at: string | null;
  amount_requested: number | null; amount_awarded: number | null; period_start: string | null; period_end: string | null;
  portal_url: string | null; notes: string | null; template_key: string | null;
  case_brief?: CaseBrief | null; case_locked_at?: string | null;
  review?: Review | null; reviewed_at?: string | null;
  funder_brief?: FunderBriefT | null; funder_brief_at?: string | null; funder_brief_docs?: string[];
  submitted_at?: string | null; decided_at?: string | null; closed_at?: string | null; decline_reason?: string | null;
  reporting_basis?: "as_written" | "changed" | null; applied_from?: string | null;
}
interface Doc {
  id: string; folder_id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null;
  size_bytes: number | null; link_url: string | null; uploaded_at: string;
}

const whenAt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const whenOn = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const money = (n: number | null) => (n == null ? "" : `$${Number(n).toLocaleString()}`);

/** "January 1, 2027", "01/01/2027" or "2027-01-01" → "2027-01-01", from local getters (never toISOString). */
const toYmd = (text: string | null | undefined): string | null => {
  const t = (text ?? "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
/** "$75,000" or "75000" → 75000. */
const toMoney = (text: string): number | null => {
  const n = Number(text.replace(/[^0-9.]/g, ""));
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** A line that edits in place: click, type, Enter or click away saves; Esc puts it back. */
function Inline({ value, onSave, className = "", placeholder = "—", title = "Click to edit" }: { value: string; onSave: (v: string) => void; className?: string; placeholder?: string; title?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const done = () => { setEditing(false); const v = draft.trim(); if (v !== value.trim()) onSave(v); else setDraft(value); };
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} title={title} className={`text-left rounded px-1 -mx-1 border-b border-dashed border-transparent hover:border-white/30 hover:bg-white/[0.04] ${className} ${value.trim() ? "" : "text-white/35"}`}>
        {value.trim() || placeholder}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => { if (e.key === "Enter") done(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
      className={`rounded bg-white/10 border border-white/30 px-1 -mx-1 outline-none min-w-0 w-full ${className}`}
    />
  );
}
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
      return (data ?? []) as unknown as AppItem[];
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

  const { data: reports = [] } = useQuery({ queryKey: ["grant-reports", id], enabled: !!id, queryFn: () => loadReports(id!) });
  const refreshFolder = () => { qc.invalidateQueries({ queryKey: ["grant-folder", id] }); qc.invalidateQueries({ queryKey: ["grant-folders"] }); qc.invalidateQueries({ queryKey: ["grant-reports"] }); };

  const live = items.filter((i) => i.status !== "na");
  const progress = { done: live.filter((i) => i.status === "done").length, total: live.length };
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
  const [factsOpen, setFactsOpen] = useState(false);

  const draftFolder = () => ({
    name: folder!.name, funder: folder!.funder, program_name: folder!.program_name, amount_requested: folder!.amount_requested,
    period_start: folder!.period_start, period_end: folder!.period_end, due_at: folder!.due_at, notes: folder!.notes,
  });

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

  const patchFolder = async (patch: Partial<Folder>) => {
    const { error } = await supabase.from("grant_folders" as never).update({ ...patch, updated_at: new Date().toISOString() } as never).eq("id", id!);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-folder", id] });
    qc.invalidateQueries({ queryKey: ["grant-folders"] });
  };

  // The amount, the dates and the program name the portal asked for, once
  // approved, fill the folder's blanks — the header stops showing dashes for
  // things already settled on screen 4. Only blanks; a typed value stays.
  // Every Grant Coach call on this page carries this folder's attachments (2026-10-29).
  useEffect(() => { setWriterFolder(id ?? null); return () => setWriterFolder(null); }, [id]);
  const filledFrom = useRef<string | null>(null);
  useEffect(() => {
    if (!folder || !items.length || filledFrom.current === id) return;
    const approved = (label: RegExp) => items.find((it) => it.status === "done" && label.test(it.label) && it.answer?.trim())?.answer?.trim() ?? null;
    const patch: Partial<Folder> = {};
    if (folder.amount_requested == null) { const n = toMoney(approved(/requested grant amount|amount requested/i) ?? ""); if (n != null) patch.amount_requested = n; }
    if (!folder.period_start) { const d = toYmd(approved(/program start date|start date/i)); if (d) patch.period_start = d; }
    if (!folder.period_end) { const d = toYmd(approved(/program end date|end date/i)); if (d) patch.period_end = d; }
    if (!folder.program_name) { const p = approved(/program\/project name|program name/i); if (p) patch.program_name = p; }
    filledFrom.current = id ?? null;
    if (Object.keys(patch).length) void patchFolder(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, items, id]);

  /* ───── The hardcopy ─────
     After the online application is submitted, the folder is NLA's only
     record of what went in. Print downloads every question and answer in
     portal order, an attachments page, and every attached PDF merged after
     it (Josh, 2026-10-29) — and files the same PDF under our documents. */
  const [printing, setPrinting] = useState(false);
  const printAnswers = async () => {
    if (!folder) return;
    const rows = printableItems(items);
    if (!rows.length) { toast.error("Nothing to print yet. Read the portal screenshots in first."); return; }
    setPrinting(true);
    try {
      const uploads = items.filter((i) => i.kind === "upload" && i.status !== "na");
      const { notes, pdfs } = await planMerge(uploads.map((i) => ({ label: i.label, doc: i.attachment_id ? docs.find((d) => d.id === i.attachment_id) ?? null : null })));
      const pdf = await buildAnswersPdf(folder, rows, new Date(), notes);
      const name = answersPdfFileName(folder);
      const merged = await mergePdfs(pdf.output("arraybuffer"), pdfs);
      const blob = new Blob([merged as BlobPart], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = href; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      const path = docPath(id!, name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, blob, { contentType: "application/pdf" });
      if (error) throw error;
      const { error: e2 } = await supabase.from("grant_documents" as never).insert({
        folder_id: id, side: "ours", title: `Our answers, printed ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`,
        storage_path: path, file_name: name, mime_type: "application/pdf", size_bytes: blob.size, uploaded_by: user?.id ?? null,
      } as never);
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["grant-docs", id] });
      toast.success(pdfs.length ? `Printed with ${pdfs.length} attached PDF${pdfs.length === 1 ? "" : "s"}. A copy is filed under our documents.` : "Answers printed. A copy is filed under our documents.");
    } catch (e) {
      toast.error(`Couldn't print: ${(e as Error).message}`);
    } finally {
      setPrinting(false);
    }
  };

  /* ───── Documents ───── */
  const fileInput = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<"funder" | "ours">("funder");
  // The two document lists open as pop-ups, not long lists on the page (Josh, 2026-10-29:
  // "long scroll isn't working"). The portal screenshots that built the application fold
  // into one line at the bottom of the funder's list; the RFP and guidelines stay on top.
  const [docsOpen, setDocsOpen] = useState(false);
  const [showShots, setShowShots] = useState(false);
  const openDocs = (s: "funder" | "ours") => { setSide(s); setShowShots(false); setDocsOpen(true); };
  /** The file chooser is one input; this says which list the chosen file is for. */
  const chooseFor = useRef<"funder" | "ours">("funder");
  const chooseFile = (sd: "funder" | "ours") => { chooseFor.current = sd; fileInput.current?.click(); };
  const isShot = (d: Doc) => !d.link_url && /^Application: screen-\d+/.test(d.title);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File, sd: "funder" | "ours" = side) => {
    setBusy(true);
    try {
      const path = docPath(id!, file.name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const { error: e2 } = await supabase.from("grant_documents" as never).insert({
        folder_id: id, side: sd, title: file.name.replace(/\.[^.]+$/, ""), storage_path: path, file_name: file.name,
        mime_type: file.type || null, size_bytes: file.size, uploaded_by: user?.id ?? null,
      } as never);
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["grant-docs", id] });
      toast.success(`${file.name} added.`);
      if (sd === "funder" && folder) {
        toast("Grant Coach is reading it into the funder brief…");
        const { data: fresh } = await supabase.from("grant_documents" as never).select("*").eq("folder_id", id!);
        readAndSaveBrief(id!, draftFolder(), (fresh ?? []) as unknown as Doc[], folder.funder_brief?.corrections ?? null)
          .then(() => { qc.invalidateQueries({ queryKey: ["grant-folder", id] }); toast.success("Funder brief updated. Every answer is written to it."); })
          .catch((e) => toast.error(`Couldn't read it into the brief: ${(e as Error).message}`));
      }
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
    <div className="space-y-6 w-full max-w-5xl mx-auto px-4 lg:px-8">
      <button onClick={() => navigate("/admin/finance/grant-coach")} className="text-sm text-white/50 hover:text-white inline-flex items-center gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Grant Coach
      </button>

      {/* The grant at a glance */}
      <div className="rounded-2xl border border-white/15 bg-[#141416] p-5 shadow-[0_0.3em_1.2em_rgba(0,0,0,0.45)]" style={{ borderTop: `3px solid ${GC_BLUE}` }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Inline value={folder.funder} onSave={(v) => void patchFolder({ funder: v })} title="The funder — click to edit" className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40" placeholder="Funder" />
            <h1 className="text-2xl font-bold mt-0.5"><Inline value={folder.name} onSave={(v) => { if (v) void patchFolder({ name: v }); }} title="The grant's name — click to edit" placeholder="Name this grant" /></h1>
            <p className="text-sm text-white/60">Program: <Inline value={folder.program_name ?? ""} onSave={(v) => void patchFolder({ program_name: v || null })} title="The program this grant funds — click to edit" placeholder="program name" /></p>
          </div>
          <div className="text-right">
            {folder.due_at && (
              <p className={`text-sm inline-flex items-center gap-1.5 ${left != null && left <= 7 ? "text-amber-300" : "text-white/60"}`}>
                <CalendarClock className="w-4 h-4" /> Due {whenAt(folder.due_at)}{left != null && ` · ${left} day${left === 1 ? "" : "s"} left`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-white/[0.04] p-3"><p className="text-[11px] text-white/40 uppercase tracking-wide">Requesting</p><p className="font-semibold"><Inline value={money(folder.amount_requested)} onSave={(v) => void patchFolder({ amount_requested: toMoney(v) })} title="The amount requested — click to edit" placeholder="—" /></p></div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <p className="text-[11px] text-white/40 uppercase tracking-wide">Grant period</p>
            <p className="font-semibold inline-flex items-center gap-1 flex-wrap">
              <Inline value={folder.period_start ?? ""} onSave={(v) => void patchFolder({ period_start: toYmd(v) })} title="Start date — click to edit (YYYY-MM-DD)" placeholder="start" className="tabular-nums" />
              <span className="text-white/40">–</span>
              <Inline value={folder.period_end ?? ""} onSave={(v) => void patchFolder({ period_end: toYmd(v) })} title="End date — click to edit (YYYY-MM-DD)" placeholder="end" className="tabular-nums" />
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.04] p-3">
            <p className="text-[11px] text-white/40 uppercase tracking-wide">Application</p>
            <p className="font-semibold">{progress.done} of {progress.total} approved</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, backgroundColor: GC_BLUE }} /></div>
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
        {/* Where it stands — applying, submitted, awarded or declined, closed — and the one next action,
            inside the header (Josh, 2026-10-29: its own card was one card too many). */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <GrantLifecycle
            folder={folder}
            draftFolder={draftFolder}
            items={items}
            docs={docs}
            reports={reports}
            userId={user?.id ?? null}
            ask={ask}
            onChanged={refreshFolder}
          />
        </div>
      </div>
      {(folder.status === "active" || folder.status === "closed") && (
        <GrantReporting
          folderId={id!}
          draftFolder={draftFolder}
          funderBrief={folder.funder_brief ?? null}
          reports={reports}
          promised={items.filter((i) => i.status === "done" && i.answer?.trim() && !["acknowledgment", "signature", "upload"].includes(i.kind)).map((i) => ({ label: i.label, answer: i.answer! }))}
          library={library}
          userId={user?.id ?? null}
          ask={ask}
        />
      )}

      <div className="space-y-6">
        {/* The grant's documents, full width (Josh, 2026-10-29); the numbers under them. */}
        <GcCard icon={<FolderOpen className="w-4 h-4" />} title="Grant/RFP Info Here" blurb="What the funder sent, and the rules Grant Coach read from it">
          <div className="p-4 space-y-3">
            {/* 1. What the funder sent: upload it here, and Grant Coach reads it into the rules below. */}
            {(() => {
              const all = docs.filter((d) => d.side === "funder");
              const shots = all.filter(isShot).length;
              const files = all.length - shots;
              return (
                <div className="rounded-xl border border-white/15 bg-black/30 p-3 flex flex-wrap items-center gap-3">
                  <FileText className="w-5 h-5 shrink-0" style={{ color: GC_BLUE }} />
                  <button type="button" onClick={() => openDocs("funder")} className="flex-1 min-w-[200px] text-left group">
                    <span className="block text-sm font-bold uppercase tracking-wide group-hover:underline underline-offset-2">From the funder</span>
                    <span className="block text-[12px] text-white/50">
                      {files ? `${files} file${files === 1 ? "" : "s"}` : "Nothing uploaded yet — the RFP, slides, budget template, rubric"}{shots ? ` · ${shots} portal screenshot${shots === 1 ? "" : "s"}` : ""}
                    </span>
                  </button>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => chooseFile("funder")} disabled={busy} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Upload
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setSide("funder"); void link(); }} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Link2 className="w-3.5 h-3.5 mr-1.5" /> Link</Button>
                  </div>
                </div>
              );
            })()}
            {/* 2. The rules Grant Coach read from those documents. */}
            <FunderBrief folderId={id!} folder={draftFolder()} docs={docs} brief={folder.funder_brief ?? null} briefAt={folder.funder_brief_at ?? null} briefDocIds={folder.funder_brief_docs ?? []} />
          </div>
        </GcCard>

        <input ref={fileInput} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, chooseFor.current); e.target.value = ""; }} />

        {/* One list at a time, in a pop-up: upload, link, open, remove. Esc or the X closes it. */}
        <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
          <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-white">{side === "funder" ? "From the funder" : "Attachments NLA Sent"}</DialogTitle>
              <p className="text-[12px] text-white/50">
                {side === "funder" ? "The RFP, guidelines, budget template, rubric, reporting rules — everything they sent." : "What went out with this application: every file attached to an upload question, the printed answers, the award letter. It fills itself."}
              </p>
            </DialogHeader>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => chooseFile(side)} disabled={busy} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Upload
              </Button>
              <Button size="sm" variant="outline" onClick={() => void link()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Link2 className="w-3.5 h-3.5 mr-1.5" /> Link</Button>
            </div>
            <div className="overflow-y-auto pr-1 -mr-1">
              {(() => {
                const all = docs.filter((d) => d.side === side);
                const files = side === "funder" ? all.filter((d) => !isShot(d)) : all;
                const shots = side === "funder" ? all.filter(isShot) : [];
                return (
                  <>
                    <ul className="divide-y divide-white/[0.06]">
                      {files.map((d) => (
                  <li key={d.id} className="py-2 flex items-center gap-2">
                    <button type="button" onClick={() => void openDoc(d)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm truncate">{d.title}</p>
                      <p className="text-[11px] text-white/40">{d.link_url ? "Link" : d.file_name}{d.size_bytes ? ` · ${kb(d.size_bytes)}` : ""} · {whenOn(d.uploaded_at)}</p>
                    </button>
                    <button type="button" onClick={() => void removeDoc(d)} className="text-white/30 hover:text-red-400 p-1" aria-label={`Remove ${d.title}`}><Trash2 className="w-4 h-4" /></button>
                  </li>
                      ))}
                      {files.length === 0 && <li className="py-2 text-[12px] text-white/35">Nothing here yet.</li>}
                    </ul>
                    {shots.length > 0 && (
                      <div className="mt-3 border-t border-white/10 pt-2">
                        <button type="button" onClick={() => setShowShots((o) => !o)} className="inline-flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white">
                          {showShots ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} {shots.length} portal screenshot{shots.length === 1 ? "" : "s"} that built the application
                        </button>
                        {showShots && (
                          <ul className="divide-y divide-white/[0.06] mt-1">
                            {shots.map((d) => (
                  <li key={d.id} className="py-2 flex items-center gap-2">
                    <button type="button" onClick={() => void openDoc(d)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm truncate">{d.title}</p>
                      <p className="text-[11px] text-white/40">{d.link_url ? "Link" : d.file_name}{d.size_bytes ? ` · ${kb(d.size_bytes)}` : ""} · {whenOn(d.uploaded_at)}</p>
                    </button>
                    <button type="button" onClick={() => void removeDoc(d)} className="text-white/30 hover:text-red-400 p-1" aria-label={`Remove ${d.title}`}><Trash2 className="w-4 h-4" /></button>
                  </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>

        <GcCard icon={<Sparkles className="w-4 h-4" />} title="The numbers Grant Coach uses" blurb={factsLoading ? "reading…" : `${facts.length} facts · program year ${factYearLabel()}`} open={factsOpen} onToggle={() => setFactsOpen((o) => !o)}>
          <div className="px-4 pb-3">
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
        </GcCard>

        {/* The application, full width; under it the record of what went out with it (Josh, 2026-10-29:
            attachments only exist once you are deep in the application, so they live at the end). */}
        <section className="min-w-0 space-y-6">
          <GrantApplication
            folderId={id!}
            folder={draftFolder()}
            items={items}
            library={library}
            getFacts={async () => (facts.length ? facts : (await refetchFacts()).data ?? [])}
            userId={user?.id ?? null}
            onPrint={() => void printAnswers()}
            printing={printing}
            confirm={(o) => ask.confirm(o)}
            prompt={(a) => ask.prompt(a)}
            caseBrief={folder.case_brief ?? null}
            caseLockedAt={folder.case_locked_at ?? null}
            review={folder.review ?? null}
            reviewedAt={folder.reviewed_at ?? null}
            funderBrief={folder.funder_brief ?? null}
          />
          {(() => {
            const ours = docs.filter((d) => d.side === "ours");
            return (
              <GcCard icon={<FileText className="w-4 h-4" />} title="Attachments NLA Sent" blurb={ours.length ? `${ours.length} file${ours.length === 1 ? "" : "s"} · every file attached to an upload question, the printed answers, the award letter` : "Fills itself: every file attached to an upload question, the printed answers, the award letter"}
                right={<Button size="sm" variant="outline" onClick={() => openDocs("ours")} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white h-8"><FileText className="w-3.5 h-3.5 mr-1.5" /> See the files</Button>} />
            );
          })()}
        </section>

      </div>
      {dialog}
    </div>
  );
};

export default AdminGrantFolder;
