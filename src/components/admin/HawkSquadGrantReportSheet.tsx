// Hawk Squad report — a letter to Cape May Tech or a grant narrative, written
// from the period's figures, who the students are, and the highlights Josh
// adds. Before anything is generated the sheet shows exactly what the writer
// will be given, so the numbers in the report are never a surprise.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Wand2, Copy, Check, FileDown, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateHawkSquadReportPdf } from "@/lib/generateHawkSquadReportPdf";
import { HAWK_BRAND, type HawkPeriodStats, type HawkBreakdown } from "@/lib/hawkSquad";

interface Props {
  open: boolean;
  onClose: () => void;
  period: string;
  stats: HawkPeriodStats;
  breakdown: HawkBreakdown;
}

type Format = "letter" | "narrative";

const HawkSquadGrantReportSheet = ({ open, onClose, period, stats, breakdown }: Props) => {
  const [format, setFormat] = useState<Format>("letter");
  const [recipient, setRecipient] = useState("");
  const [highlights, setHighlights] = useState("");
  const [narrative, setNarrative] = useState("");
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (!open) { setNarrative(""); setReviseText(""); } }, [open]);

  const context = { period, stats, breakdown, highlights, format, recipient };

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

  const gold = HAWK_BRAND.gold;
  const breakdownRows = Object.entries(breakdown)
    .map(([label, counts]) => [label, Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`).join(", ")] as const)
    .filter(([, v]) => v);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0b0f1a] border-white/10 text-white max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 text-xs font-black tracking-widest" style={{ backgroundColor: HAWK_BRAND.green, color: gold }}>HAWK SQUAD</span>
            Report
          </DialogTitle>
        </DialogHeader>

        {!narrative ? (
          <div className="space-y-4">
            {/* Format */}
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "letter", label: "Letter to Cape May Tech", sub: "Like the mid-year report — letterhead, address, signed by Josh", Icon: Mail },
                { key: "narrative", label: "Grant narrative", sub: "Paragraphs for a funder, no salutation", Icon: FileText },
              ] as const).map(({ key, label, sub, Icon }) => (
                <button key={key} onClick={() => setFormat(key)}
                  className={`text-left rounded-lg border p-3 transition-colors ${format === key ? "border-green-400/60 bg-green-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                  <p className="text-sm font-semibold flex items-center gap-1.5"><Icon className="h-4 w-4" /> {label}</p>
                  <p className="text-[11px] text-white/45 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
            {format === "letter" && (
              <label className="block text-sm text-white/60">
                Addressed to <span className="text-white/35">(optional — e.g. Kristen; otherwise "To Cape May Tech Administration")</span>
                <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Name, title"
                  className="mt-1.5 bg-white/5 border-white/15 text-white text-sm" />
              </label>
            )}

            {/* What the writer will be given */}
            <div className="rounded-lg border p-3 text-sm" style={{ borderColor: `${gold}55`, backgroundColor: `${HAWK_BRAND.green}33` }}>
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: gold }}>What the report will use · {period}</p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
                {[
                  ["Sessions held", `${stats.sessionsHeld}${stats.sessionsPlanned ? ` of ${stats.sessionsPlanned}` : ""}`],
                  ["Check-ins", stats.checkIns], ["Students", stats.students], ["Avg / session", stats.avgPerSession],
                  ["Bus", stats.bus], ["Dismissed", stats.dismissed],
                ].map(([l, v]) => (
                  <div key={String(l)}><span className="text-white/45">{l}:</span> <span className="font-semibold">{v}</span></div>
                ))}
              </div>
              {breakdownRows.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-0.5 text-xs">
                  {breakdownRows.map(([l, v]) => <p key={l}><span className="text-white/45">{l}:</span> {v}</p>)}
                </div>
              )}
              <p className="text-[11px] text-white/35 mt-2">Change the period on the Intelligence page to change these.</p>
            </div>

            {/* Highlights */}
            <label className="block text-sm text-white/60">
              Key highlights &amp; special moments <span className="text-white/35">(one per line — a student's win, a teacher's call, what the group did)</span>
              <Textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={5}
                placeholder={"Ms. Chin called to say Marcus's behavior has turned around\nThe group ran the mile together on the 14th\nTwo students asked to join the 5:15 evening program"}
                className="mt-1.5 bg-white/5 border-white/15 text-white text-sm" />
            </label>

            <div className="py-2 text-center">
              <Button onClick={generate} disabled={generating} className="font-bold gap-2" style={{ backgroundColor: HAWK_BRAND.green, color: gold }}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {generating ? "Writing…" : format === "letter" ? "Write the letter" : "Write the narrative"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea value={narrative} onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[320px] bg-white/5 border-white/15 text-white text-sm leading-relaxed" />

            <div className="flex flex-col sm:flex-row gap-2">
              <input value={reviseText} onChange={(e) => setReviseText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") revise(); }}
                placeholder="Tweak it — e.g. make it shorter · lean on the partnership · mention the evening program more"
                className="flex-1 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30" />
              <Button onClick={revise} disabled={revising || !reviseText.trim()} className="font-bold gap-2" style={{ backgroundColor: HAWK_BRAND.green, color: gold }}>
                {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Revise
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={copy} className="gap-2 bg-transparent border-white/20 text-white/80">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" onClick={() => generateHawkSquadReportPdf(narrative, { format, period, stats, breakdown })} className="gap-2 bg-transparent border-white/20 text-white/80">
                <FileDown className="h-4 w-4" /> Download branded PDF
              </Button>
              <Button variant="ghost" onClick={() => setNarrative("")} className="gap-2 text-white/50 hover:text-white ml-auto">
                <Sparkles className="h-4 w-4" /> Start over
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HawkSquadGrantReportSheet;
