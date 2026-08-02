import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, format } from "date-fns";
import { getCurrentAttendanceYear, shortProgramYear } from "@/lib/programYear";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Users, UserCheck, TrendingUp, Award, Lock, CheckCircle2, Loader2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExcursionReportSheet, { type ExcursionReportSource } from "@/components/admin/ExcursionReportSheet";
import { downloadCornerCoachReportPdf } from "@/lib/generateCornerCoachReportPdf";

// Same poverty rule as Attendance & Transport Intelligence so all three agree.
const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];
const isBelowPoverty = (reg: any): boolean =>
  !!reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes");
const sortBreakdown = (rec: Record<string, number>) =>
  Object.entries(rec).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

type ExcursionRow = {
  id: string;
  date: string;
  name: string;
  arrived_at: string | null;
  returned_at: string | null;
  roster_locked_at: string | null;
  details: string | null;
  notes: string | null;
};

type ExAttendance = {
  id: string;
  registration_id: string;
  excursion_id: string | null;
  check_in_date: string;
};

// A trip belongs to the program year (Sept 1 → Aug 31) that contains its date.
// getCurrentAttendanceYear(date) maps any date to that Sept–Aug span.
const excursionYear = (dateStr: string): string => getCurrentAttendanceYear(parseISO(dateStr));

const AdminExcursionIntelligence = () => {
  const { data: excursions = [], isLoading: exLoading } = useQuery({
    queryKey: ["excursion-intel-excursions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excursions")
        .select("id, date, name, arrived_at, returned_at, roster_locked_at, details, notes")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExcursionRow[];
    },
  });

  // Actual check-ins are the source of truth for counts (not the legacy
  // youth_count). Paginated past PostgREST's 1000-row cap.
  const { data: attendance = [], isLoading: attLoading } = useQuery({
    queryKey: ["excursion-intel-attendance"],
    queryFn: async () => {
      const pageSize = 1000;
      let from = 0;
      const all: ExAttendance[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("id, registration_id, excursion_id, check_in_date")
          .eq("program_source", "Excursion")
          .not("excursion_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as ExAttendance[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  // Youth demographics, for the equity/reach breakdown (who we're reaching).
  const { data: regDemographics = [] } = useQuery({
    queryKey: ["excursion-intel-demographics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_race_ethnicity, child_sex, household_income_range, free_or_reduced_lunch, is_bald_eagle");
      if (error) throw error;
      return data ?? [];
    },
  });
  const regMap = useMemo(() => {
    const m = new Map<string, any>();
    regDemographics.forEach((r: any) => m.set(r.id, r));
    return m;
  }, [regDemographics]);

  // Per-excursion check-in count + the distinct youth on each trip.
  const { countByExcursion, regIdsByExcursion } = useMemo(() => {
    const countByExcursion: Record<string, number> = {};
    const regIdsByExcursion: Record<string, Set<string>> = {};
    for (const a of attendance) {
      if (!a.excursion_id) continue;
      countByExcursion[a.excursion_id] = (countByExcursion[a.excursion_id] || 0) + 1;
      (regIdsByExcursion[a.excursion_id] ??= new Set()).add(a.registration_id);
    }
    return { countByExcursion, regIdsByExcursion };
  }, [attendance]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    excursions.forEach((e) => years.add(excursionYear(e.date)));
    return [...years].sort().reverse();
  }, [excursions]);

  const [year, setYear] = useState<string>(() => getCurrentAttendanceYear());
  const [reportSource, setReportSource] = useState<ExcursionReportSource | null>(null);
  // Never sit on a year with no trips (blank dropdown) — fall back to the
  // in-session year, then the newest year that has data.
  useEffect(() => {
    if (availableYears.length === 0) return;
    if (year === "__all__" || availableYears.includes(year)) return;
    const current = getCurrentAttendanceYear();
    setYear(availableYears.includes(current) ? current : availableYears[0]);
  }, [availableYears, year]);

  const yearExcursions = useMemo(() => {
    const list = year === "__all__" ? excursions : excursions.filter((e) => excursionYear(e.date) === year);
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  }, [excursions, year]);

  const stats = useMemo(() => {
    const total = yearExcursions.length;
    let youthTrips = 0;
    const uniqueYouth = new Set<string>();
    let top: { name: string; count: number } | null = null;
    for (const e of yearExcursions) {
      const c = countByExcursion[e.id] || 0;
      youthTrips += c;
      regIdsByExcursion[e.id]?.forEach((id) => uniqueYouth.add(id));
      if (!top || c > top.count) top = { name: e.name, count: c };
    }
    return {
      total,
      youthTrips,
      uniqueYouth: uniqueYouth.size,
      avg: total > 0 ? Math.round(youthTrips / total) : 0,
      top,
    };
  }, [yearExcursions, countByExcursion, regIdsByExcursion]);

  // Equity / reach: demographics of the distinct youth reached this year.
  const equity = useMemo(() => {
    const ids = new Set<string>();
    yearExcursions.forEach((e) => regIdsByExcursion[e.id]?.forEach((id) => ids.add(id)));
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
  }, [yearExcursions, regIdsByExcursion, regMap]);

  // Trips + youth-trips per month, oldest → newest, for the mini trend.
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; trips: number; youth: number }>();
    [...yearExcursions]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((e) => {
        const key = e.date.slice(0, 7); // yyyy-MM
        const cur = map.get(key) ?? { label: format(parseISO(e.date), "MMM"), trips: 0, youth: 0 };
        cur.trips += 1;
        cur.youth += countByExcursion[e.id] || 0;
        map.set(key, cur);
      });
    return [...map.values()];
  }, [yearExcursions, countByExcursion]);
  const maxMonthYouth = Math.max(1, ...monthly.map((m) => m.youth));

  const isLoading = exLoading || attLoading;

  const yearLabel = year === "__all__" ? "All Years" : shortProgramYear(year);
  const downloadYearReport = () => {
    const topRaces = equity.race
      .filter((r) => r.label !== "Not reported")
      .slice(0, 3)
      .map((r) => `${r.label} (${equity.n > 0 ? Math.round((r.count / equity.n) * 100) : 0}%)`)
      .join(", ");
    const summary =
      `In ${yearLabel}, No Limits Boxing Academy ran ${stats.total} excursion${stats.total === 1 ? "" : "s"}, ` +
      `reaching ${stats.uniqueYouth} unique youth across ${stats.youthTrips} youth-trips. ` +
      `${equity.povertyPct}% of participating youth come from households at or below the poverty line, ` +
      `and these enrichment experiences continue to open doors beyond the gym.` +
      (topRaces ? ` Participants reflect the community we serve, including ${topRaces}.` : "");
    downloadCornerCoachReportPdf({
      title: "Excursion Report",
      periodLabel: yearLabel,
      narrative: summary,
      stats: [
        { label: "Excursions", value: String(stats.total) },
        { label: "Youth-Trips", value: String(stats.youthTrips) },
        { label: "Unique Youth", value: String(stats.uniqueYouth) },
        { label: "Below Poverty", value: `${equity.povertyPct}%` },
      ],
      table: {
        columns: ["Date", "Trip", "Youth"],
        rows: yearExcursions.map((e) => [format(parseISO(e.date), "MMM d, yyyy"), e.name, String(countByExcursion[e.id] || 0)]),
      },
    });
  };

  const statusBadges = (e: ExcursionRow) => {
    const badges: { label: string; cls: string; icon: any }[] = [];
    if (e.roster_locked_at) badges.push({ label: "Locked", cls: "text-amber-300 border-amber-500/30 bg-amber-500/10", icon: Lock });
    if (e.arrived_at) badges.push({ label: "Arrived", cls: "text-sky-300 border-sky-500/30 bg-sky-500/10", icon: CheckCircle2 });
    if (e.returned_at) badges.push({ label: "Returned", cls: "text-green-300 border-green-500/30 bg-green-500/10", icon: CheckCircle2 });
    return badges;
  };

  const tiles = [
    { label: "Excursions", value: String(stats.total), icon: MapPin, color: "text-purple-300" },
    { label: "Youth-Trips", value: stats.youthTrips.toLocaleString(), icon: Users, color: "text-green-300", hint: "total check-ins" },
    { label: "Unique Youth Reached", value: String(stats.uniqueYouth), icon: UserCheck, color: "text-sky-300", hint: "distinct kids on ≥1 trip" },
    { label: "Avg / Excursion", value: String(stats.avg), icon: TrendingUp, color: "text-white" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-purple-400" /> Excursion Intelligence
          </h1>
          <p className="text-sm text-white/50 mt-0.5">Every trip for the year, with real check-in counts.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isLoading && yearExcursions.length > 0 && (
            <Button
              size="sm"
              onClick={downloadYearReport}
              className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white text-xs h-8"
            >
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
          <Loader2 className="w-5 h-5 animate-spin" /> Loading excursions…
        </div>
      ) : yearExcursions.length === 0 ? (
        <div className="py-20 text-center text-white/40">No excursions recorded for this program year yet.</div>
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
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-4 flex items-center gap-3">
              <Award className="w-5 h-5 text-purple-300 shrink-0" />
              <p className="text-sm text-white/80">
                Most-attended trip this year: <span className="font-semibold text-white">{stats.top.name}</span>{" "}
                <span className="text-purple-300 font-semibold">({stats.top.count} youth)</span>
              </p>
            </div>
          )}

          {/* Reach & Equity — who these enrichment trips are reaching */}
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
                          <div className="h-full bg-purple-500/60" style={{ width: `${pct}%` }} />
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
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-3">Youth-trips by month</p>
              <div className="flex items-end gap-2 h-28">
                {monthly.map((m) => (
                  <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-white/60">{m.youth}</span>
                    <div
                      className="w-full rounded-t bg-purple-500/60"
                      style={{ height: `${Math.max(4, (m.youth / maxMonthYouth) * 88)}px` }}
                      title={`${m.trips} trip${m.trips === 1 ? "" : "s"} · ${m.youth} youth`}
                    />
                    <span className="text-[10px] text-white/40">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-excursion table */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-white/40 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Date</th>
                    <th className="text-left font-semibold px-4 py-2.5">Trip</th>
                    <th className="text-center font-semibold px-4 py-2.5">Youth</th>
                    <th className="text-left font-semibold px-4 py-2.5">Status</th>
                    <th className="text-right font-semibold px-4 py-2.5">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {yearExcursions.map((e) => (
                    <tr key={e.id} className="border-t border-white/[0.06] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-white/70 whitespace-nowrap">{format(parseISO(e.date), "MMM d, yyyy")}</td>
                      <td className="px-4 py-2.5 text-white font-medium">{e.name}</td>
                      <td className="px-4 py-2.5 text-center text-white/90 font-semibold">{countByExcursion[e.id] || 0}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {statusBadges(e).map((b) => (
                            <span key={b.label} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${b.cls}`}>
                              <b.icon className="w-3 h-3" /> {b.label}
                            </span>
                          ))}
                        </div>
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
                              youthCount: countByExcursion[e.id] || 0,
                              regIds: [...(regIdsByExcursion[e.id] ?? [])],
                            })
                          }
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" /> Grant Report
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-white/25">
            Click <span className="text-white/50">Grant Report</span> on any trip for an editable narrative you can revise and export as a branded PDF.
          </p>
        </>
      )}

      <ExcursionReportSheet
        open={!!reportSource}
        source={reportSource}
        onClose={() => setReportSource(null)}
      />
    </div>
  );
};

export default AdminExcursionIntelligence;
