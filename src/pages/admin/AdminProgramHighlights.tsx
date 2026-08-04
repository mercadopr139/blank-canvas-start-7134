import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Sparkles, MapPin, Loader2, FileText, ChevronDown, ChevronRight, StickyNote, History, Trash2, Pencil } from "lucide-react";
import ProgramHighlightsReportSheet, { type HighlightFact } from "@/components/admin/ProgramHighlightsReportSheet";

type Attendance = { registration_id: string; excursion_id?: string | null; event_id?: string | null };
type Highlight = HighlightFact & { key: string; id: string };
type SavedReport = {
  id: string; title: string; period_from: string; period_to: string;
  period_label: string; narrative: string; activity_count: number; created_at: string; updated_at: string;
};

// ── date helpers (browser-side; program year flips Sept 1) ──
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const pyStartYear = () => { const n = new Date(); return n.getMonth() >= 8 ? n.getFullYear() : n.getFullYear() - 1; };
const daysAgoISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); };

const PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: "this-year", label: "This program year", range: () => ({ from: `${pyStartYear()}-09-01`, to: todayISO() }) },
  { key: "last-year", label: "Last program year", range: () => { const sy = pyStartYear() - 1; return { from: `${sy}-09-01`, to: `${sy + 1}-08-31` }; } },
  { key: "last-90", label: "Last 90 days", range: () => ({ from: daysAgoISO(90), to: todayISO() }) },
  { key: "ytd", label: "Year to date", range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }) },
];

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
  const queryClient = useQueryClient();

  const { data: events = [], isLoading: evLoading } = useQuery({
    queryKey: ["highlights-events"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("program_events" as never) as any)
        .select("id, date, name, details, notes, count_attendance, highlights").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: excursions = [], isLoading: exLoading } = useQuery({
    queryKey: ["highlights-excursions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("excursions") as any).select("id, date, name, details, notes, highlights").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: eventAtt = [], isLoading: eaLoading } = useQuery({ queryKey: ["highlights-event-att"], queryFn: () => loadAttendance("Event", "event_id") });
  const { data: excAtt = [], isLoading: xaLoading } = useQuery({ queryKey: ["highlights-exc-att"], queryFn: () => loadAttendance("Excursion", "excursion_id") });

  const { data: reports = [] } = useQuery({
    queryKey: ["php-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("program_highlights_reports" as never) as any)
        .select("id, title, period_from, period_to, period_label, narrative, activity_count, created_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedReport[];
    },
  });
  const refreshReports = () => queryClient.invalidateQueries({ queryKey: ["php-reports"] });

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
      standouts: Array.isArray(e.highlights) ? e.highlights : [],
    }));
    const exs: Highlight[] = excursions.map((x) => ({
      key: `excursion:${x.id}`, id: x.id, type: "excursion", name: x.name, date: x.date,
      details: x.details, notes: x.notes, youthCount: countByExcursion[x.id] || 0, countsAttendance: true,
      standouts: Array.isArray(x.highlights) ? x.highlights : [],
    }));
    return [...evs, ...exs];
  }, [events, excursions, countByEvent, countByExcursion]);

  const factsForPeriod = (from: string, to: string): HighlightFact[] =>
    allHighlights.filter((h) => h.date >= from && h.date <= to).sort((a, b) => (a.date < b.date ? 1 : -1));

  const [preset, setPreset] = useState<string>("this-year");
  const [range, setRange] = useState(() => PRESETS[0].range());
  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setRange(p.range());
  };

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | { reportId: string | null; initialNarrative: string; period: string; from: string; to: string; highlights: HighlightFact[] }>(null);
  const [deleteReport, setDeleteReport] = useState<SavedReport | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = (r: SavedReport) => { setRenamingId(r.id); setRenameValue(r.title); };
  const saveRename = async () => {
    const id = renamingId;
    if (!id) return;
    const title = renameValue.trim() || "Untitled report";
    setRenamingId(null);
    // Renaming is metadata — update in place (it doesn't fork a new version).
    const { error } = await (supabase.from("program_highlights_reports" as never) as any)
      .update({ title }).eq("id", id);
    if (error) { toast.error("Rename failed"); return; }
    refreshReports();
  };

  const inRange = useMemo(
    () => allHighlights.filter((h) => h.date >= range.from && h.date <= range.to).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allHighlights, range],
  );
  const periodLabel = useMemo(() => {
    try { return `${format(parseISO(range.from), "MMM d, yyyy")} – ${format(parseISO(range.to), "MMM d, yyyy")}`; }
    catch { return "Selected period"; }
  }, [range]);

  const isLoading = evLoading || exLoading || eaLoading || xaLoading;

  const onGenerate = () => {
    if (inRange.length === 0) return;
    // Always create a NEW saved report, so each generation is preserved as its
    // own timestamped version — nothing is overwritten and prior (already-sent)
    // reports stay in the history for the record.
    setSheet({ reportId: null, initialNarrative: "", period: periodLabel, from: range.from, to: range.to, highlights: inRange });
  };

  const openSaved = (r: SavedReport) =>
    setSheet({ reportId: r.id, initialNarrative: r.narrative, period: r.period_label, from: r.period_from, to: r.period_to, highlights: factsForPeriod(r.period_from, r.period_to) });

  const confirmDelete = async () => {
    if (!deleteReport) return;
    const { error } = await (supabase.from("program_highlights_reports" as never) as any).delete().eq("id", deleteReport.id);
    if (error) { toast.error("Couldn't delete report"); return; }
    toast.success("Report deleted");
    setDeleteReport(null);
    refreshReports();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-400" /> Program Highlights
        </h1>
        <p className="text-sm text-white/50 mt-0.5">Roll up excursions 🟣 and events 🟡 across any date range into one grant-ready report.</p>
      </div>

      {/* Date range: presets + custom */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition ${
                preset === p.key ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-200" : "border-white/15 text-white/60 hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${preset === "custom" ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-200" : "border-white/10 text-white/30"}`}>
            Custom
          </span>
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">From</label>
              <Input type="date" value={range.from} max={range.to}
                onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
                className="h-9 w-40 bg-white/5 border-white/15 text-white text-sm [color-scheme:dark]" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">To</label>
              <Input type="date" value={range.to} min={range.from}
                onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
                className="h-9 w-40 bg-white/5 border-white/15 text-white text-sm [color-scheme:dark]" />
            </div>
          </div>
          <Button onClick={onGenerate} disabled={inRange.length === 0} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white h-9">
            <FileText className="w-4 h-4 mr-1.5" /> Generate Program Highlights Report{inRange.length > 0 ? ` (${inRange.length})` : ""}
          </Button>
        </div>
      </div>

      {/* Timeline in range */}
      {isLoading ? (
        <div className="py-14 flex items-center justify-center text-white/50 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
      ) : inRange.length === 0 ? (
        <div className="py-12 text-center text-white/40">No excursions or events in this date range. Try a different preset or widen the dates.</div>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-2">
            {inRange.map((h) => {
              const expanded = expandedKey === h.key;
              const hasDetails = !!(h.details?.trim() || h.notes?.trim());
              return (
                <Fragment key={h.key}>
                  <div className="relative rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 ml-4">
                    <span className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 ${h.type === "event" ? "bg-yellow-400 border-yellow-200" : "bg-purple-500 border-purple-300"}`} />
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 text-xs whitespace-nowrap w-24 shrink-0">{format(parseISO(h.date), "MMM d, yyyy")}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${h.type === "event" ? "text-yellow-200 border-yellow-500/30 bg-yellow-500/10" : "text-purple-200 border-purple-500/30 bg-purple-500/10"}`}>
                        {h.type === "event" ? <Sparkles className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                        {h.type === "event" ? "Event" : "Excursion"}
                      </span>
                      <button type="button" onClick={() => setExpandedKey(expanded ? null : h.key)} className="flex items-center gap-1.5 text-left text-white font-medium hover:text-white/80 flex-1 min-w-0">
                        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
                        <span className="truncate">{h.name}</span>
                        {hasDetails && <StickyNote className="w-3 h-3 text-white/40 shrink-0" />}
                      </button>
                      <span className="text-xs shrink-0 text-right">
                        {h.countsAttendance ? <span className="text-white/80 font-semibold">{h.youthCount} youth</span> : <span className="text-white/30">Narrative</span>}
                      </span>
                    </div>
                    {expanded && (
                      <div className="mt-3 grid md:grid-cols-2 gap-4 border-t border-white/[0.06] pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Overview</p>
                          {h.details?.trim() ? <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{h.details}</p> : <p className="text-xs text-white/30 italic">None yet.</p>}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Debrief</p>
                          {h.notes?.trim() ? <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{h.notes}</p> : <p className="text-xs text-white/30 italic">None yet.</p>}
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

      {/* Report History */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <History className="w-4 h-4 text-white/50" />
          <p className="text-sm font-semibold text-white">Report History</p>
          <span className="text-xs text-white/40">· {reports.length} saved</span>
        </div>
        {reports.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-white/30">Generated reports are saved here automatically, so every date range keeps its report.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  {renamingId === r.id ? (
                    <Input
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveRename(); }
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={saveRename}
                      className="h-7 bg-white/5 border-white/20 text-white text-sm max-w-sm"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(r)}
                      title="Rename report"
                      className="group flex items-center gap-1.5 text-left max-w-full"
                    >
                      <span className="text-sm font-medium text-white truncate">{r.title || "Untitled report"}</span>
                      <Pencil className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  )}
                  <p className="text-[11px] text-white/40">
                    {r.period_label} · Saved {format(parseISO(r.updated_at), "MMM d, yyyy · h:mm a")} · {r.activity_count} activit{r.activity_count === 1 ? "y" : "ies"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openSaved(r)} className="h-7 border-white/10 text-zinc-200 bg-transparent hover:bg-white/5 text-xs shrink-0">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
                <button onClick={() => setDeleteReport(r)} className="text-white/30 hover:text-red-400 transition shrink-0" title="Delete report">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheet && (
        <ProgramHighlightsReportSheet
          open={!!sheet}
          onClose={() => setSheet(null)}
          onSaved={refreshReports}
          period={sheet.period}
          periodFrom={sheet.from}
          periodTo={sheet.to}
          highlights={sheet.highlights}
          reportId={sheet.reportId}
          initialNarrative={sheet.initialNarrative}
        />
      )}

      <AlertDialog open={!!deleteReport} onOpenChange={(o) => { if (!o) setDeleteReport(null); }}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              “{deleteReport?.period_label}” will be permanently removed from your history. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-white/80 hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProgramHighlights;
