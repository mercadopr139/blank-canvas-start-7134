import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileDown, Sparkles, Wand2, RefreshCw } from "lucide-react";
import { downloadCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";

type Step = { sql: string; rowCount: number | null; error?: string; rows?: any[] };
type Stat = { label: string; value: string };
type ReportTable = { columns: string[]; rows: string[][] };

// The persisted draft shape (stored on the history row and reloaded on reopen).
export type SavedReport = {
  title: string;
  periodLabel: string;
  narrative: string;
  stats: Stat[];
  table: ReportTable | null;
};

export type ReportSource = {
  question: string;
  answer: string;
  steps?: Step[];
  historyId?: string;
  savedReport?: SavedReport | null;
};

interface Props {
  open: boolean;
  source: ReportSource | null;
  onClose: () => void;
  onSaved?: () => void; // called after a draft is persisted, so history refreshes
}

// A draft-report editor: Corner Coach drafts a branded report from a prior
// answer, then the operator can edit the narrative directly, prompt for AI
// revisions (which can pull new data), and download the branded PDF. The stats
// + table stay data-derived (not hand-editable) so a report can't drift from
// the real numbers. A drafted report persists on its history row, so reopening
// brings back the edited version rather than regenerating.
const CornerCoachReportSheet = ({ open, source, onClose, onSaved }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [narrative, setNarrative] = useState("");
  const [stats, setStats] = useState<Stat[]>([]);
  const [table, setTable] = useState<ReportTable | null>(null);
  const [reviseInput, setReviseInput] = useState("");
  const [revising, setRevising] = useState(false);

  // supabase-js reports non-2xx as a FunctionsHttpError whose .context is the
  // raw Response — read our JSON { error } out of it so the user sees the real
  // reason instead of "Edge Function returned a non-2xx status code".
  const extractError = async (e: any): Promise<string> => {
    try {
      const body = await e?.context?.json?.();
      if (body?.error) return body.error;
    } catch {
      /* ignore */
    }
    return e?.message || "Something went wrong. Try again.";
  };

  const applyReport = (r: any) => {
    setTitle(r.title || "Report");
    setPeriodLabel(r.period_label || r.periodLabel || "");
    setNarrative(r.narrative || "");
    setStats(Array.isArray(r.stats) ? r.stats : []);
    setTable(r.table && Array.isArray(r.table.columns) && r.table.columns.length ? r.table : null);
  };

  const generate = async () => {
    if (!source) return;
    setGenerating(true);
    setError(null);
    setReviseInput("");
    try {
      // Send only a light sample of each query's rows — the model just needs a
      // representative peek, and the full payload (up to 500 rows × many
      // queries) can exceed the edge-function request limit.
      const lightSteps = (source.steps ?? []).map((s) => ({
        sql: s.sql,
        rowCount: s.rowCount,
        rows: (s.rows ?? []).slice(0, 50),
      }));
      const { data, error } = await supabase.functions.invoke("corner-coach", {
        body: { mode: "report", question: source.question, answer: source.answer, steps: lightSteps },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      applyReport(data.report ?? {});
    } catch (e: any) {
      setError(await extractError(e));
    } finally {
      setGenerating(false);
    }
  };

  // On open: load the saved draft if this question already has one; otherwise
  // generate a fresh draft.
  useEffect(() => {
    if (!open || !source) return;
    if (source.savedReport) {
      const s = source.savedReport;
      setError(null);
      setReviseInput("");
      setTitle(s.title || "Report");
      setPeriodLabel(s.periodLabel || "");
      setNarrative(s.narrative || "");
      setStats(Array.isArray(s.stats) ? s.stats : []);
      setTable(s.table && s.table.columns?.length ? s.table : null);
      setGenerating(false);
      return;
    }
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const revise = async () => {
    const instruction = reviseInput.trim();
    if (!instruction || revising) return;
    setRevising(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("corner-coach", {
        body: { mode: "revise_narrative", report: { title, periodLabel, stats, narrative, table }, instruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data.report ?? {};
      // Narrative always updates; stats/table update when the new data changes
      // them. Title/period keep the operator's edits.
      setNarrative(r.narrative || narrative);
      if (Array.isArray(r.stats) && r.stats.length) setStats(r.stats);
      if (r.table && Array.isArray(r.table.columns) && r.table.columns.length) setTable(r.table);
      setReviseInput("");
    } catch (e: any) {
      setError(await extractError(e));
    } finally {
      setRevising(false);
    }
  };

  // Persist the current draft on its history row so it reopens as-is.
  const persist = async () => {
    if (!source?.historyId) return;
    const payload: SavedReport = { title, periodLabel, narrative, stats, table };
    await supabase.from("corner_coach_history").update({ report: payload as any }).eq("id", source.historyId);
    onSaved?.();
  };

  const download = async () => {
    await persist();
    await downloadCornerCoachReportPdf({ title, periodLabel, narrative, stats, table });
  };

  const busy = generating || revising;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#bf0f3e]" /> Report draft
          </DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="py-16 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Pulling the data and drafting your report…</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-300 text-sm">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5" onClick={generate}>
                Try again
              </Button>
              <Button variant="outline" className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Title + period */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/[0.04] border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Period (optional)</label>
                <Input
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="e.g. June 16 – July 16, 2026"
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Stat strip */}
            {stats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stats.map((s, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-center">
                    <p className="text-sm font-bold text-white truncate" title={s.value}>{s.value}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Narrative editor */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Narrative — edit directly, or ask Corner Coach to revise below</label>
              <Textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={6}
                className="bg-white/[0.04] border-white/10 text-white min-h-[120px]"
              />
            </div>

            {/* AI revise (can pull new data) */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Ask Corner Coach to revise — it can pull more data if needed</label>
                <Input
                  value={reviseInput}
                  onChange={(e) => setReviseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); revise(); } }}
                  placeholder='e.g. "add attendance consistency by demographic"'
                  disabled={revising}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600"
                />
              </div>
              <Button
                onClick={revise}
                disabled={revising || !reviseInput.trim()}
                variant="outline"
                className="border-white/10 text-zinc-200 bg-transparent hover:bg-white/5 h-10 shrink-0"
              >
                {revising ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </Button>
            </div>
            {revising && <p className="text-[11px] text-zinc-500 -mt-3">Corner Coach is checking the data and revising…</p>}

            {/* Table preview */}
            {table && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Data table — {table.rows.length} row{table.rows.length === 1 ? "" : "s"}</p>
                <div className="rounded-lg border border-white/10 overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-white/[0.04] text-zinc-400 sticky top-0">
                      <tr>
                        {table.columns.map((c, i) => (
                          <th key={i} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 50).map((row, ri) => (
                        <tr key={ri} className="border-t border-white/[0.05]">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.rows.length > 50 && (
                  <p className="text-[10px] text-zinc-600 mt-1">Preview shows the first 50; the PDF includes all {table.rows.length}.</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={generate}
                disabled={busy}
                className="text-zinc-400 hover:text-white hover:bg-white/5"
                title="Start a fresh draft from the data"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" /> Regenerate
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">
                  Cancel
                </Button>
                <Button onClick={download} disabled={busy || !title.trim()} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                  <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CornerCoachReportSheet;
