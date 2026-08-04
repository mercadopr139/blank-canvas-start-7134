import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Loader2, FileText, ChevronDown, ChevronRight, StickyNote } from "lucide-react";
import ProgramHighlightsReportSheet, { type HighlightFact } from "@/components/admin/ProgramHighlightsReportSheet";

type Attendance = { registration_id: string; excursion_id?: string | null; event_id?: string | null };

type Highlight = HighlightFact & { key: string; id: string };

// Default date window: start of the current program year (Sept 1) → today.
const defaultRange = (): { from: string; to: string } => {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // Sept = month 8
  const from = `${startYear}-09-01`;
  const to = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return { from, to };
};

async function loadAttendance(source: "Event" | "Excursion", linkCol: "event_id" | "excursion_id") {
  const pageSize = 1000;
  let from = 0;
  const all: Attendance[] = [];
  while (true) {
    const { data, error } = await (supabase.from("attendance_records") as any)
      .select(`registration_id, ${linkCol}`)
      .eq("program_source", source)
      .not(linkCol, "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Attendance[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const AdminProgramHighlights = () => {
  const { data: events = [], isLoading: evLoading } = useQuery({
    queryKey: ["highlights-events"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("program_events" as never) as any)
        .select("id, date, name, details, notes, count_attendance")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: excursions = [], isLoading: exLoading } = useQuery({
    queryKey: ["highlights-excursions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("excursions").select("id, date, name, details, notes").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: eventAtt = [], isLoading: eaLoading } = useQuery({
    queryKey: ["highlights-event-att"],
    queryFn: () => loadAttendance("Event", "event_id"),
  });
  const { data: excAtt = [], isLoading: xaLoading } = useQuery({
    queryKey: ["highlights-exc-att"],
    queryFn: () => loadAttendance("Excursion", "excursion_id"),
  });

  const countByEvent = useMemo(() => {
    const m: Record<string, number> = {};
    eventAtt.forEach((a) => { if (a.event_id) m[a.event_id] = (m[a.event_id] || 0) + 1; });
    return m;
  }, [eventAtt]);
  const countByExcursion = useMemo(() => {
    const m: Record<string, number> = {};
    excAtt.forEach((a) => { if (a.excursion_id) m[a.excursion_id] = (m[a.excursion_id] || 0) + 1; });
    return m;
  }, [excAtt]);

  const allHighlights = useMemo<Highlight[]>(() => {
    const evs: Highlight[] = events.map((e) => ({
      key: `event:${e.id}`, id: e.id, type: "event", name: e.name, date: e.date,
      details: e.details, notes: e.notes, youthCount: countByEvent[e.id] || 0, countsAttendance: !!e.count_attendance,
    }));
    const exs: Highlight[] = excursions.map((x) => ({
      key: `excursion:${x.id}`, id: x.id, type: "excursion", name: x.name, date: x.date,
      details: x.details, notes: x.notes, youthCount: countByExcursion[x.id] || 0, countsAttendance: true,
    }));
    return [...evs, ...exs];
  }, [events, excursions, countByEvent, countByExcursion]);

  const [range, setRange] = useState(defaultRange);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Newest-first timeline within the selected date window (inclusive).
  const inRange = useMemo(
    () => allHighlights
      .filter((h) => h.date >= range.from && h.date <= range.to)
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allHighlights, range],
  );

  const periodLabel = useMemo(() => {
    try {
      return `${format(parseISO(range.from), "MMM d, yyyy")} – ${format(parseISO(range.to), "MMM d, yyyy")}`;
    } catch { return "Selected period"; }
  }, [range]);

  const isLoading = evLoading || exLoading || eaLoading || xaLoading;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" /> Program Highlights
        </h1>
        <p className="text-sm text-white/50 mt-0.5">Roll up excursions 🟣 and events 🟡 across any date range into one grant-ready report.</p>
      </div>

      {/* Date range + generate */}
      <div className="flex items-end justify-between gap-3 flex-wrap rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">From</label>
            <Input type="date" value={range.from} max={range.to}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="h-9 w-40 bg-white/5 border-white/15 text-white text-sm [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">To</label>
            <Input type="date" value={range.to} min={range.from}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="h-9 w-40 bg-white/5 border-white/15 text-white text-sm [color-scheme:dark]" />
          </div>
        </div>
        <Button
          onClick={() => setReportOpen(true)}
          disabled={inRange.length === 0}
          className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white h-9"
        >
          <FileText className="w-4 h-4 mr-1.5" /> Generate Program Highlights Report{inRange.length > 0 ? ` (${inRange.length})` : ""}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-white/50 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading highlights…
        </div>
      ) : inRange.length === 0 ? (
        <div className="py-16 text-center text-white/40">No excursions or events in this date range. Widen the dates above.</div>
      ) : (
        <div className="relative pl-4">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-2">
            {inRange.map((h) => {
              const expanded = expandedKey === h.key;
              const hasDetails = !!(h.details?.trim() || h.notes?.trim());
              return (
                <Fragment key={h.key}>
                  <div className="relative rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ml-4">
                    {/* Timeline dot */}
                    <span className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 ${
                      h.type === "event"
                        ? "bg-yellow-400 border-yellow-200"
                        : "bg-purple-500 border-purple-300"
                    }`} />
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 text-xs whitespace-nowrap w-24 shrink-0">{format(parseISO(h.date), "MMM d, yyyy")}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${
                        h.type === "event"
                          ? "text-yellow-200 border-yellow-500/30 bg-yellow-500/10"
                          : "text-purple-200 border-purple-500/30 bg-purple-500/10"
                      }`}>
                        {h.type === "event" ? <Sparkles className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {h.type === "event" ? "Event" : "Excursion"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : h.key)}
                        className="flex items-center gap-1.5 text-left text-white font-medium hover:text-white/80 flex-1 min-w-0"
                      >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
                        <span className="truncate">{h.name}</span>
                        {hasDetails && <StickyNote className="w-3 h-3 text-white/40 shrink-0" />}
                      </button>
                      <span className="text-xs shrink-0 text-right">
                        {h.countsAttendance
                          ? <span className="text-white/80 font-semibold">{h.youthCount} youth</span>
                          : <span className="text-white/30">Narrative</span>}
                      </span>
                    </div>
                    {expanded && (
                      <div className="mt-3 grid md:grid-cols-2 gap-4 border-t border-white/[0.06] pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Overview</p>
                          {h.details?.trim()
                            ? <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{h.details}</p>
                            : <p className="text-xs text-white/30 italic">None yet.</p>}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Debrief</p>
                          {h.notes?.trim()
                            ? <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{h.notes}</p>
                            : <p className="text-xs text-white/30 italic">None yet.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/25">
        Pick a date range, then <span className="text-white/50">Generate Report</span> for one combined, editable grant narrative you can export as a branded PDF.
      </p>

      <ProgramHighlightsReportSheet
        open={reportOpen}
        period={periodLabel}
        highlights={inRange}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
};

export default AdminProgramHighlights;
