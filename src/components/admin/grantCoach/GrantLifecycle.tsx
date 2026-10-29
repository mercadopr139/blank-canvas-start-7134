// Where this grant stands (Josh, 2026-10-24), in his order: Applying →
// Submitted → Awarded (Active) or Declined → reporting → Closed → Apply again.
// Awarded asks "Did the requirements change, or are they as written in the
// RFP?" — as written, the funder brief's reporting rules become the reporting
// checklist; changed, Grant Coach reads the award letter instead.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Send, Trophy, XCircle, Lock, RotateCcw, Loader2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { officeText, readsAsText } from "@/lib/grantCoach/readOffice";
import { planReporting, type DraftFolder, type FunderBrief } from "@/lib/grantCoach/writer";
import { nextYearName, plusYear, saveReports, type FolderStatus, type GrantReport } from "@/lib/grantCoach/lifecycle";
import type { ConfirmAsk, PromptAsk } from "@/components/admin/AskDialog";

export interface LifecycleFolder {
  id: string; name: string; funder: string; program_name: string | null; status: string; due_at: string | null;
  amount_requested: number | null; amount_awarded: number | null; period_start: string | null; period_end: string | null;
  portal_url: string | null; notes: string | null; template_key: string | null;
  funder_brief?: FunderBrief | null;
  submitted_at?: string | null; decided_at?: string | null; closed_at?: string | null; decline_reason?: string | null;
  reporting_basis?: "as_written" | "changed" | null; applied_from?: string | null;
}
export interface LifecycleDoc { id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null; link_url: string | null }
interface Item { section: string; label: string; detail: string | null; kind: string; required: boolean; status: string; answer: string | null; sort_order: number; limit_kind?: string | null; limit_value?: number | null; owner?: string | null }

const STEPS: { key: FolderStatus; label: string }[] = [
  { key: "applying", label: "Applying" },
  { key: "submitted", label: "Submitted" },
  { key: "active", label: "Awarded" },
  { key: "closed", label: "Closed" },
];

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "");
const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";
const docPath = (folderId: string, fileName: string) => `grants/${folderId}/${Date.now()}_${fileName.replace(/[^\w.-]+/g, "_").slice(0, 80)}`;

/** The award letter as the writer reads it: PDFs and images by path, Word/Excel as text. */
async function awardPayload(docs: LifecycleDoc[]) {
  const out: { title: string; path?: string; text?: string }[] = [];
  for (const d of docs) {
    if (!d.storage_path) continue;
    const name = d.file_name ?? d.storage_path;
    if (readsAsText(name)) {
      const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).download(d.storage_path);
      if (error || !data) throw new Error(`Couldn't open ${d.title}: ${error?.message ?? "no file"}`);
      out.push({ title: d.title, text: await officeText(name, data) });
    } else out.push({ title: d.title, path: d.storage_path });
  }
  return out;
}

export default function GrantLifecycle({ folder, draftFolder, items, docs, reports, userId, ask, onChanged }: {
  folder: LifecycleFolder;
  draftFolder: () => DraftFolder;
  items: Item[];
  docs: LifecycleDoc[];
  reports: GrantReport[];
  userId: string | null;
  ask: { confirm: (a: ConfirmAsk) => Promise<boolean>; prompt: (a: PromptAsk) => Promise<Record<string, string> | null> };
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = folder.status as FolderStatus;
  const [busy, setBusy] = useState<string | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);

  const patch = async (p: Record<string, unknown>) => {
    const { error } = await supabase.from("grant_folders" as never).update({ ...p, updated_at: new Date().toISOString() } as never).eq("id", folder.id);
    if (error) throw new Error(error.message);
    onChanged();
  };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const live = items.filter((i) => i.status !== "na");
  const open = live.filter((i) => i.status !== "done").length;

  const submit = () => run("submit", async () => {
    const ok = await ask.confirm({
      title: "Mark this application submitted?",
      body: open
        ? `${open} question${open === 1 ? " is" : "s are"} not approved yet. Mark it submitted only once it's in the funder's portal. Print your answers first so the folder keeps NLA's copy.`
        : "Only once it's in the funder's portal. Print your answers first so the folder keeps NLA's copy.",
      confirmLabel: "It's submitted",
    });
    if (!ok) return;
    await patch({ status: "submitted", submitted_at: new Date().toISOString() });
    toast.success("Submitted. Grant Coach waits with you; mark it Awarded or Declined when you hear.");
  });

  const decline = () => run("decline", async () => {
    const got = await ask.prompt({
      title: "Declined",
      body: "What did they say? Their feedback is kept here and read before the next application to this funder.",
      fields: [{ key: "reason", label: "Their feedback, or the reason (optional)", placeholder: "e.g. strong fit, but funds went to first-time grantees this round" }],
      confirmLabel: "Mark declined",
    });
    if (!got) return;
    await patch({ status: "declined", decided_at: new Date().toISOString(), decline_reason: got.reason?.trim() || null });
    toast.success("Marked declined. Their feedback is kept for next time.");
  });

  const unsubmit = () => run("unsubmit", async () => {
    if (!(await ask.confirm({ title: "Back to applying?", body: "The folder goes back to Applying. Nothing in it is lost.", confirmLabel: "Back to applying" }))) return;
    await patch({ status: "applying", submitted_at: null });
  });

  const reopen = () => run("reopen", async () => {
    if (!(await ask.confirm({ title: "Undo the decision?", body: "The folder goes back to Submitted. Reports already planned stay.", confirmLabel: "Back to submitted" }))) return;
    await patch({ status: "submitted", decided_at: null, decline_reason: null });
  });

  const left = reports.filter((r) => r.status !== "submitted").length;
  const close = () => run("close", async () => {
    const ok = await ask.confirm({
      title: "Close this grant?",
      body: left ? `${left} report${left === 1 ? " is" : "s are"} not marked submitted yet. Close only when the final report is filed.` : "The final report is filed. The folder closes and stays as NLA's record. Apply again starts next year's.",
      confirmLabel: "Close the grant",
    });
    if (!ok) return;
    await patch({ status: "closed", closed_at: new Date().toISOString() });
    toast.success("Closed. Apply again whenever the next round opens.");
  });

  /* Apply again: next year's folder, the same funder, every question carried over with this year's answer as a draft to review. */
  const applyAgain = () => run("again", async () => {
    const ok = await ask.confirm({
      title: "Apply again?",
      body: "Grant Coach starts next year's folder: same funder and program, every question carried over with this year's answer as a draft for you to review. The funder's new RFP and screens still need uploading; their documents change every year.",
      confirmLabel: "Start next year's folder",
    });
    if (!ok) return;
    const nextDue = folder.due_at ? new Date(new Date(folder.due_at).getTime() + 365 * 86_400_000).toISOString() : null;
    const { data, error } = await supabase.from("grant_folders" as never).insert({
      name: nextYearName(folder.name), funder: folder.funder, program_name: folder.program_name, status: "applying",
      due_at: nextDue, amount_requested: folder.amount_requested, period_start: plusYear(folder.period_start), period_end: plusYear(folder.period_end),
      portal_url: folder.portal_url, notes: [folder.decline_reason ? `Last time they said: ${folder.decline_reason}` : null, folder.notes].filter(Boolean).join("\n\n") || null,
      template_key: folder.template_key, applied_from: folder.id, created_by: userId,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (data as unknown as { id: string }).id;
    const rows = items.filter((i) => i.status !== "na").map((i) => ({
      folder_id: newId, section: i.section, label: i.label, detail: i.detail, kind: i.kind, required: i.required, owner: i.owner ?? null,
      sort_order: i.sort_order, limit_kind: i.limit_kind ?? null, limit_value: i.limit_value ?? null,
      answer: i.answer, answer_source: i.answer ? "memory" : null, status: i.answer ? "in_progress" : "todo",
    }));
    if (rows.length) {
      const { error: e2 } = await supabase.from("grant_checklist_items" as never).insert(rows as never);
      if (e2) throw new Error(e2.message);
    }
    qc.invalidateQueries({ queryKey: ["grant-folders"] });
    toast.success("Next year's folder is ready. Review each answer; dates and amounts may have changed.");
    navigate(`/admin/finance/grant-coach/${newId}`);
  });

  const at = STEPS.findIndex((s) => s.key === (status === "declined" ? "active" : status));

  // A strip in the folder header, not its own card (Josh, 2026-10-29): the steps
  // on the left, what happened under them, the one next action on the right.
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-[260px] space-y-2">
        {/* The steps */}
        <ol className="flex flex-wrap items-center gap-2 text-[12px]">
          {STEPS.map((s, i) => {
            const declined = status === "declined" && s.key === "active";
            const done = i < at || (i === at && status === "closed");
            const here = i === at && status !== "closed";
            return (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold ${declined ? "border-red-400/40 text-red-300" : here ? "text-black" : done ? "border-white/20 text-white/80" : "border-white/10 text-white/35"}`}
                  style={here && !declined ? { backgroundColor: GC_BLUE, borderColor: GC_BLUE } : undefined}
                >
                  {declined ? <XCircle className="w-3.5 h-3.5" /> : done ? <Check className="w-3.5 h-3.5" /> : null}
                  {declined ? "Declined" : s.label}
                </span>
                {i < STEPS.length - 1 && <span className="text-white/20">›</span>}
              </li>
            );
          })}
        </ol>

        {/* What happened, with dates */}
        <div className="text-[12px] text-white/55 space-y-0.5">
          {folder.applied_from && <p><button type="button" className="text-sky-300 hover:text-sky-200 underline underline-offset-2" onClick={() => navigate(`/admin/finance/grant-coach/${folder.applied_from}`)}>Last year's folder</button></p>}
          {folder.submitted_at && <p>Submitted {fmt(folder.submitted_at)}.</p>}
          {status === "active" || status === "closed" ? (
            <p>Awarded {fmt(folder.decided_at)}{folder.amount_awarded != null ? ` · $${Number(folder.amount_awarded).toLocaleString()}` : ""}{folder.reporting_basis ? ` · reporting ${folder.reporting_basis === "as_written" ? "as written in the RFP" : "from the award letter"}` : ""}.</p>
          ) : null}
          {status === "declined" && <p>Declined {fmt(folder.decided_at)}.{folder.decline_reason ? ` They said: "${folder.decline_reason}"` : ""}</p>}
          {folder.closed_at && <p>Closed {fmt(folder.closed_at)}.</p>}
        </div>
      </div>

      {/* The one obvious next action */}
      <div className="flex flex-wrap gap-2">
          {status === "applying" && (
            <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null} onClick={submit}>
              {busy === "submit" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />} Mark submitted
            </Button>
          )}
          {status === "submitted" && (
            <>
              <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null} onClick={() => setAwardOpen(true)}>
                <Trophy className="w-3.5 h-3.5 mr-1.5" /> Awarded
              </Button>
              <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={decline}>
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Declined
              </Button>
              <Button size="sm" variant="ghost" className="text-white/45 hover:text-white hover:bg-white/10" disabled={busy != null} onClick={unsubmit}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Not submitted yet
              </Button>
            </>
          )}
          {status === "active" && (
            <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={close}>
              {busy === "close" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Lock className="w-3.5 h-3.5 mr-1.5" />} Close the grant
            </Button>
          )}
          {(status === "declined" || status === "closed") && (
            <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null} onClick={applyAgain}>
              {busy === "again" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />} Apply again
            </Button>
          )}
          {status === "declined" && (
            <Button size="sm" variant="ghost" className="text-white/45 hover:text-white hover:bg-white/10" disabled={busy != null} onClick={reopen}>Undo</Button>
          )}
      </div>

      <AwardDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        folder={folder}
        draftFolder={draftFolder}
        docs={docs}
        userId={userId}
        onDone={() => { setAwardOpen(false); onChanged(); qc.invalidateQueries({ queryKey: ["grant-reports", folder.id] }); }}
      />
    </div>
  );
}

/* ── Awarded: the amount, the period, and how reporting is set ── */
function AwardDialog({ open, onOpenChange, folder, draftFolder, docs, userId, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; folder: LifecycleFolder; draftFolder: () => DraftFolder;
  docs: LifecycleDoc[]; userId: string | null; onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(folder.amount_requested ?? ""));
  const [start, setStart] = useState(folder.period_start ?? "");
  const [end, setEnd] = useState(folder.period_end ?? "");
  const [basis, setBasis] = useState<"as_written" | "changed" | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const files = docs.filter((d) => d.storage_path);
  const hasRules = (folder.funder_brief?.data_and_reporting?.length ?? 0) > 0;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = docPath(folder.id, file.name);
      const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const { data, error: e2 } = await supabase.from("grant_documents" as never).insert({
        folder_id: folder.id, side: "ours", title: `Award letter · ${file.name.replace(/\.[^.]+$/, "")}`, storage_path: path, file_name: file.name,
        mime_type: file.type || null, size_bytes: file.size, uploaded_by: userId,
      } as never).select("id").single();
      if (e2) throw e2;
      qc.invalidateQueries({ queryKey: ["grant-docs", folder.id] });
      setPicked((p) => new Set([...p, (data as unknown as { id: string }).id]));
      toast.success(`${file.name} added to Ours.`);
    } catch (e) { toast.error(`Couldn't upload: ${(e as Error).message}`); }
    finally { setUploading(false); }
  };

  const confirm = async () => {
    const amt = Number(String(amount).replace(/[$,\s]/g, ""));
    if (!amount.trim() || !Number.isFinite(amt) || amt <= 0) { toast.error("Enter the amount awarded."); return; }
    if (!basis) { toast.error("Choose whether the reporting requirements changed."); return; }
    if (basis === "changed" && !picked.size) { toast.error("Upload or pick the award letter."); return; }
    setWorking(true);
    try {
      const { error } = await supabase.from("grant_folders" as never).update({
        status: "active", decided_at: new Date().toISOString(), amount_awarded: amt,
        period_start: start || null, period_end: end || null, reporting_basis: basis, updated_at: new Date().toISOString(),
      } as never).eq("id", folder.id);
      if (error) throw new Error(error.message);
      // The reporting checklist: from the RFP's rules, or from the award letter.
      try {
        const award = basis === "changed" ? await awardPayload(docs.filter((d) => picked.has(d.id))) : [];
        const plan = await planReporting({ ...draftFolder(), period_start: start || null, period_end: end || null }, folder.funder_brief ?? null, award);
        const n = await saveReports(folder.id, plan.reports, userId);
        toast.success(n ? `Awarded. ${n} report${n === 1 ? "" : "s"} on the reporting checklist.` : "Awarded. No reports found in the rules; add them under Reporting.");
        if (plan.notes.length) toast(`To ask the funder: ${plan.notes.join(" · ")}`, { duration: 12000 });
      } catch (e) {
        toast.error(`Awarded, but the reporting checklist couldn't be built: ${(e as Error).message}. Build it under Reporting.`);
      }
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setWorking(false); }
  };

  const choice = (k: "as_written" | "changed", title: string, sub: string) => (
    <button
      type="button"
      onClick={() => setBasis(k)}
      className={`flex-1 rounded-xl border p-3 text-left ${basis === k ? "text-white" : "border-white/15 text-white/70 hover:bg-white/[0.04]"}`}
      style={basis === k ? { borderColor: GC_BLUE, background: `${GC_BLUE}14` } : undefined}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-white/50 mt-0.5">{sub}</p>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141416] border-white/15 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Awarded</DialogTitle>
          <DialogDescription className="text-white/55">Record the award. Grant Coach builds the reporting checklist with due dates.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 sm:col-span-1 text-[11px] text-white/50">Amount awarded
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 bg-black/40 border-white/15 text-white" />
            </label>
            <label className="text-[11px] text-white/50 col-span-3 sm:col-span-1">Grant period starts
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 bg-black/40 border-white/15 text-white" />
            </label>
            <label className="text-[11px] text-white/50 col-span-3 sm:col-span-1">Ends
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 bg-black/40 border-white/15 text-white" />
            </label>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Did the requirements change, or are they as written in the RFP?</p>
            <div className="flex gap-2">
              {choice("as_written", "As written", hasRules ? "Use the reporting rules Grant Coach read from the RFP." : "No reporting rules were read from the RFP yet; Grant Coach will find few or none.")}
              {choice("changed", "They changed", "Grant Coach reads the award letter or agreement instead.")}
            </div>
          </div>
          {basis === "changed" && (
            <div className="space-y-2">
              <p className="text-[12px] text-white/55">Pick the award letter or agreement, or upload it.</p>
              <ul className="max-h-40 overflow-auto divide-y divide-white/[0.06] rounded-lg border border-white/10">
                {files.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-white/[0.03]">
                      <input type="checkbox" checked={picked.has(d.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })} />
                      <FileText className="w-3.5 h-3.5 text-white/40" /> <span className="truncate">{d.title}</span>
                    </label>
                  </li>
                ))}
                {!files.length && <li className="px-3 py-2 text-[12px] text-white/35">No files in this folder yet.</li>}
              </ul>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
              <Button size="sm" variant="outline" className={outline} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Upload the award letter
              </Button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => onOpenChange(false)} disabled={working}>Cancel</Button>
            <Button className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} onClick={() => void confirm()} disabled={working}>
              {working ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building the reporting checklist…</> : <><Trophy className="w-4 h-4 mr-2" /> Record the award</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
