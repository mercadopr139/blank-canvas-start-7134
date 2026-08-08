import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileDown, FileText, Wand2, Users, Eye, RefreshCw } from "lucide-react";
import { downloadCornerCoachReportPdf, previewCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";
import { summarizeMinority } from "@/lib/demographics";

// One grant-report pop-up shared by Excursion Intelligence and Events
// Intelligence — they were ~90% duplicate components. The only differences
// (which engine to call, an accent color, the roster label, the revision
// placeholder) live in the small `config` below, so both surfaces stay
// pixel-identical to how they worked before while sharing one implementation.
// Program Highlights and Corner Coach are deliberately NOT touched.

export type ActivityReportSource = {
  id: string;
  name: string;
  date: string;
  details: string | null; // "Overview" — the few words that seed the narrative
  notes: string | null; // debrief
  youthCount: number;
  regIds: string[];
  /** Real stories staff starred on the trip/event — featured in the narrative. */
  standouts?: string[];
  /** Events only. Omitted for excursions (which always count attendance). */
  countsAttendance?: boolean;
};

export type ActivityReportConfig = {
  functionName: string; // "excursion-report" | "events-report"
  factsKey: string; // "trip" | "event"
  accentClass: string; // header icon color
  rosterColumn: string; // PDF roster table column
  revisePlaceholder: string;
};

export const EXCURSION_REPORT_CONFIG: ActivityReportConfig = {
  functionName: "excursion-report",
  factsKey: "trip",
  accentClass: "text-purple-400",
  rosterColumn: "Youth on this trip",
  revisePlaceholder: 'e.g. "make it more formal" or "emphasize the youth we reached"',
};

export const EVENT_REPORT_CONFIG: ActivityReportConfig = {
  functionName: "events-report",
  factsKey: "event",
  accentClass: "text-yellow-400",
  rosterColumn: "Youth at this event",
  revisePlaceholder: 'e.g. "make it more formal" or "emphasize the skills they gained"',
};

// The "Youth Reached" snapshot — who this trip/event reached, for funders.
// Total is a headcount; everything else is a percentage (cleaner for funders).
type YouthReached = {
  total: number;
  belowPovertyPct: number;
  minorityPct: number;
  boysPct: number;
  girlsPct: number;
  races: { label: string; pct: number }[];
};

// Which parts of the breakdown to include — each is a checkbox.
type YrParts = { poverty: boolean; minority: boolean; gender: boolean; race: boolean };
const ALL_PARTS: YrParts = { poverty: true, minority: true, gender: true, race: true };

const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];

// Session cache so reopening a report shows what you last left — narrative,
// your edits, and your checkbox choices — instead of rewriting from scratch.
// Keyed by engine + source id. Lives for the browser session (until reload).
type CacheEntry = {
  narrative: string;
  roster: string[];
  youthReached: YouthReached | null;
  includeYR: boolean;
  yrParts: YrParts;
};
const reportCache: Record<string, CacheEntry> = {};

const summarizeYouthReached = (regs: any[]): YouthReached => {
  const total = regs.length;
  let below = 0;
  const sex: Record<string, number> = {};
  const race: Record<string, number> = {};
  regs.forEach((r) => {
    if (POVERTY_INCOMES.includes(r.household_income_range) || r.free_or_reduced_lunch === "Yes") below++;
    const s = r.child_sex || "Unknown";
    sex[s] = (sex[s] || 0) + 1;
    if (r.child_race_ethnicity) race[r.child_race_ethnicity] = (race[r.child_race_ethnicity] || 0) + 1;
  });
  const { minorityPct } = summarizeMinority(regs.map((r) => r.child_race_ethnicity));
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    total,
    belowPovertyPct: pct(below),
    minorityPct,
    boysPct: pct(sex["Male"] || 0),
    girlsPct: pct(sex["Female"] || 0),
    races: Object.entries(race).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, pct: pct(count) })),
  };
};

// Build the payload sent to the AI: total always, the rest per checkbox.
const buildYrPayload = (include: boolean, parts: YrParts, yr: YouthReached | null): any | null => {
  if (!include || !yr) return null;
  const out: any = { total: yr.total };
  if (parts.poverty) out.belowPovertyPct = yr.belowPovertyPct;
  if (parts.minority) out.minorityPct = yr.minorityPct;
  if (parts.gender) { out.boysPct = yr.boysPct; out.girlsPct = yr.girlsPct; }
  if (parts.race) out.races = yr.races;
  return out;
};

interface Props {
  open: boolean;
  source: ActivityReportSource | null;
  config: ActivityReportConfig;
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

const ActivityReportSheet = ({ open, source, config, onClose }: Props) => {
  const [generating, setGenerating] = useState(false);
  const [revising, setRevising] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState("");
  const [reviseInput, setReviseInput] = useState("");
  const [roster, setRoster] = useState<string[]>([]);
  const [youthReached, setYouthReached] = useState<YouthReached | null>(null);
  const [includeYR, setIncludeYR] = useState(false);
  const [yrParts, setYrParts] = useState<YrParts>(ALL_PARTS);

  const cacheKey = source ? `${config.functionName}:${source.id}` : "";

  // Excursions never set countsAttendance and always count; events set it explicitly.
  const counts = source ? source.countsAttendance !== false : true;
  const hasRoster = !!youthReached && youthReached.total > 0;

  const facts = (s: ActivityReportSource, yrPayload: any | null) => ({
    name: s.name,
    date: format(parseISO(s.date), "MMMM d, yyyy"),
    youthCount: s.youthCount,
    description: s.details || "",
    debrief: s.notes || "",
    ...(s.standouts && s.standouts.length ? { standouts: s.standouts } : {}),
    ...(s.countsAttendance !== undefined ? { countsAttendance: s.countsAttendance } : {}),
    ...(yrPayload ? { youthReached: yrPayload } : {}),
  });

  const runGenerate = async (s: ActivityReportSource, yrPayload: any | null) => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(config.functionName, {
        body: { mode: "generate", [config.factsKey]: facts(s, yrPayload) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setNarrative(data.narrative || "");
    } catch (e: any) {
      setError(await extractError(e));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!open || !source) return;

    // Reopening a report we've already written? Restore exactly what was left —
    // narrative, edits, and checkbox choices — with no rewrite.
    const cached = reportCache[cacheKey];
    if (cached) {
      setNarrative(cached.narrative);
      setRoster(cached.roster);
      setYouthReached(cached.youthReached);
      setIncludeYR(cached.includeYR);
      setYrParts(cached.yrParts);
      setReviseInput("");
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setNarrative("");
      setReviseInput("");
      setRoster([]);
      setYouthReached(null);
      setError(null);
      setIncludeYR(false);
      setYrParts(ALL_PARTS);
      let yr: YouthReached | null = null;
      if (source.regIds.length > 0) {
        const { data: regs } = await supabase
          .from("youth_registrations")
          .select("id, child_first_name, child_last_name, child_race_ethnicity, child_sex, household_income_range, free_or_reduced_lunch")
          .in("id", source.regIds);
        if (!cancelled && regs) {
          setRoster(
            regs
              .map((r: any) => `${r.child_first_name ?? ""} ${r.child_last_name ?? ""}`.trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b))
          );
          yr = summarizeYouthReached(regs);
          setYouthReached(yr);
        }
      }
      if (cancelled) return;
      await runGenerate(source, buildYrPayload(false, ALL_PARTS, yr));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source]);

  // Keep the session cache in step with what's on screen, so closing and
  // reopening lands you right back where you were.
  useEffect(() => {
    if (!open || !source) return;
    reportCache[cacheKey] = { narrative, roster, youthReached, includeYR, yrParts };
  }, [open, source, cacheKey, narrative, roster, youthReached, includeYR, yrParts]);

  // Toggling the master or any part re-generates the narrative to match.
  const toggleMaster = (checked: boolean) => {
    setIncludeYR(checked);
    if (source) runGenerate(source, buildYrPayload(checked, yrParts, youthReached));
  };
  const togglePart = (key: keyof YrParts, checked: boolean) => {
    const next = { ...yrParts, [key]: checked };
    setYrParts(next);
    if (source && includeYR) runGenerate(source, buildYrPayload(true, next, youthReached));
  };

  // Explicit "update" — writes a fresh narrative from scratch on demand.
  const regenerate = () => {
    if (source) runGenerate(source, buildYrPayload(includeYR, yrParts, youthReached));
  };

  const revise = async () => {
    const instruction = reviseInput.trim();
    if (!instruction || revising || !source) return;
    setRevising(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke(config.functionName, {
        body: { mode: "revise", narrative, instruction, [config.factsKey]: facts(source, buildYrPayload(includeYR, yrParts, youthReached)) },
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

  const pdfData = () => {
    if (!source) return null;
    const stats: { label: string; value: string }[] = [];
    if (counts) stats.push({ label: "Total Youth", value: String(source.youthCount) });
    if (includeYR && youthReached) {
      if (yrParts.poverty) stats.push({ label: "Below Poverty Line", value: `${youthReached.belowPovertyPct}%` });
      if (yrParts.minority) stats.push({ label: "Minority", value: `${youthReached.minorityPct}%` });
      if (yrParts.gender) stats.push({ label: "Boys / Girls", value: `${youthReached.boysPct}% / ${youthReached.girlsPct}%` });
    }
    return {
      title: source.name,
      periodLabel: format(parseISO(source.date), "MMMM d, yyyy"),
      narrative,
      stats,
      table: roster.length > 0 ? { columns: [config.rosterColumn], rows: roster.map((n) => [n]) } : null,
    };
  };

  const preview = async () => {
    const data = pdfData();
    if (!data) return;
    setPdfBusy(true);
    try {
      await previewCornerCoachReportPdf(data);
    } finally {
      setPdfBusy(false);
    }
  };

  const download = async () => {
    const data = pdfData();
    if (!data) return;
    setPdfBusy(true);
    try {
      await downloadCornerCoachReportPdf(data);
    } finally {
      setPdfBusy(false);
    }
  };

  const partOptions: { key: keyof YrParts; label: string }[] = [
    { key: "poverty", label: "Below poverty" },
    { key: "minority", label: "Minority" },
    { key: "gender", label: "Boy / Girl" },
    { key: "race", label: "Race/Ethnicity" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className={`w-4 h-4 ${config.accentClass}`} /> Grant Report — {source?.name}
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
              {counts ? (
                <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">
                  {source?.youthCount} youth
                </span>
              ) : (
                <span className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/10">Narrative only</span>
              )}
            </div>

            {/* Opt-in: fold the "Youth Reached" breakdown into the report for funders. */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  checked={includeYR}
                  onCheckedChange={(v) => toggleMaster(v === true)}
                  disabled={!hasRoster}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-[#bf0f3e] data-[state=checked]:border-[#bf0f3e]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" /> Include the “Youth Reached” breakdown
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Total youth shows as a number; everything you pick below shows as a percentage.
                    {!hasRoster ? " (No roster on this one yet.)" : ""}
                  </p>
                </div>
              </label>

              {includeYR && hasRoster && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-7 pt-1 border-t border-white/5">
                  {partOptions.map((p) => (
                    <label key={p.key} className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <Checkbox
                        checked={yrParts[p.key]}
                        onCheckedChange={(v) => togglePart(p.key, v === true)}
                        className="h-3.5 w-3.5 border-white/30 data-[state=checked]:bg-[#bf0f3e] data-[state=checked]:border-[#bf0f3e]"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-500">Narrative — edit directly, or ask for a revision below</label>
                <button
                  type="button"
                  onClick={regenerate}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                  title="Write a fresh narrative from scratch"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
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
                  placeholder={config.revisePlaceholder}
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
              <Button
                variant="outline"
                onClick={preview}
                disabled={pdfBusy || !narrative.trim()}
                className="border-white/10 text-zinc-200 bg-transparent hover:bg-white/5"
              >
                {pdfBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />} Preview
              </Button>
              <Button onClick={download} disabled={pdfBusy || !narrative.trim()} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white">
                <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ActivityReportSheet;
