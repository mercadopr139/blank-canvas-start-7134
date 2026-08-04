import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { getCurrentAttendanceYear, shortProgramYear } from "@/lib/programYear";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Users, UserCheck, TrendingUp, Award, Loader2, FileText, Download, ChevronDown, ChevronRight, StickyNote, Pencil, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import EventReportSheet, { type EventReportSource } from "@/components/admin/EventReportSheet";
import EditEventModal, { type ProgramEvent } from "@/components/admin/EditEventModal";
import { downloadCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";

// Same poverty rule as Attendance, Transport & Excursion Intelligence so all agree.
const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];
const isBelowPoverty = (reg: any): boolean =>
  !!reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes");
const sortBreakdown = (rec: Record<string, number>) =>
  Object.entries(rec).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

type EvtAttendance = {
  id: string;
  registration_id: string;
  event_id: string | null;
  check_in_date: string;
};

// An event belongs to the program year (Sept 1 → Aug 31) that contains its date.
const eventYear = (dateStr: string): string => getCurrentAttendanceYear(parseISO(dateStr));

const AdminEventsIntelligence = () => {
  const { data: events = [], isLoading: evLoading } = useQuery({
    queryKey: ["events-intel-events"],
    queryFn: async () => {
      // program_events isn't in the generated Supabase types yet — cast, same
      // pattern used across AdminAttendance.
      const { data, error } = await (supabase.from("program_events" as never) as any)
        .select("id, date, name, details, notes, count_attendance")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProgramEvent[];
    },
  });

  // Actual check-ins are the source of truth for counts. Paginated past the
  // PostgREST 1000-row cap. event_id isn't in the generated types yet, so cast.
  const { data: attendance = [], isLoading: attLoading } = useQuery({
    queryKey: ["events-intel-attendance"],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: EvtAttendance[] = [];
      while (true) {
        const { data, error } = await (supabase.from("attendance_records") as any)
          .select("id, registration_id, event_id, check_in_date")
          .eq("program_source", "Event")
          .not("event_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as EvtAttendance[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Youth demographics, for the equity/reach breakdown (who we're reaching).
  const { data: regDemographics = [] } = useQuery({
    queryKey: ["events-intel-demographics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_race_ethnicity, child_sex, household_income_range, free_or_reduced_lunch, is_bald_eagle");
      if (error) throw error;
      return data ?? [];
    },
  });
  const regMap = useMemo(() => {
    const m = new Map<string, any>();
    regDemographics.forEach((r: any) => m.set(r.id, r));
    return m;
  }, [regDemographics]);

  // Per-event check-in count + the distinct youth at each event.
  const { countByEvent, regIdsByEvent } = useMemo(() => {
    const countByEvent: Record<string, number> = {};
    const regIdsByEvent: Record<string, Set<string>> = {};
    for (const a of attendance) {
      if (!a.event_id) continue;
      countByEvent[a.event_id] = (countByEvent[a.event_id] || 0) + 1;
      (regIdsByEvent[a.event_id] ??= new Set()).add(a.registration_id);
    }
    return { countByEvent, regIdsByEvent };
  }, [attendance]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    events.forEach((e) => years.add(eventYear(e.date)));
    return [...years].sort().reverse();
  }, [events]);

  const [year, setYear] = useState<string>(() => getCurrentAttendanceYear());
  const [reportSource, setReportSource] = useState<EventReportSource | null>(null);
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = (e: ProgramEvent) => setExpandedId(expandedId === e.id ? null : e.id);

  // The full Edit Event modal — the SAME editor used on the Attendance calendar.
  const [editingEvent, setEditingEvent] = useState<ProgramEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProgramEvent | null>(null);
  const refreshAfterEdit = () => {
    queryClient.invalidateQueries({ queryKey: ["events-intel-events"] });
    queryClient.invalidateQueries({ queryKey: ["events-intel-attendance"] });
    queryClient.invalidateQueries({ queryKey: ["events-cal"] });
    queryClient.invalidateQueries({ queryKey: ["event-attendance-month"] });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase.from("program_events" as never) as any).delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete event"); return; }
    toast.success("Event deleted");
    setDeleteTarget(null);
    setEditingEvent(null);
    refreshAfterEdit();
  };

  // Never sit on a year with no events (blank dropdown) — fall back to the
  // in-session year, then the newest year that has data.
  useEffect(() => {
    if (availableYears.length === 0) return;
    if (year === "__all__" || availableYears.includes(year)) return;
    const current = getCurrentAttendanceYear();
    setYear(availableYears.includes(current) ? current : availableYears[0]);
  }, [availableYears, year]);

  const yearEvents = useMemo(() => {
    const list = year === "__all__" ? events : events.filter((e) => eventYear(e.date) === year);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  }, [events, year]);

  // Only events flagged count_attendance feed the attendance math; the rest are
  // narrative-only highlights and never move the numbers.
  const stats = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const total = yearEvents.length;
    const counting = yearEvents.filter((e) => e.count_attendance);
    let youthCheckIns = 0;
    let passedCount = 0;
    let passedYouthCheckIns = 0;
    const uniqueYouth = new Set<string>();
    let top: { name: string; count: number } | null = null;
    for (const e of counting) {
      const c = countByEvent[e.id] || 0;
      youthCheckIns += c;
      if (e.date <= todayStr) {
        passedCount += 1;
        passedYouthCheckIns += c;
      }
      regIdsByEvent[e.id]?.forEach((id) => uniqueYouth.add(id));
      if (!top || c > top.count) top = { name: e.name, count: c };
    }
    return {
      total,
      youthCheckIns,
      uniqueYouth: uniqueYouth.size,
      avg: passedCount > 0 ? Math.round(passedYouthCheckIns / passedCount) : 0,
      top,
    };
  }, [yearEvents, countByEvent, regIdsByEvent]);

  // Equity / reach: demographics of distinct youth reached by counted events.
  const equity = useMemo(() => {
    const ids = new Set<string>();
    yearEvents.filter((e) => e.count_attendance).forEach((e) => regIdsByEvent[e.id]?.forEach((id) => ids.add(id)));
    const reached = [...ids].map((id) => regMap.get(id)).filter(Boolean);
    const race: Record<string, number> = {};
    const gender: Record<string, number> = {};
    let poverty = 0;
    let baldEagles = 0;
    reached.forEach((r) => {
      race[r.child_race_ethnicity || "Not reported"] = (race[r.child_race_ethnicity || "Not reported"] || 0) + 1;
      gender[r.child_sex || "Not reported"] = (gender[r.child_sex || "Not reported"] || 0) + 1;
      if (isBelowPoverty(r)) poverty += 1;
      if (r.is_bald_eagle) baldEagles += 1;
    });
    const n = reached.length;
    return {
      n,
      race: sortBreakdown(race),
      gender: sortBreakdown(gender),
      poverty,
      povertyPct: n > 0 ? Math.round((poverty / n) * 100) : 0,
      baldEagles,
    };
  }, [yearEvents, regIdsByEvent, regMap]);

  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; events: number; youth: number }>();
    [...yearEvents]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((e) => {
        const key = e.date.slice(0, 7);
        const cur = map.get(key) ?? { label: format(parseISO(e.date), "MMM"), events: 0, youth: 0 };
        cur.events += 1;
        if (e.count_attendance) cur.youth += countByEvent[e.id] || 0;
        map.set(key, cur);
      });
    return [...map.values()];
  }, [yearEvents, countByEvent]);
  const maxMonthYouth = Math.max(1, ...monthly.map((m) => m.youth));

  const isLoading = evLoading || attLoading;
  const yearLabel = year === "__all__" ? "All Years" : shortProgramYear(year);

  const downloadYearReport = () => {
    const topRaces = equity.race
      .filter((r) => r.label !== "Not reported")
      .slice(0, 3)
      .map((r) => `${r.label} (${equity.n > 0 ? Math.round((r.count / equity.n) * 100) : 0}%)`)
      .join(", ");
    const reachSentence = stats.uniqueYouth > 0
      ? `reaching ${stats.uniqueYouth} unique youth across ${stats.youthCheckIns} check-ins. `
      : "";
    const summary =
      `In ${yearLabel}, No Limits Boxing Academy hosted ${stats.total} program event${stats.total === 1 ? "" : "s"}, ` +
      reachSentence +
      (equity.n > 0
        ? `${equity.povertyPct}% of participating youth come from households at or below the poverty line, and these on-site experiences continue to build skills and connection beyond the ring.`
        : `each one giving our youth new skills, mentorship, and connection beyond the ring.`) +
      (topRaces ? ` Participants reflect the community we serve, including ${topRaces}.` : "");
    downloadCornerCoachReportPdf({
      title: "Events Report",
      periodLabel: yearLabel,
      narrative: summary,
      stats: [
        { label: "Events", value: String(stats.total) },
        { label: "Youth Check-Ins", value: String(stats.youthCheckIns) },
        { label: "Unique Youth", value: String(stats.uniqueYouth) },
        { label: "Below Poverty", value: `${equity.povertyPct}%` },
      ],
      table: {
        columns: ["Date", "Event", "Youth"],
        rows: yearEvents.map((e) => [
          format(parseISO(e.date), "MMM d, yyyy"),
          e.name,
          e.count_attendance ? String(countByEvent[e.id] || 0) : "—",
        ]),
      },
    });
  };

  const tiles = [
    { label: "Events", value: String(stats.total), icon: CalendarDays, color: "text-yellow-300" },
    { label: "Youth Check-Ins", value: stats.youthCheckIns.toLocaleString(), icon: Users, color: "text-green-300", hint: "counted events only" },
    { label: "Unique Youth Reached", value: String(stats.uniqueYouth), icon: UserCheck, color: "text-sky-300", hint: "distinct kids reached" },
    { label: "Avg / Event", value: String(stats.avg), icon: TrendingUp, color: "text-white", hint: "counted events only" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-yellow-400" /> Events Intelligence
          </h1>
          <p className="text-sm text-white/50 mt-0.5">Every on-site event for the year, with real check-in counts.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isLoading && yearEvents.length > 0 && (
            <Button size="sm" onClick={downloadYearReport} className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white text-xs h-8">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Year Report (PDF)
            </Button>
          )}
          {availableYears.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Program Year</span>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="h-8 w-44 bg-white/5 border-white/15 text-white text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y}>{shortProgramYear(y)}{y === getCurrentAttendanceYear() ? " (current)" : ""}</SelectItem>
                  ))}
                  <SelectItem value="__all__">All years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex items-center justify-center text-white/50 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading events…
        </div>
      ) : yearEvents.length === 0 ? (
        <div className="py-20 text-center text-white/40">No events recorded for this program year yet. Add events from the Attendance calendar.</div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </div>
                <p className={`text-3xl font-bold mt-1 ${t.color}`}>{t.value}</p>
                {t.hint && <p className="text-[10px] text-white/30">{t.hint}</p>}
              </div>
            ))}
          </div>

          {/* Most-attended highlight */}
          {stats.top && stats.top.count > 0 && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4 flex items-center gap-3">
              <Award className="w-5 h-5 text-yellow-300 shrink-0" />
              <p className="text-sm text-white/80">
                Most-attended event this year: <span className="font-semibold text-white">{stats.top.name}</span>{" "}
                <span className="text-yellow-300 font-semibold">({stats.top.count} youth)</span>
              </p>
            </div>
          )}

          {/* Reach & Equity */}
          {equity.n > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                Reach &amp; Equity · {equity.n} unique youth reached
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-2xl font-bold text-amber-300">{equity.povertyPct}%</p>
                  <p className="text-[10px] text-white/40">At/below poverty line</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <p className="text-2xl font-bold text-red-300">{equity.baldEagles}</p>
                  <p className="text-[10px] text-white/40">Bald Eagles reached</p>
                </div>
                {equity.gender.slice(0, 2).map((g) => (
                  <div key={g.label} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <p className="text-2xl font-bold text-white">{g.count}</p>
                    <p className="text-[10px] text-white/40 truncate">{g.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Race / ethnicity of youth reached</p>
                <div className="space-y-1.5">
                  {equity.race.map((r) => {
                    const pct = Math.round((r.count / equity.n) * 100);
                    return (
                      <div key={r.label} className="flex items-center gap-2 text-xs">
                        <span className="w-40 shrink-0 text-white/60 truncate" title={r.label}>{r.label}</span>
                        <div className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
                          <div className="h-full bg-yellow-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-16 shrink-0 text-right text-white/50">{r.count} · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Monthly trend */}
          {monthly.length > 1 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-3">Youth check-ins by month</p>
              <div className="flex items-end gap-2 h-28">
                {monthly.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-white/60">{m.youth}</span>
                    <div
                      className="w-full rounded-t bg-yellow-500/60"
                      style={{ height: `${Math.max(4, (m.youth / maxMonthYouth) * 88)}px` }}
                      title={`${m.events} event${m.events === 1 ? "" : "s"} · ${m.youth} youth`}
                    />
                    <span className="text-[10px] text-white/40">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-event table */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/40 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Date</th>
                    <th className="text-left font-semibold px-4 py-2.5">Event</th>
                    <th className="text-center font-semibold px-4 py-2.5">Youth</th>
                    <th className="text-right font-semibold px-4 py-2.5">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {yearEvents.map((e) => {
                    const expanded = expandedId === e.id;
                    const hasDetails = !!(e.details?.trim() || e.notes?.trim());
                    const rosterNames = expanded
                      ? [...(regIdsByEvent[e.id] ?? [])]
                          .map((id) => regMap.get(id))
                          .filter(Boolean)
                          .map((r) => `${r.child_first_name ?? ""} ${r.child_last_name ?? ""}`.trim())
                          .filter(Boolean)
                          .sort((a, b) => a.localeCompare(b))
                      : [];
                    return (
                    <Fragment key={e.id}>
                    <tr className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">{format(parseISO(e.date), "MMM d, yyyy")}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpand(e)}
                          className="flex items-center gap-1.5 text-left text-white font-medium hover:text-white/80"
                          title="View / edit event overview & debrief"
                        >
                          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
                          <span>{e.name}</span>
                          {hasDetails && <StickyNote className="w-3 h-3 text-yellow-300/70 shrink-0" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {e.count_attendance ? (
                          <span className="text-white/90 font-semibold">{countByEvent[e.id] || 0}</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-medium text-white/40">
                            Narrative only
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-white/10 text-zinc-200 bg-transparent hover:bg-white/5 text-xs"
                          onClick={() =>
                            setReportSource({
                              id: e.id,
                              name: e.name,
                              date: e.date,
                              details: e.details,
                              notes: e.notes,
                              youthCount: countByEvent[e.id] || 0,
                              countsAttendance: e.count_attendance,
                              regIds: [...(regIdsByEvent[e.id] ?? [])],
                            })
                          }
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" /> Grant Report
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-white/10 bg-white/[0.07]">
                        <td colSpan={4} className="px-4 py-4 space-y-4">
                          {e.count_attendance && (
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">
                                Attendance · {rosterNames.length} youth
                              </p>
                              {rosterNames.length === 0 ? (
                                <p className="text-xs text-white/30 italic">No check-ins recorded for this event.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {rosterNames.map((n, i) => (
                                    <span key={`${n}-${i}`} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-white/80">{n}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-yellow-200/70 font-semibold flex items-center gap-1.5 mb-1.5">
                                <StickyNote className="w-3.5 h-3.5 text-yellow-300" /> Overview
                              </p>
                              {e.details?.trim() ? (
                                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{e.details}</p>
                              ) : (
                                <p className="text-xs text-white/30 italic">None yet.</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-yellow-200/70 font-semibold flex items-center gap-1.5 mb-1.5">
                                <StickyNote className="w-3.5 h-3.5 text-yellow-300" /> Debrief
                              </p>
                              {e.notes?.trim() ? (
                                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{e.notes}</p>
                              ) : (
                                <p className="text-xs text-white/30 italic">None yet.</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                            <p className="text-[10px] text-white/30">Edit the name, overview, debrief &amp; attendance toggle in the full editor — the same one on the calendar.</p>
                            <Button
                              size="sm"
                              onClick={() => setEditingEvent(e)}
                              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs h-8 shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Event
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-white/25">
            Click <span className="text-white/50">Grant Report</span> on any event for an editable narrative you can revise and export as a branded PDF.
          </p>
        </>
      )}

      <EventReportSheet open={!!reportSource} source={reportSource} onClose={() => setReportSource(null)} />

      <EditEventModal
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onSaved={refreshAfterEdit}
        onRequestDelete={(ev) => setDeleteTarget(ev)}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              “{deleteTarget?.name}” and any attendance recorded for it will be permanently removed. This can’t be undone.
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

export default AdminEventsIntelligence;
