// Grant Coach — one grant's folder: the checklist that is its spine, the
// funder's documents and NLA's, and the facts of the grant (due date,
// amount, period). Step 2 of docs/grant-coach/README.md, built lean for the
// O.C.E.A.N. 2027 deadline: the checklist is seeded from the captured form
// (src/lib/grantCoach/oceanChecklist.ts); AI extraction comes later.
import { useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Check, Circle, CircleDot, MinusCircle, Loader2, Upload, Link2, ExternalLink, Trash2, CalendarClock, ChevronDown, ChevronRight,
} from "lucide-react";
import { checklistProgress } from "@/lib/grantCoach/oceanChecklist";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";

const NLA_RED = "#bf0f3e";

interface Folder {
  id: string; name: string; funder: string; program_name: string | null; status: string; due_at: string | null;
  amount_requested: number | null; amount_awarded: number | null; period_start: string | null; period_end: string | null;
  portal_url: string | null; notes: string | null; template_key: string | null;
}
interface Item {
  id: string; folder_id: string; section: string; label: string; detail: string | null; kind: string; required: boolean;
  status: "todo" | "in_progress" | "done" | "na"; owner: string | null; due_on: string | null; answer: string | null; sort_order: number;
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
    const url = window.prompt("Link (the funder's portal, a Drive file, a web address):");
    if (!url) return;
    if (!/^https?:\/\//i.test(url.trim())) { toast.error("That doesn't look like a web address."); return; }
    const title = window.prompt("Call it:", "Link") ?? "Link";
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
    if (!window.confirm(`Remove "${d.title}" from this folder?`)) return;
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
        {folder.portal_url && (
          <a href={folder.portal_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:text-sky-200"><ExternalLink className="w-4 h-4" /> Open the funder's portal</a>
        )}
        <Textarea
          key={folder.notes ?? ""}
          defaultValue={folder.notes ?? ""}
          onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (folder.notes ?? null)) void patchFolder({ notes: v }); }}
          placeholder="Notes on this grant — who you spoke to, what they said, what to remember."
          className="mt-4 bg-neutral-950 border-neutral-800 text-white text-sm"
          rows={2}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* The checklist */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Checklist</h2>
            <p className="text-[12px] text-white/45">Tap the circle to move an item along: to do → in progress → done. Tap a row to write the answer.</p>
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
                                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (it.answer ?? null)) void patchItem(it, { answer: v }); }}
                                placeholder={it.kind === "narrative" ? "The answer, as it will go in the form." : it.kind === "upload" ? "Where the file is, or a note." : "The value, or a note."}
                                rows={it.kind === "narrative" ? 6 : 2}
                                className="bg-neutral-950 border-neutral-800 text-white text-sm"
                              />
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

        {/* Documents */}
        <aside className="space-y-3">
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
    </div>
  );
};

export default AdminGrantFolder;
