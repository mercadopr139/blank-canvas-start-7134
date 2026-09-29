// Hawk Squad grant report — a grant-ready narrative written from the period's
// figures plus whatever the director wants featured. Hawk Squad keeps no
// journal the way Smile Lab does, so the notes box is where the real stories
// go; without it the AI writes honestly from the numbers alone.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Wand2, Copy, Check, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateHawkSquadReportPdf } from "@/lib/generateHawkSquadReportPdf";
import type { HawkPeriodStats, HawkBreakdown } from "@/lib/hawkSquad";

interface Props {
  open: boolean;
  onClose: () => void;
  period: string;
  stats: HawkPeriodStats;
  breakdown: HawkBreakdown;
}

const HawkSquadGrantReportSheet = ({ open, onClose, period, stats, breakdown }: Props) => {
  const [notes, setNotes] = useState("");
  const [narrative, setNarrative] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!open) { setNarrative(""); setReviseText(""); } }, [open]);

  const context = { period, stats, breakdown, notes };

  const generate = async () => {
    if (stats.checkIns === 0) { toast.error("No check-ins in this period yet."); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("hawk-squad-report", { body: { mode: "generate", ...context } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative((data?.narrative as string) || "");
    } catch (e) {
      toast.error((e as Error)?.message || "Couldn't generate the report.");
    } finally {
      setGenerating(false);
    }
  };

  const revise = async () => {
    if (!narrative || !reviseText.trim()) return;
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("hawk-squad-report", {
        body: { mode: "revise", narrative, instruction: reviseText.trim(), ...context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative((data?.narrative as string) || narrative);
      setReviseText("");
    } catch (e) {
      toast.error((e as Error)?.message || "Couldn't revise.");
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
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-green-400" /> Hawk Squad Grant Report</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-white/50">
          Period: <span className="text-white/80 font-semibold">{period}</span> · {stats.sessionsHeld} sessions · {stats.checkIns} check-ins · {stats.students} students
        </p>

        {!narrative ? (
          <div className="space-y-3">
            <label className="block text-sm text-white/60">
              Anything to feature? Wins, a student's story, what the group worked on. Optional, but it makes the report.
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
                placeholder="e.g. Marcus hit his first clean round on the bag · the group ran the mile together on the 14th · two students asked to join NLA full-time"
                className="mt-1.5 bg-white/5 border-white/15 text-white text-sm" />
            </label>
            <div className="py-4 text-center">
              <Button onClick={generate} disabled={generating} className="bg-green-600 hover:bg-green-500 text-black font-semibold gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {generating ? "Writing…" : "Generate report"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[280px] bg-white/5 border-white/15 text-white text-sm leading-relaxed" />

            <div className="flex flex-col sm:flex-row gap-2">
              <input value={reviseText} onChange={(e) => setReviseText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") revise(); }}
                placeholder="Tweak it — e.g. make it shorter · lean on the partnership · add a warm closing line"
                className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30" />
              <Button onClick={revise} disabled={revising || !reviseText.trim()} className="bg-green-600 hover:bg-green-500 text-black font-semibold gap-2">
                {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Revise
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={copy} className="gap-2 bg-transparent border-white/20 text-white/80">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" onClick={() => generateHawkSquadReportPdf(narrative, period)} className="gap-2 bg-transparent border-white/20 text-white/80">
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

export default HawkSquadGrantReportSheet;
