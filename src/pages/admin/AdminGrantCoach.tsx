// Grant Coach home: the grants, the Grant Vault and the documents.
//
// Everything a funder asks about the organization, kept in one place and
// filled once (docs/grant-coach/README.md). The Grant Vault (GrantVault.tsx)
// is the one source of truth since 2026-10-28: each section opens with the
// approved paragraph of the program year and carries the facts under it;
// the old Snapshot tab is folded into it. The documents every application
// attaches (990, determination letter, approved budget, audit…) are kept in
// the private grant-documents bucket, or as a link, one per catalog entry.
import { useMemo, useRef, useState } from "react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  BookOpen, FolderLock, Check, Loader2, Upload, Link2, ExternalLink, Trash2, AlertCircle, FolderPlus, CalendarClock, ChevronRight,
} from "lucide-react";
import { checklistProgress } from "@/lib/grantCoach/oceanChecklist";
import { orgCompleteness } from "@/lib/grantCoach/orgProfile";
import { useAsk } from "@/components/admin/AskDialog";
import PastAnswers from "@/components/admin/grantCoach/PastAnswers";
import StoryBank from "@/components/admin/grantCoach/StoryBank";
import GrantVault from "@/components/admin/grantCoach/GrantVault";
import GrantPipeline from "@/components/admin/grantCoach/GrantPipeline";
import { documentAge, STATUS_LABEL, type FolderStatus } from "@/lib/grantCoach/lifecycle";
import { ORG_DOCUMENTS, GRANT_DOCUMENTS_BUCKET, orgDocumentPath, type OrgDocument } from "@/lib/grantCoach/orgDocuments";


interface DocRow {
  key: string; storage_path: string | null; file_name: string | null; mime_type: string | null;
  size_bytes: number | null; link_url: string | null; note: string | null; updated_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const kb = (n: number | null) => (n == null ? "" : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

type Tab = "grants" | "about" | "documents";

const AdminGrantCoach = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("grants");

  /* ───── The grants ───── */
  interface FolderRow { id: string; name: string; funder: string; status: string; due_at: string | null; amount_requested: number | null; amount_awarded: number | null; period_start: string | null; period_end: string | null; template_key: string | null }
  const { data: folders = [] } = useQuery({
    queryKey: ["grant-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_folders" as never).select("id, name, funder, status, due_at, amount_requested, amount_awarded, period_start, period_end, template_key").order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as FolderRow[];
    },
  });
  const { data: itemCounts = {} } = useQuery({
    queryKey: ["grant-folder-progress"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_checklist_items" as never).select("folder_id, required, status");
      if (error) throw error;
      const by: Record<string, { required: boolean; status: string }[]> = {};
      for (const r of (data ?? []) as unknown as { folder_id: string; required: boolean; status: string }[]) (by[r.folder_id] ??= []).push(r);
      return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, checklistProgress(v)])) as Record<string, { done: number; total: number }>;
    },
  });
  const [starting, setStarting] = useState(false);
  const { ask, dialog } = useAsk();
  /** A blank folder for any funder: name and funder now, the rest inside. */
  const startBlank = async () => {
    const got = await ask.prompt({
      title: "New grant",
      body: "A folder for one grant. The funder's documents, the questions, the answers and the reports all live in it.",
      fields: [
        { key: "funder", label: "Funder", placeholder: "e.g. O.C.E.A.N., Inc." },
        { key: "name", label: "What the grant is called", placeholder: "e.g. 2027 CSBG Partnership Program" },
      ],
      confirmLabel: "Start the folder",
    });
    if (!got) return;
    const funder = got.funder, name = got.name;
    setStarting(true);
    try {
      const { data: created, error } = await supabase
        .from("grant_folders" as never)
        .insert({ name: name.trim(), funder: funder.trim(), status: "applying", created_by: user?.id ?? null } as never)
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["grant-folders"] });
      navigate(`/admin/finance/grant-coach/${(created as unknown as { id: string }).id}`);
    } catch (e) {
      toast.error(`Couldn't start the folder: ${(e as Error).message}`);
    } finally {
      setStarting(false);
    }
  };
  const whenAt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

  /* ───── The Vault's tab count (the Vault itself is GrantVault.tsx) ───── */
  const { data: fieldRows = [] } = useQuery({
    queryKey: ["grant-org-fields"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value, updated_at");
      if (error) throw error;
      return (data ?? []) as unknown as { key: string; value: string | null; updated_at: string }[];
    },
  });
  const completeness = orgCompleteness(useMemo(() => Object.fromEntries(fieldRows.map((r) => [r.key, r.value])) as Record<string, string | null>, [fieldRows]));

  /* ───── The documents ───── */
  const { data: docRows = [] } = useQuery({
    queryKey: ["grant-org-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_documents" as never).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as DocRow[];
    },
  });
  const docs = useMemo(() => Object.fromEntries(docRows.map((d) => [d.key, d])) as Record<string, DocRow>, [docRows]);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upsertDoc = async (row: Partial<DocRow> & { key: string }) => {
    const { error } = await supabase
      .from("grant_org_documents" as never)
      .upsert({ ...row, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never, { onConflict: "key" } as never);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["grant-org-documents"] });
  };

  const uploadDoc = async (doc: OrgDocument, file: File) => {
    setBusyDoc(doc.key);
    try {
      const path = orgDocumentPath(doc.key, file.name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw error;
      // The old file, if any, goes once the new row is in.
      const old = docs[doc.key]?.storage_path;
      await upsertDoc({ key: doc.key, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, link_url: null });
      if (old && old !== path) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove([old]);
      toast.success(`${doc.title} uploaded.`);
    } catch (e) {
      toast.error(`Couldn't upload: ${(e as Error).message}`);
    } finally {
      setBusyDoc(null);
    }
  };

  const linkDoc = async (doc: OrgDocument) => {
    const got = await ask.prompt({
      title: `Link to ${doc.title}`,
      body: "A Google Drive or other web address.",
      fields: [{ key: "url", label: "Web address", placeholder: "https://…", defaultValue: docs[doc.key]?.link_url ?? "" }],
      confirmLabel: "Save link",
    });
    if (!got) return;
    const url = got.url;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) { toast.error("That doesn't look like a web address."); return; }
    setBusyDoc(doc.key);
    try {
      const old = docs[doc.key]?.storage_path;
      await upsertDoc({ key: doc.key, link_url: trimmed, storage_path: null, file_name: null, mime_type: null, size_bytes: null });
      if (old) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove([old]);
      toast.success(`${doc.title} linked.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyDoc(null);
    }
  };

  const openDoc = async (doc: OrgDocument) => {
    const row = docs[doc.key];
    if (!row) return;
    if (row.link_url) { window.open(row.link_url, "_blank", "noopener"); return; }
    if (!row.storage_path) return;
    const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    if (error || !data?.signedUrl) { toast.error("Couldn't open that file."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const removeDoc = async (doc: OrgDocument) => {
    const row = docs[doc.key];
    if (!row) return;
    if (!(await ask.confirm({ title: `Remove ${doc.title}?`, body: row.storage_path ? "The file is deleted from Grant Coach." : "The link is forgotten.", confirmLabel: "Remove", danger: true }))) return;
    setBusyDoc(doc.key);
    try {
      if (row.storage_path) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove([row.storage_path]);
      const { error } = await supabase.from("grant_org_documents" as never).delete().eq("key", doc.key);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["grant-org-documents"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyDoc(null);
    }
  };

  const docsDone = ORG_DOCUMENTS.filter((d) => docs[d.key]).length;
  const oceanDocs = ORG_DOCUMENTS.filter((d) => d.ocean);
  const oceanDone = oceanDocs.filter((d) => docs[d.key]).length;

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto px-4 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Grant Coach</h1>
          <p className="text-sm text-white/50 mt-1">
            One place for everything a funder asks about No Limits Academy. Fill it once; every application and report starts from here.
          </p>
        </div>
        <div className="flex gap-2">
          {([
            { k: "grants" as Tab, label: "Grants", icon: FolderPlus, sub: `${folders.filter((f) => f.status === "applying").length} applying · ${folders.filter((f) => f.status === "active").length} active` },
            { k: "about" as Tab, label: "Grant Vault", icon: BookOpen, sub: `${completeness.done} of ${completeness.total} required facts` },
            { k: "documents" as Tab, label: "Documents", icon: FolderLock, sub: `${docsDone} of ${ORG_DOCUMENTS.length} on file` },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-xl border px-4 py-2 text-left transition-colors ${tab === t.k ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
            >
              <span className="flex items-center gap-2 font-semibold text-sm"><t.icon className="w-4 h-4" style={{ color: GC_BLUE }} /> {t.label}</span>
              <span className="block text-[11px] text-white/45">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "grants" && (
        <div className="space-y-4">
          {folders.length > 0 && <GrantPipeline folders={folders} />}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <p className="font-semibold">One folder per grant, from the day the funder's documents arrive to the day the final report is filed.</p>
            <p className="text-white/50 mt-1">Start a grant, screenshot the funder's online application, and Grant Coach reads every question in. Each one is a conversation: it asks first, recommends, writes when you say so. Approve, copy into the portal, mark it pasted.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 divide-y divide-white/10">
            {folders.map((f) => {
              const p = itemCounts[f.id] ?? { done: 0, total: 0 };
              const left = f.due_at ? daysLeft(f.due_at) : null;
              return (
                <button key={f.id} type="button" onClick={() => navigate(`/admin/finance/grant-coach/${f.id}`)} className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">{f.funder}</p>
                    <p className="font-semibold truncate">{f.name}</p>
                    <p className="text-[12px] text-white/45 mt-0.5 inline-flex items-center gap-3 flex-wrap">
                      <span className="rounded-full px-2 py-0.5 bg-white/10 text-white/70 text-[10px] font-bold uppercase tracking-wide">{STATUS_LABEL[f.status as FolderStatus] ?? f.status}</span>
                      {f.due_at && <span className={`inline-flex items-center gap-1 ${left != null && left <= 7 ? "text-amber-300" : ""}`}><CalendarClock className="w-3.5 h-3.5" /> Due {whenAt(f.due_at)}{left != null && ` · ${left} day${left === 1 ? "" : "s"}`}</span>}
                      {p.total > 0 && <span>{p.done} of {p.total} done</span>}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/30 shrink-0" />
                </button>
              );
            })}
            {folders.length === 0 && <p className="p-4 text-sm text-white/40">No grants yet.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void startBlank()} disabled={starting} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderPlus className="w-4 h-4 mr-2" />} New grant
            </Button>
          </div>
        </div>
      )}


      {tab === "about" && (
        <div className="space-y-6">
          <GrantVault />
          <StoryBank />
          <PastAnswers />
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <p className="font-semibold">Upload each document once. Every application attaches from here.</p>
            <p className="text-white/50 mt-1">
              O.C.E.A.N. 2027 asks for {oceanDocs.length} of these; {oceanDone} on file. Files are stored privately; a link to a Drive file works too.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 divide-y divide-white/10">
            {ORG_DOCUMENTS.map((doc) => {
              const row = docs[doc.key];
              const busy = busyDoc === doc.key;
              return (
                <div key={doc.key} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <p className="font-semibold text-sm flex items-center gap-2">
                      {doc.title}
                      {doc.ocean && <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-white/10 text-white/60">O.C.E.A.N.</span>}
                    </p>
                    <p className="text-[12px] text-white/45">{doc.why}{doc.accepts ? ` · ${doc.accepts}` : ""}</p>
                    {row ? (() => {
                      // Documents that know their age: a 990 or a budget goes stale after a year.
                      const age = documentAge(doc.key, row.updated_at);
                      const tone = age.state === "stale" ? "text-red-300" : age.state === "due" ? "text-amber-300" : "text-emerald-300/90";
                      return (
                        <p className={`text-[12px] mt-1 inline-flex items-center gap-1.5 ${tone}`}>
                          {age.state === "stale" || age.state === "due" ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          {row.link_url ? "Linked" : row.file_name}{row.size_bytes ? ` · ${kb(row.size_bytes)}` : ""} · {when(row.updated_at)}
                          {age.state === "stale" && ` · ${age.ageMonths} months old; funders expect a new one every ${age.months}`}
                          {age.state === "due" && " · due for a refresh next month"}
                        </p>
                      );
                    })() : (
                      <p className="text-[12px] mt-1 text-amber-300/80 inline-flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Not on file</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={(el) => { fileInputs.current[doc.key] = el; }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDoc(doc, f); e.target.value = ""; }}
                    />
                    {row && (
                      <Button size="sm" variant="outline" onClick={() => void openDoc(doc)} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open
                      </Button>
                    )}
                    <Button size="sm" onClick={() => fileInputs.current[doc.key]?.click()} disabled={busy} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} {row ? "Replace" : "Upload"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void linkDoc(doc)} disabled={busy} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
                      <Link2 className="w-3.5 h-3.5 mr-1.5" /> Link
                    </Button>
                    {row && (
                      <button type="button" onClick={() => void removeDoc(doc)} disabled={busy} className="text-white/35 hover:text-red-400 p-1.5" title="Remove" aria-label={`Remove ${doc.title}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
};

export default AdminGrantCoach;
