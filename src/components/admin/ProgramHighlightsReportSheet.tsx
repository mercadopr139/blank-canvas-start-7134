import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileDown, Sparkles, Wand2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { downloadProgramHighlightsPdf, type HighlightSection } from "@/lib/generateProgramHighlightsPdf";

// A single activity feeding the combined report.
export type HighlightFact = {
  type: "event" | "excursion";
  name: string;
  date: string; // ISO
  details: string | null;
  notes: string | null;
  youthCount: number;
  countsAttendance: boolean;
};

interface Props {
  open: boolean;
  period: string; // e.g. "Sep 1, 2025 – Jun 30, 2026"
  highlights: HighlightFact[];
  onClose: () => void;
}

const extractError = async (e: any): Promise<string> => {
  try {
    const body = await e?.context?.json?.();
    if (body?.error) return body.error;
  } catch { /* ignore */ }
  return e?.message || "Something went wrong. Try again.";
};

// Split the model's output (a short intro, then `## Title` sections) into an
// intro + titled sections for the PDF.
const parseNarrative = (text: string): { intro: string; sections: HighlightSection[] } => {
  const lines = (text || "").split("\n");
  let intro = "";
  const sections: HighlightSection[] = [];
  let cur: HighlightSection | null = null;
  for (const line of lines) {
    const m = line.match(/^\s*##\s+(.*)$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1].trim(), body: "" };
    } else if (cur) {
      cur.body += line + "\n";
    } else {
      intro += line + "\n";
    }
  }
  if (cur) sections.push(cur);
  return { intro: intro.trim(), sections: sections.map((s) => ({ title: s.title, body: s.body.trim() })) };
};

// Google-Docs-friendly plain text: drop the `## ` markers so titles read as
// clean lines the user can style in Docs.
const toPlainText = (text: string, period: string): string =>
  `Program Highlights\n${period}\n\n` + (text || "").replace(/^\s*##\s+/gm, "").trim() + "\n";

const factsFor = (highlights: HighlightFact[]) =>
  highlights
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((h) => ({
      type: h.type,
      name: h.name,
      date: format(parseISO(h.date), "MMMM d, yyyy"),
      youthCount: h.youthCount,
      countsAttendance: h.countsAttendance,
      description: h.details || "",
      debrief: h.notes || "",
    }));

const ProgramHighlightsReportSheet = ({ open, period, highlights, onClose }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState("");
  const [reviseInput, setReviseInput] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const totals = useMemo(() => {
    const events = highlights.filter((h) => h.type === "event").length;
    const excursions = highlights.filter((h) => h.type === "excursion").length;
    const youth = highlights.filter((h) => h.countsAttendance).reduce((s, h) => s + (h.youthCount || 0), 0);
    return { events, excursions, youth, total: highlights.length };
  }, [highlights]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      setError(null);
      setNarrative("");
      setReviseInput("");
      try {
        const { data, error } = await supabase.functions.invoke("program-highlights-report", {
          body: { mode: "generate", period, highlights: factsFor(highlights) },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setNarrative(data.narrative || "");
      } catch (e) {
        if (!cancelled) setError(await extractError(e));
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const revise = async () => {
    const instruction = reviseInput.trim();
    if (!instruction || revising) return;
    setRevising(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("program-highlights-report", {
        body: { mode: "revise", period, narrative, instruction, highlights: factsFor(highlights) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative(data.narrative || narrative);
      setReviseInput("");
    } catch (e) {
      setError(await extractError(e));
    } finally {
      setRevising(false);
    }
  };

  const download = async () => {
    if (!narrative.trim()) return;
    setDownloading(true);
    try {
      const { intro, sections } = parseNarrative(narrative);
      await downloadProgramHighlightsPdf({ periodLabel: period, intro, sections });
    } finally {
      setDownloading(false);
    }
  };

  const copyForDocs = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(narrative, period));
      setCopied(true);
      toast.success("Copied — paste into Google Docs");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — select the text and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" /> Program Highlights Report
            <span className="text-xs font-normal text-white/40">· {period}</span>
          </DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="py-16 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Writing the combined grant narrative…</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-300 text-sm">{error}</p>
            <Button variant="outline" className="mt-4 border-white/10 text-zinc-300 bg-transparent hover:bg-white/5" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">{totals.total} activities</span>
              <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">🟣 {totals.excursions} excursions</span>
              <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">🟡 {totals.events} events</span>
              <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">{totals.youth} youth reached</span>
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                Combined narrative — edit directly, or ask for a revision below.
                <span className="text-zinc-600"> Titles are marked with <code className="text-zinc-400">##</code> — keep them so each highlight formats correctly.</span>
              </label>
              <Textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={16}
                className="bg-white/[0.04] border-white/10 text-white min-h-[320px]"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Ask for a revision</label>
                <Input
                  value={reviseInput}
                  onChange={(e) => setReviseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); revise(); } }}
                  placeholder='e.g. "make it more formal" or "lead with the Banking & Boxing event"'
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
            {revising && <p className="text-[11px] text-zinc-500 -mt-2">Revising…</p>}

            <div className="flex justify-end gap-2 pt-1 flex-wrap">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">Cancel</Button>
              <Button variant="outline" onClick={copyForDocs} disabled={!narrative.trim()} className="border-white/10 text-zinc-200 bg-transparent hover:bg-white/5">
                {copied ? <Check className="w-4 h-4 mr-1.5 text-green-400" /> : <Copy className="w-4 h-4 mr-1.5" />} Copy for Google Docs
              </Button>
              <Button onClick={download} disabled={!narrative.trim() || downloading} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileDown className="w-4 h-4 mr-1.5" />} Download PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProgramHighlightsReportSheet;
