// Grant Coach — step 1: the About NLA library and the organization documents.
//
// Everything a funder asks about the organization, kept in one place and
// filled once (docs/grant-coach/README.md). The library's fields come from
// src/lib/grantCoach/orgProfile.ts, seeded from the public website; what a
// person saves goes to grant_org_fields. The documents every application
// attaches (990, determination letter, approved budget, audit…) are kept in
// the private grant-documents bucket, or as a link, one per catalog entry.
// Steps 2–4 (grant folders, the writer, reporting) build on this page.
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  BookOpen, FolderLock, Globe, Check, Loader2, Upload, Link2, ExternalLink, Trash2, RotateCcw, AlertCircle, FolderPlus, CalendarClock, ChevronRight,
} from "lucide-react";
import { checklistProgress } from "@/lib/grantCoach/oceanChecklist";
import { ORG_SECTIONS, orgFieldValue, orgCompleteness, type OrgField } from "@/lib/grantCoach/orgProfile";
import { useAsk } from "@/components/admin/AskDialog";
import { ORG_DOCUMENTS, GRANT_DOCUMENTS_BUCKET, orgDocumentPath, type OrgDocument } from "@/lib/grantCoach/orgDocuments";

const NLA_RED = "#bf0f3e";

interface FieldRow { key: string; value: string | null; updated_at: string }
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
  interface FolderRow { id: string; name: string; funder: string; status: string; due_at: string | null; amount_requested: number | null; template_key: string | null }
  const { data: folders = [] } = useQuery({
    queryKey: ["grant-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_folders" as never).select("id, name, funder, status, due_at, amount_requested, template_key").order("due_at", { ascending: true, nullsFirst: false });
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

  /* ───── The library ───── */
  const { data: fieldRows = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["grant-org-fields"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value, updated_at");
      if (error) throw error;
      return (data ?? []) as unknown as FieldRow[];
    },
  });
  const saved = useMemo(() => Object.fromEntries(fieldRows.map((r) => [r.key, r.value])) as Record<string, string | null>, [fieldRows]);
  const savedAt = useMemo(() => Object.fromEntries(fieldRows.map((r) => [r.key, r.updated_at])) as Record<string, string>, [fieldRows]);
  const completeness = orgCompleteness(saved);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  // The field that just saved, for a green "Saved" that lingers a moment.
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [lastSave, setLastSave] = useState<{ label: string; at: Date } | null>(null);
  const saveField = async (field: OrgField, raw: string) => {
    const value = raw.trim() ? raw : null;
    const current = saved[field.key];
    // Nothing typed over a seed, or the same text again: nothing to write.
    if ((current ?? null) === value) return;
    if (current === undefined && value === (field.seed ?? null)) return;
    setSavingKey(field.key);
    const { error } = await supabase
      .from("grant_org_fields" as never)
      .upsert({ key: field.key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never, { onConflict: "key" } as never);
    setSavingKey(null);
    if (error) { toast.error(`Couldn't save ${field.label}: ${error.message}`); return; }
    setJustSaved(field.key);
    setLastSave({ label: field.label, at: new Date() });
    window.setTimeout(() => setJustSaved((k) => (k === field.key ? null : k)), 2500);
    qc.invalidateQueries({ queryKey: ["grant-org-fields"] });
  };
  /** Back to the website's text: drop the saved row. */
  const resetField = async (field: OrgField) => {
    const { error } = await supabase.from("grant_org_fields" as never).delete().eq("key", field.key);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-org-fields"] });
  };

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
    <div className="space-y-6">
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
            { k: "about" as Tab, label: "Grant Vault", icon: BookOpen, sub: `${completeness.done} of ${completeness.total} required` },
            { k: "documents" as Tab, label: "Documents", icon: FolderLock, sub: `${docsDone} of ${ORG_DOCUMENTS.length} on file` },
          ]).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-xl border px-4 py-2 text-left transition-colors ${tab === t.k ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
            >
              <span className="flex items-center gap-2 font-semibold text-sm"><t.icon className="w-4 h-4" style={{ color: NLA_RED }} /> {t.label}</span>
              <span className="block text-[11px] text-white/45">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "grants" && (
        <div className="space-y-4">
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
                      <span className="rounded-full px-2 py-0.5 bg-white/10 text-white/70 text-[10px] font-bold uppercase tracking-wide">{f.status}</span>
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
            <Button onClick={() => void startBlank()} disabled={starting} className="text-white" style={{ backgroundColor: NLA_RED }}>
              {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderPlus className="w-4 h-4 mr-2" />} New grant
            </Button>
          </div>
        </div>
      )}

      {tab === "about" && (
        <div className="space-y-6">
          {/* Completeness */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-sm gap-3 flex-wrap">
              <p className="font-semibold">Required facts filled</p>
              <p className="text-white/60">{completeness.done} of {completeness.total}</p>
            </div>
            {/* Every entry saves the moment you click out of its box. This line
                says so, and names the last one, so nobody wonders. */}
            <p className="mt-2 text-[12px] inline-flex items-center gap-1.5 text-emerald-300/90">
              <Check className="w-3.5 h-3.5" />
              {fieldRows.length} {fieldRows.length === 1 ? "entry" : "entries"} saved
              {lastSave
                ? ` · last: ${lastSave.label}, ${lastSave.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : " · each box saves when you click out of it"}
            </p>
            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${completeness.total ? Math.round((completeness.done / completeness.total) * 100) : 0}%`, backgroundColor: NLA_RED }} />
            </div>
            <p className="mt-2 text-[12px] text-white/45 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Text marked <span className="rounded px-1 bg-sky-500/15 text-sky-200">from the website</span> was seeded from the public site. Edit it here and every draft uses your edit; Reset brings the website text back.
            </p>
          </div>

          {fieldsLoading ? (
            <p className="text-white/50 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the library…</p>
          ) : (
            ORG_SECTIONS.map((section) => (
              <section key={section.key} className="rounded-2xl border border-white/10 bg-neutral-900/60">
                <div className="px-5 py-4 border-b border-white/10">
                  <h2 className="font-bold">{section.title}</h2>
                  <p className="text-sm text-white/50">{section.blurb}</p>
                </div>
                <div className="p-5 grid gap-5 md:grid-cols-2">
                  {section.fields.map((field) => {
                    const value = orgFieldValue(field, saved);
                    const fromSite = saved[field.key] === undefined && !!field.seed;
                    const empty = !value.trim();
                    const wide = field.kind === "long" || field.kind === "list";
                    return (
                      <div key={field.key} className={wide ? "md:col-span-2" : ""}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <label htmlFor={`f-${field.key}`} className="text-sm font-semibold">{field.label}</label>
                          {field.required && empty && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> Needed</span>
                          )}
                          {fromSite && <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-sky-500/15 text-sky-200">From the website</span>}
                          {savingKey === field.key && <span className="text-[10px] text-white/50 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
                          {justSaved === field.key && savingKey !== field.key && (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
                          )}
                          {saved[field.key] !== undefined && savingKey !== field.key && justSaved !== field.key && (
                            <span className="text-[10px] text-white/35 inline-flex items-center gap-1"><Check className="w-3 h-3" /> saved {when(savedAt[field.key])}</span>
                          )}
                        </div>
                        {field.kind === "yesno" ? (
                          <select
                            id={`f-${field.key}`}
                            key={`${field.key}-${value}`}
                            defaultValue={value}
                            onChange={(e) => void saveField(field, e.target.value)}
                            className="w-full rounded-md bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-white"
                          >
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        ) : wide ? (
                          <Textarea
                            id={`f-${field.key}`}
                            key={`${field.key}-${saved[field.key] ?? "seed"}`}
                            defaultValue={value}
                            rows={field.kind === "list" ? Math.min(12, Math.max(3, value.split("\n").length + 1)) : 5}
                            onBlur={(e) => void saveField(field, e.target.value)}
                            placeholder={field.kind === "list" ? "One per line" : undefined}
                            className="bg-neutral-950 border-neutral-800 text-white text-sm"
                          />
                        ) : (
                          <Input
                            id={`f-${field.key}`}
                            key={`${field.key}-${saved[field.key] ?? "seed"}`}
                            type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
                            defaultValue={value}
                            onBlur={(e) => void saveField(field, e.target.value)}
                            className="bg-neutral-950 border-neutral-800 text-white text-sm"
                          />
                        )}
                        <div className="flex items-center justify-between gap-3 mt-1">
                          {field.help ? <p className="text-[11px] text-white/40">{field.help}</p> : <span />}
                          {field.seed && saved[field.key] !== undefined && (
                            <button type="button" onClick={() => void resetField(field)} className="text-[11px] text-white/40 hover:text-white inline-flex items-center gap-1 shrink-0">
                              <RotateCcw className="w-3 h-3" /> Reset to website text
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
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
                    {row ? (
                      <p className="text-[12px] mt-1 text-emerald-300/90 inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        {row.link_url ? "Linked" : row.file_name}{row.size_bytes ? ` · ${kb(row.size_bytes)}` : ""} · {when(row.updated_at)}
                      </p>
                    ) : (
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
                    <Button size="sm" onClick={() => fileInputs.current[doc.key]?.click()} disabled={busy} className="text-white" style={{ backgroundColor: NLA_RED }}>
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
