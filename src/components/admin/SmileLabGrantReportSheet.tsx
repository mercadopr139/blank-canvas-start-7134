import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Loader2, Sparkles, Wand2, Copy, Check, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateSmileLabReportPdf } from "@/lib/generateSmileLabReportPdf";

interface Props { open: boolean; onClose: () => void }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type PresetKey = "this-month" | "last-month" | "last-3" | "all" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "last-3", label: "Last 3 months" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

const fmtDay = (d: string) => format(new Date(d + "T00:00:00"), "MMM d, yyyy");

const rangeFor = (key: PresetKey, customFrom: string, customTo: string): { from: string; to: string; label: string } => {
  const now = new Date();
  if (key === "custom") {
    const from = customFrom || iso(startOfMonth(now));
    const to = customTo || iso(now);
    return { from, to, label: `${fmtDay(from)} – ${fmtDay(to)}` };
  }
  if (key === "last-month") { const m = subMonths(now, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), label: format(m, "MMMM yyyy") }; }
  if (key === "last-3") { return { from: iso(startOfMonth(subMonths(now, 2))), to: iso(endOfMonth(now)), label: `${format(subMonths(now, 2), "MMM")} – ${format(now, "MMM yyyy")}` }; }
  if (key === "all") { return { from: "2020-01-01", to: iso(now), label: "All time" }; }
  return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)), label: format(now, "MMMM yyyy") };
};

const SmileLabGrantReportSheet = ({ open, onClose }: Props) => {
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [narrative, setNarrative] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [copied, setCopied] = useState(false);
  const [ctx, setCtx] = useState<{ period: string; stats: any; journals: any[] } | null>(null);

  useEffect(() => { if (!open) { setNarrative(""); setReviseText(""); setCtx(null); } }, [open]);

  const gather = async () => {
    const { from, to, label } = rangeFor(preset, customFrom, customTo);
    const { data: sessions } = await (supabase.from("smile_lab_sessions" as never) as any)
      .select("session_date, caring_note, sharing_note, highlights")
      .gte("session_date", from).lte("session_date", to).order("session_date");
    const journals = ((sessions as any[]) ?? [])
      .filter((s) => s.caring_note?.trim() || s.sharing_note?.trim() || (Array.isArray(s.highlights) && s.highlights.length))
      .map((s) => ({ date: format(new Date(s.session_date + "T00:00:00"), "MMMM d, yyyy"), caring: s.caring_note, sharing: s.sharing_note, standouts: s.highlights ?? [] }));

    const { data: att } = await supabase.from("attendance_records")
      .select("check_in_date, registration_id").eq("program_source", "Smile Lab").gte("check_in_date", from).lte("check_in_date", to);
    const rows = (att as any[]) ?? [];
    const stats = {
      sessions: new Set(rows.map((r) => r.check_in_date)).size,
      checkIns: rows.length,
      uniqueKids: new Set(rows.map((r) => r.registration_id)).size,
    };
    return { from, to, label, journals, stats };
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const g = await gather();
      if (!g.journals.length && g.stats.checkIns === 0) {
        toast.error("No journals or attendance in this period yet.");
        setGenerating(false);
        return;
      }
      const context = { period: g.label, stats: g.stats, journals: g.journals };
      const { data, error } = await supabase.functions.invoke("smile-lab-report", { body: { mode: "generate", ...context } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative((data?.narrative as string) || "");
      setCtx(context);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't generate the report.");
    } finally {
      setGenerating(false);
    }
  };

  const revise = async () => {
    if (!narrative || !reviseText.trim() || !ctx) return;
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("smile-lab-report", {
        body: { mode: "revise", narrative, instruction: reviseText.trim(), ...ctx },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative((data?.narrative as string) || narrative);
      setReviseText("");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't revise.");
    } finally {
      setRevising(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0b0f1a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-teal-300" /> Smile Lab Grant Report</DialogTitle>
        </DialogHeader>

        {/* Period */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => setPreset(p.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${preset === p.key ? "bg-teal-500 text-black border-teal-500 font-semibold" : "bg-white/5 border-white/15 text-white/70 hover:text-white"}`}>
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-white/60 flex items-center gap-2">
              From
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
            <label className="text-sm text-white/60 flex items-center gap-2">
              To
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
          </div>
        )}

        {!narrative ? (
          <div className="py-8 text-center">
            <p className="text-white/50 text-sm mb-4">Generate a grant-ready narrative from the coaches' journals + attendance for the selected period.</p>
            <Button onClick={generate} disabled={generating} className="bg-teal-600 hover:bg-teal-500 text-black font-semibold gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? "Writing…" : "Generate report"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[280px] bg-white/5 border-white/15 text-white text-sm leading-relaxed" />

            <div className="flex flex-col sm:flex-row gap-2">
              <input value={reviseText} onChange={(e) => setReviseText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") revise(); }}
                placeholder="Tweak it — e.g. make it shorter · emphasize character growth · add a warm closing line"
                className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30" />
              <Button onClick={revise} disabled={revising || !reviseText.trim()} className="bg-teal-600 hover:bg-teal-500 text-black font-semibold gap-2">
                {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Revise
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={copy} className="gap-2 border-white/20 text-white/80">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" onClick={() => generateSmileLabReportPdf(narrative, ctx?.period || "")} className="gap-2 border-white/20 text-white/80">
                <FileDown className="h-4 w-4" /> Download PDF
              </Button>
              <Button variant="ghost" onClick={generate} disabled={generating} className="gap-2 text-white/50 hover:text-white ml-auto">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Regenerate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SmileLabGrantReportSheet;
