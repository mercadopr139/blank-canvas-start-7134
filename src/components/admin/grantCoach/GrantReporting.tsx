// Reporting (Josh, 2026-10-24): "works like applying, pointed at the
// reporting document". Each report on the checklist has its period and due
// date; Draft pulls that period's numbers, reads back what the application
// promised, and writes the report. Josh edits, approves, submits, logs it.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Sparkles, Check, Send, Copy, Plus, Trash2, Loader2, RotateCcw, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { draftReport, planReporting, type DraftFolder, type FunderBrief, type LibraryEntry } from "@/lib/grantCoach/writer";
import { gatherLiveFacts } from "@/lib/grantCoach/liveFacts";
import { REPORT_KIND_LABEL, daysUntil, saveReports, type GrantReport } from "@/lib/grantCoach/lifecycle";
import { todayNY } from "@/lib/programYear";
import type { ConfirmAsk, PromptAsk } from "@/components/admin/AskDialog";

const fmtDay = (ymd: string | null) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";
const STATUS: Record<GrantReport["status"], string> = { todo: "To do", drafted: "Drafted", approved: "Approved", submitted: "Submitted" };

export default function GrantReporting({ folderId, draftFolder, funderBrief, reports, promised, library, userId, ask }: {
  folderId: string;
  draftFolder: () => DraftFolder;
  funderBrief: FunderBrief | null;
  reports: GrantReport[];
  promised: { label: string; answer: string }[];
  library: LibraryEntry[];
  userId: string | null;
  ask: { confirm: (a: ConfirmAsk) => Promise<boolean>; prompt: (a: PromptAsk) => Promise<Record<string, string> | null> };
}) {
  const qc = useQueryClient();
  const refresh = () => { qc.invalidateQueries({ queryKey: ["grant-reports"] }); };
  const [openId, setOpenId] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const today = todayNY();
  const done = reports.filter((r) => r.status === "submitted").length;

  const add = async () => {
    const got = await ask.prompt({
      title: "Add a report",
      body: "Anything the funder asked for that isn't on the list.",
      fields: [
        { key: "title", label: "Report", placeholder: "e.g. Mid-year narrative report", required: true },
        { key: "due", label: "Due date (YYYY-MM-DD)", placeholder: "2027-07-15" },
        { key: "start", label: "Period starts (YYYY-MM-DD)", placeholder: "2027-01-01" },
        { key: "end", label: "Period ends (YYYY-MM-DD)", placeholder: "2027-06-30" },
        { key: "detail", label: "What it must contain" },
      ],
      confirmLabel: "Add report",
    });
    if (!got?.title?.trim()) return;
    const ymd = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v?.trim() ?? "") ? v.trim() : null);
    const { error } = await supabase.from("grant_reports" as never).insert({
      folder_id: folderId, title: got.title.trim(), kind: "other", detail: got.detail?.trim() || null,
      due_on: ymd(got.due), period_start: ymd(got.start), period_end: ymd(got.end), sort_order: reports.length, updated_by: userId,
    } as never);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const rebuild = async () => {
    const ok = await ask.confirm({
      title: reports.length ? "Read the reporting rules again?" : "Build the reporting checklist?",
      body: reports.length
        ? "Grant Coach reads the funder brief's reporting rules again and adds any report that isn't on the list. Nothing already here changes."
        : "Grant Coach reads the funder brief's reporting rules and builds the list with due dates. If the award letter changed them, upload it to Ours first and use Awarded.",
      confirmLabel: reports.length ? "Read again" : "Build it",
    });
    if (!ok) return;
    setRebuilding(true);
    try {
      const plan = await planReporting(draftFolder(), funderBrief);
      const have = new Set(reports.map((r) => `${r.title.toLowerCase()}|${r.due_on ?? ""}`));
      const fresh = plan.reports.filter((r) => !have.has(`${r.title.toLowerCase()}|${r.due_on ?? ""}`));
      const n = await saveReports(folderId, fresh, userId);
      toast.success(n ? `${n} report${n === 1 ? "" : "s"} added.` : "Nothing new: every report the rules name is already here.");
      if (plan.notes.length) toast(`To ask the funder: ${plan.notes.join(" · ")}`, { duration: 12000 });
      refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setRebuilding(false); }
  };

  return (
    <GcCard
      icon={<ClipboardList className="w-4 h-4" />}
      title="Reporting"
      blurb={reports.length ? `${done} of ${reports.length} submitted` : "No reports on the checklist yet"}
      right={
        <>
          <Button size="sm" variant="outline" className={outline} disabled={rebuilding} onClick={() => void rebuild()}>
            {rebuilding ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />} {reports.length ? "Read the rules again" : "Build from the rules"}
          </Button>
          <Button size="sm" variant="outline" className={outline} onClick={() => void add()}><Plus className="w-3.5 h-3.5 mr-1.5" /> Add</Button>
        </>
      }
    >
      <ul className="divide-y divide-white/[0.06]">
        {reports.map((r) => (
          <ReportRow
            key={r.id}
            report={r}
            today={today}
            open={openId === r.id}
            onToggle={() => setOpenId((o) => (o === r.id ? null : r.id))}
            draftFolder={draftFolder}
            funderBrief={funderBrief}
            promised={promised}
            library={library}
            userId={userId}
            ask={ask}
            onChanged={refresh}
          />
        ))}
        {!reports.length && <li className="p-4 text-[12px] text-white/40">Build the list from the funder's reporting rules, or add each report by hand.</li>}
      </ul>
    </GcCard>
  );
}

function ReportRow({ report: r, today, open, onToggle, draftFolder, funderBrief, promised, library, userId, ask, onChanged }: {
  report: GrantReport; today: string; open: boolean; onToggle: () => void; draftFolder: () => DraftFolder; funderBrief: FunderBrief | null;
  promised: { label: string; answer: string }[]; library: LibraryEntry[]; userId: string | null;
  ask: { confirm: (a: ConfirmAsk) => Promise<boolean>; prompt: (a: PromptAsk) => Promise<Record<string, string> | null> };
  onChanged: () => void;
}) {
  const [text, setText] = useState(r.draft ?? "");
  const [gaps, setGaps] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setText(r.draft ?? ""); }, [r.draft]);
  const left = r.due_on ? daysUntil(r.due_on, today) : null;
  const late = left != null && left < 0 && r.status !== "submitted";
  const soon = left != null && left >= 0 && left <= 14 && r.status !== "submitted";

  const patch = async (p: Record<string, unknown>) => {
    const { error } = await supabase.from("grant_reports" as never).update({ ...p, updated_at: new Date().toISOString(), updated_by: userId } as never).eq("id", r.id);
    if (error) throw new Error(error.message);
    onChanged();
  };
  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const draft = () => run("draft", async () => {
    let instruction: string | undefined;
    if (text.trim()) {
      const got = await ask.prompt({ title: "Redraft this report?", body: "Grant Coach writes it again from the period's numbers. Your current draft is replaced in the box (it's not saved until you save).", fields: [{ key: "i", label: "Anything to change? (optional)" }], confirmLabel: "Redraft" });
      if (!got) return;
      instruction = got.i?.trim() || undefined;
    }
    const period = r.period_start && r.period_end ? { from: r.period_start, to: r.period_end, label: `the report period, ${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}` } : undefined;
    const facts = await gatherLiveFacts(new Date(), period);
    const out = await draftReport({ folder: draftFolder(), funderBrief, report: { title: r.title, kind: r.kind, detail: r.detail, period_start: r.period_start, period_end: r.period_end }, promised, library, facts, instruction });
    setText(out.answer);
    setGaps(out.gaps);
    await patch({ draft: out.answer, status: r.status === "submitted" ? "submitted" : "drafted" });
  }, "Drafted. Read it, fill any [NEED], then approve.");

  return (
    <li>
      <button type="button" onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03]">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{r.title}</p>
          <p className="text-[11px] text-white/45">
            {REPORT_KIND_LABEL[r.kind]}{r.period_start ? ` · ${fmtDay(r.period_start)} – ${fmtDay(r.period_end)}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.status === "submitted" ? "bg-emerald-500/15 text-emerald-300" : r.status === "approved" ? "text-black" : "bg-white/10 text-white/70"}`} style={r.status === "approved" ? { backgroundColor: GC_BLUE } : undefined}>{STATUS[r.status]}</span>
          <p className={`text-[11px] mt-0.5 ${late ? "text-red-300" : soon ? "text-amber-300" : "text-white/45"}`}>
            {r.due_on ? `Due ${fmtDay(r.due_on)}` : "No due date"}
            {r.status !== "submitted" && left != null && (late ? ` · ${-left} day${left === -1 ? "" : "s"} late` : ` · ${left} day${left === 1 ? "" : "s"}`)}
            {r.status === "submitted" && r.submitted_at ? ` · sent ${new Date(r.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}
          </p>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {r.detail && <p className="text-[12px] text-white/60 whitespace-pre-wrap"><span className="text-white/40">What it must contain: </span>{r.detail}</p>}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(24, Math.max(8, text.split("\n").length + 2))} className="bg-black/30 border-white/15 text-sm leading-relaxed" placeholder="Draft it with Grant Coach, or write it here." disabled={r.status === "submitted"} />
          {gaps.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-200">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Still needed</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {r.status !== "submitted" && (
              <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={() => void draft()}>
                {busy === "draft" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} {text.trim() ? "Redraft" : "Draft with Grant Coach"}
              </Button>
            )}
            {r.status !== "submitted" && text !== (r.draft ?? "") && (
              <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={() => void run("save", () => patch({ draft: text, status: r.status === "todo" ? "drafted" : r.status === "approved" ? "drafted" : r.status }), "Saved")}>Save</Button>
            )}
            <Button size="sm" variant="outline" className={outline} disabled={!text.trim()} onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success("Copied"), () => toast.error("Couldn't copy."))}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
            </Button>
            {(r.status === "drafted" || r.status === "todo") && (
              <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null || !text.trim()} onClick={() => void run("approve", () => patch({ draft: text, status: "approved" }), "Approved")}>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
              </Button>
            )}
            {r.status === "approved" && (
              <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null} onClick={() => void run("send", () => patch({ status: "submitted", submitted_at: new Date().toISOString() }), "Logged as submitted")}>
                <Send className="w-3.5 h-3.5 mr-1.5" /> Mark submitted
              </Button>
            )}
            {(r.status === "approved" || r.status === "submitted") && (
              <Button size="sm" variant="ghost" className="text-white/45 hover:text-white hover:bg-white/10" disabled={busy != null} onClick={() => void run("undo", () => patch({ status: r.status === "submitted" ? "approved" : "drafted", submitted_at: null }))}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Undo
              </Button>
            )}
            <button
              type="button"
              className="ml-auto text-white/30 hover:text-red-400 p-1"
              aria-label={`Remove ${r.title}`}
              onClick={() => void run("remove", async () => {
                if (!(await ask.confirm({ title: `Remove "${r.title}"?`, body: "It comes off the reporting checklist, with its draft.", confirmLabel: "Remove", danger: true }))) return;
                const { error } = await supabase.from("grant_reports" as never).delete().eq("id", r.id);
                if (error) throw new Error(error.message);
                onChanged();
              })}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
