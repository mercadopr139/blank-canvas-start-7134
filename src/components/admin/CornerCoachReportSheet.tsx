import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileDown, Sparkles, Wand2 } from "lucide-react";
import { downloadCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";

type Step = { sql: string; rowCount: number | null; error?: string; rows?: any[] };
type Stat = { label: string; value: string };
type ReportTable = { columns: string[]; rows: string[][] };

export type ReportSource = { question: string; answer: string; steps?: Step[] };

interface Props {
  open: boolean;
  source: ReportSource | null;
  onClose: () => void;
}

// A draft-report editor: Corner Coach drafts a branded report from a prior
// answer, then the operator can edit the narrative directly, prompt for AI
// revisions, and download the branded PDF. The stats + table stay data-derived
// (not hand-editable) so a report can never drift from the real numbers.
const CornerCoachReportSheet = ({ open, source, onClose }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [narrative, setNarrative] = useState("");
  const [stats, setStats] = useState<Stat[]>([]);
  const [table, setTable] = useState<ReportTable | null>(null);
  const [reviseInput, setReviseInput] = useState("");
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      setError(null);
      setTitle("");
      setPeriodLabel("");
      setNarrative("");
      setStats([]);
      setTable(null);
      setReviseInput("");
      try {
        const { data, error } = await supabase.functions.invoke("corner-coach", {
          body: { mode: "report", question: source.question, answer: source.answer, steps: source.steps ?? [] },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const r = data.report ?? {};
        if (cancelled) return;
        setTitle(r.title || "Report");
        setPeriodLabel(r.period_label || "");
        setNarrative(r.narrative || "");
        setStats(Array.isArray(r.stats) ? r.stats : []);
        setTable(r.table && Array.isArray(r.table.columns) && r.table.columns.length ? r.table : null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Couldn't build the report. Try again.");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  const revise = async () => {
    const instruction = reviseInput.trim();
    if (!instruction || revising) return;
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("corner-coach", {
        body: { mode: "revise_narrative", report: { title, stats, narrative }, instruction },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative(data.narrative || narrative);
      setReviseInput("");
    } catch (e: any) {
      setError(e?.message || "Couldn't revise the narrative. Try again.");
    } finally {
      setRevising(false);
    }
  };

  const download = () =>
    downloadCornerCoachReportPdf({ title, periodLabel, narrative, stats, table });

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
            <Button variant="outline" className="mt-4 border-white/10 text-zinc-300 bg-transparent hover:bg-white/5" onClick={onClose}>
              Close
            </Button>
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

            {/* AI revise */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Ask Corner Coach to revise</label>
                <Input
                  value={reviseInput}
                  onChange={(e) => setReviseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); revise(); } }}
                  placeholder='e.g. "make it more formal" or "add a line on grant impact"'
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
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={download} disabled={!title.trim()} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CornerCoachReportSheet;
