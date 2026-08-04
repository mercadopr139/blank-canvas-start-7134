import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileDown, FileText, Wand2 } from "lucide-react";
import { downloadCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";

export type EventReportSource = {
  id: string;
  name: string;
  date: string;
  details: string | null; // "Overview" — the few words that seed the narrative
  notes: string | null; // debrief
  youthCount: number;
  countsAttendance: boolean; // false = narrative-only event
  regIds: string[];
};

interface Props {
  open: boolean;
  source: EventReportSource | null;
  onClose: () => void;
}

// supabase-js reports non-2xx as a FunctionsHttpError whose .context is the raw
// Response — read our JSON { error } out so the user sees the real reason.
const extractError = async (e: any): Promise<string> => {
  try {
    const body = await e?.context?.json?.();
    if (body?.error) return body.error;
  } catch {
    /* ignore */
  }
  return e?.message || "Something went wrong. Try again.";
};

const EventReportSheet = ({ open, source, onClose }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState("");
  const [reviseInput, setReviseInput] = useState("");
  const [roster, setRoster] = useState<string[]>([]);

  const eventFacts = (s: EventReportSource) => ({
    name: s.name,
    date: format(parseISO(s.date), "MMMM d, yyyy"),
    youthCount: s.youthCount,
    countsAttendance: s.countsAttendance,
    description: s.details || "",
    debrief: s.notes || "",
  });

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      setError(null);
      setNarrative("");
      setReviseInput("");
      setRoster([]);
      try {
        // Roster names for the PDF table (best-effort; not required for the narrative).
        if (source.regIds.length > 0) {
          const { data: regs } = await supabase
            .from("youth_registrations")
            .select("id, child_first_name, child_last_name")
            .in("id", source.regIds);
          if (!cancelled && regs) {
            setRoster(
              regs
                .map((r: any) => `${r.child_first_name ?? ""} ${r.child_last_name ?? ""}`.trim())
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b))
            );
          }
        }
        const { data, error } = await supabase.functions.invoke("events-report", {
          body: { mode: "generate", event: eventFacts(source) },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (!cancelled) setNarrative(data.narrative || "");
      } catch (e: any) {
        if (!cancelled) setError(await extractError(e));
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  const revise = async () => {
    const instruction = reviseInput.trim();
    if (!instruction || revising || !source) return;
    setRevising(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("events-report", {
        body: { mode: "revise", narrative, instruction, event: eventFacts(source) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative(data.narrative || narrative);
      setReviseInput("");
    } catch (e: any) {
      setError(await extractError(e));
    } finally {
      setRevising(false);
    }
  };

  const download = async () => {
    if (!source) return;
    await downloadCornerCoachReportPdf({
      title: source.name,
      periodLabel: format(parseISO(source.date), "MMMM d, yyyy"),
      narrative,
      stats: source.countsAttendance ? [{ label: "Youth Attended", value: String(source.youthCount) }] : [],
      table: roster.length > 0 ? { columns: ["Youth at this event"], rows: roster.map((n) => [n]) } : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-yellow-400" /> Grant Report — {source?.name}
          </DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="py-16 flex flex-col items-center justify-center text-zinc-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Writing the grant narrative…</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-300 text-sm">{error}</p>
            <Button variant="outline" className="mt-4 border-white/10 text-zinc-300 bg-transparent hover:bg-white/5" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">
                {source ? format(parseISO(source.date), "MMM d, yyyy") : ""}
              </span>
              {source?.countsAttendance ? (
                <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">
                  {source?.youthCount} youth attended
                </span>
              ) : (
                <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">Narrative only</span>
              )}
              {roster.length > 0 && (
                <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">
                  {roster.length} on roster
                </span>
              )}
            </div>

            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Narrative — edit directly, or ask for a revision below</label>
              <Textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={8}
                className="bg-white/[0.04] border-white/10 text-white min-h-[160px]"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-zinc-500 mb-1 block">Ask for a revision</label>
                <Input
                  value={reviseInput}
                  onChange={(e) => setReviseInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); revise(); } }}
                  placeholder='e.g. "make it more formal" or "emphasize the skills they gained"'
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

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5">
                Cancel
              </Button>
              <Button onClick={download} disabled={!narrative.trim()} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventReportSheet;
