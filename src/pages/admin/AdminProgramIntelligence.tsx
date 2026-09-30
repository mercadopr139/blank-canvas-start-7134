// A program's Intelligence page.
//
// The numbers a funder asks for, over a period you pick: sessions held,
// check-ins, distinct students, average per session (and bus vs dismissed
// where the program has that choice), and who the students are. Then each
// student's attendance, the day-by-day calendar, and Weekly Standout
// Moments. This program only: the cross-program youth served figure lives on
// its own page under Attendance. The report button writes from what is on
// screen.
import { useMemo, useState } from "react";
import AdminProgramAttendance from "@/pages/admin/AdminProgramAttendance";
import ProgramWeeklyMoments from "@/components/admin/ProgramWeeklyMoments";
import type { ProgramConfig } from "@/lib/programs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarDays, Activity, Users, Star, Bus, DoorOpen, Sparkles } from "lucide-react";
import ProgramReportSheet from "@/components/admin/ProgramReportSheet";
import { getCurrentAttendanceYear, programYearRange, shortProgramYear } from "@/lib/programYear";
import {
  type HawkIntelRow, type HawkWeeklyMoments, hawkTodayET, hawkPhotoUrl, hawkIdentity, hawkPeriodStats, hawkBreakdown, hawkWeekStart, hawkWeekLabel,
} from "@/lib/hawkSquad";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (d: string) => format(new Date(d + "T00:00:00"), "MMM d, yyyy");

type PresetKey = "this-month" | "last-month" | "year" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "year", label: `Program year ${shortProgramYear(getCurrentAttendanceYear())}` },
  { key: "custom", label: "Custom range" },
];

const rangeFor = (key: PresetKey, customFrom: string, customTo: string): { from: string; to: string; label: string } => {
  const now = new Date();
  if (key === "custom") {
    const from = customFrom || iso(startOfMonth(now));
    const to = customTo || iso(now);
    return { from, to, label: `${fmtDay(from)} – ${fmtDay(to)}` };
  }
  if (key === "last-month") { const m = subMonths(now, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), label: format(m, "MMMM yyyy") }; }
  if (key === "year") {
    const year = getCurrentAttendanceYear();
    const [s, e] = programYearRange(year);
    return { from: iso(s), to: iso(e), label: `Program year ${shortProgramYear(year)}` };
  }
  return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)), label: format(now, "MMMM yyyy") };
};

const AdminProgramIntelligence = ({ program }: { program: ProgramConfig }) => {
  const GREEN = program.brand.ui;
  const [preset, setPreset] = useState<PresetKey>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const { from, to, label } = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ["program-intel", program.key, from, to],
    queryFn: async (): Promise<HawkIntelRow[]> => {
      const { data, error } = await (supabase.from(program.tables.attendance as never) as never as {
        select: (s: string) => { gte: (k: string, v: string) => { lte: (k: string, v: string) => Promise<{ data: unknown; error: { message: string } | null }> } };
      })
        .select(`registration_id, check_in_date, going_home, ${program.tables.registrations}(id, youth_link_id, child_first_name, child_last_name, child_headshot_url, grade_level, cte_program, child_sex, child_race_ethnicity, free_or_reduced_lunch)`)
        .gte("check_in_date", from).lte("check_in_date", to);
      if (error) throw new Error(error.message);
      return ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
        registration_id: r.registration_id as string, check_in_date: r.check_in_date as string,
        going_home: r.going_home as "bus" | "dismissed", reg: (r[program.tables.registrations] as HawkIntelRow["reg"]) ?? null,
      }));
    },
  });

  const { data: overrides = {} } = useQuery({
    queryKey: ["program-practice-days-range", program.key, from, to],
    queryFn: async () => {
      const { data, error } = await (supabase.from(program.tables.practiceDays as never) as never as {
        select: (s: string) => { gte: (k: string, v: string) => { lte: (k: string, v: string) => Promise<{ data: unknown; error: { message: string } | null }> } };
      }).select("date, is_practice_day").gte("date", from).lte("date", to);
      if (error) throw new Error(error.message);
      const m: Record<string, boolean> = {};
      ((data as Array<{ date: string; is_practice_day: boolean }>) ?? []).forEach((r) => { m[r.date] = r.is_practice_day; });
      return m;
    },
  });

  // Weekly Standout Moments whose week touches the period: the report's nuggets.
  const { data: moments = [] } = useQuery({
    queryKey: ["program-moments-period", program.key, from, to],
    queryFn: async (): Promise<Array<{ week: string; notes: string }>> => {
      const { data, error } = await (supabase.from(program.tables.moments as never) as never as {
        select: (s: string) => { gte: (k: string, v: string) => { lte: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> } } };
      }).select("week_start, notes").gte("week_start", hawkWeekStart(from)).lte("week_start", to).order("week_start", { ascending: true });
      if (error) throw new Error(error.message);
      return ((data as Pick<HawkWeeklyMoments, "week_start" | "notes">[]) ?? [])
        .filter((m) => m.notes.trim())
        .map((m) => ({ week: hawkWeekLabel(m.week_start), notes: m.notes.trim() }));
    },
  });

  const stats = useMemo(() => hawkPeriodStats(rows, from, to, overrides, hawkTodayET(), program.defaultWeekdays), [rows, from, to, overrides, program.defaultWeekdays]);
  const breakdown = useMemo(() => hawkBreakdown(rows, { cte: program.hasCte }), [rows, program.hasCte]);

  // Per student: sessions attended out of sessions held, and how they went home.
  const students = useMemo(() => {
    const m = new Map<string, { name: string; photo: string | null; grade: string | null; dates: Set<string>; bus: number; dismissed: number }>();
    rows.forEach((r) => {
      const id = hawkIdentity(r);
      const s = m.get(id) ?? { name: `${r.reg?.child_first_name ?? ""} ${r.reg?.child_last_name ?? ""}`.trim() || "Unknown", photo: r.reg?.child_headshot_url ?? null, grade: r.reg?.grade_level ?? null, dates: new Set<string>(), bus: 0, dismissed: 0 };
      s.dates.add(r.check_in_date);
      if (r.going_home === "dismissed") s.dismissed++; else s.bus++;
      m.set(id, s);
    });
    return [...m.values()].sort((a, b) => b.dates.size - a.dates.size || a.name.localeCompare(b.name));
  }, [rows]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{program.name} — Intelligence</h2>
          <p className="text-neutral-400 text-sm mt-1">{program.name} only — the numbers for a period, and the day-by-day attendance behind them.</p>
        </div>
        <Button onClick={() => setReportOpen(true)} disabled={stats.checkIns === 0} className={`${program.tw.button} font-semibold gap-2`}>
          <Sparkles className="h-4 w-4" /> Grant report
        </Button>
      </div>

      {/* ── By the numbers ── */}
      <SectionLabel program={program} tag="By the numbers" title="Reach and who the students are" tone="accent" />

      {/* Period */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${preset === p.key ? `${program.tw.chipActive} font-semibold` : "bg-white/5 border-white/15 text-white/70 hover:text-white"}`}>
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 ml-1">
            <label className="text-sm text-white/60 flex items-center gap-2">From
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
            <label className="text-sm text-white/60 flex items-center gap-2">To
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
          </div>
        )}
        <span className="text-xs text-white/40 ml-auto">{label}</span>
      </div>

      {isError && <p className="text-rose-300 text-sm">Couldn't load attendance: {(error as Error)?.message}</p>}

      {/* Headline figures */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-3 ${program.hasGoingHome ? "lg:grid-cols-6" : "lg:grid-cols-4"}`}>
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="Sessions held" value={stats.sessionsHeld} sub={`of ${stats.sessionsPlanned} planned`} />
        <Stat icon={<Activity className="h-4 w-4" />} label="Check-ins" value={stats.checkIns} />
        <Stat icon={<Users className="h-4 w-4" />} label="Students reached" value={stats.students} />
        <Stat icon={<Star className="h-4 w-4" />} label="Avg / session" value={stats.avgPerSession} />
        {program.hasGoingHome && <Stat icon={<Bus className="h-4 w-4" />} label="Bus" value={stats.bus} sub={`${pct(stats.bus, stats.checkIns)}% of check-ins`} />}
        {program.hasGoingHome && <Stat icon={<DoorOpen className="h-4 w-4" />} label="Dismissed" value={stats.dismissed} sub={`${pct(stats.dismissed, stats.checkIns)}% of check-ins`} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Who the students are */}
        <Card className="bg-white/[0.03] border-white/10 text-white">
          <CardContent className="p-4 space-y-4">
            <p className="font-bold">Who the students are <span className="text-white/40 font-normal text-sm">· {stats.students} distinct</span></p>
            {stats.students === 0 ? <p className="text-white/35 text-sm">No check-ins in this period.</p> : (
              Object.entries(breakdown).map(([title, counts]) => {
                const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={title}>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">{title}</p>
                    <div className="space-y-1">
                      {entries.map(([k, n]) => (
                        <div key={k} className="flex items-center gap-2 text-sm">
                          <span className="w-40 truncate text-white/75" title={k}>{k}</span>
                          <div className="flex-1 h-2 rounded bg-white/5 overflow-hidden">
                            <div className="h-full rounded" style={{ width: `${pct(n, stats.students)}%`, backgroundColor: GREEN }} />
                          </div>
                          <span className="w-14 text-right tabular-nums text-white/60">{n} <span className="text-white/30">({pct(n, stats.students)}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Each student */}
          <Card className="bg-white/[0.03] border-white/10 text-white">
            <CardContent className="p-4">
              <p className="font-bold mb-3">Each student <span className="text-white/40 font-normal text-sm">· sessions attended of {stats.sessionsHeld} held</span></p>
              {isLoading ? <p className="text-white/40 text-sm">Loading…</p> : students.length === 0 ? (
                <p className="text-white/35 text-sm">No check-ins in this period.</p>
              ) : (
                <div className="divide-y divide-white/[0.06] max-h-[420px] overflow-y-auto pr-1">
                  {students.map((s) => (
                    <div key={s.name + s.grade} className="flex items-center gap-3 py-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                        {hawkPhotoUrl(s.photo) && <img src={hawkPhotoUrl(s.photo)!} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{s.name}{s.grade && <span className="ml-2 text-xs text-white/40">{s.grade}</span>}</p>
                        {program.hasGoingHome && <p className="text-[11px] text-white/40">{s.bus} bus · {s.dismissed} dismissed</p>}
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-sm font-bold tabular-nums">{s.dates.size}<span className="text-white/30 font-normal"> / {stats.sessionsHeld}</span></p>
                        <div className="h-1.5 rounded bg-white/5 overflow-hidden mt-1">
                          <div className="h-full" style={{ width: `${pct(s.dates.size, stats.sessionsHeld)}%`, backgroundColor: GREEN }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Day by day: the calendar and the day's roster, like NLA's Attendance Intelligence. ── */}
      <section id="attendance" className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-6 space-y-3 scroll-mt-6">
        <SectionLabel program={program} tag="Day by day" title="Attendance" tone="primary" />
        <AdminProgramAttendance program={program} embedded />
      </section>

      {/* ── In the coaches' words: the nuggets the report is built from. Last, on the program's colour. ── */}
      <ProgramWeeklyMoments program={program} />

      <ProgramReportSheet program={program} open={reportOpen} onClose={() => setReportOpen(false)} period={label} stats={stats} breakdown={breakdown} moments={moments} />
    </div>
  );
};

// A small tag and a title that mark where one band of the page ends and the
// next begins: the accent for the numbers, the brand colour for the
// day-by-day, and the moments section carries its own on the brand colour.
const SectionLabel = ({ program, tag, title, tone }: { program: ProgramConfig; tag: string; title: string; tone: "accent" | "primary" }) => {
  const { primary, accent, onAccent } = program.brand;
  const style = tone === "accent"
    ? { backgroundColor: accent, color: onAccent }
    : { backgroundColor: primary, color: accent, boxShadow: `0 0 0 1px ${accent}66` };
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em]" style={style}>{tag}</span>
      <h3 className="text-lg font-bold">{title}</h3>
    </div>
  );
};

const Stat = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) => (
  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
    <div className="flex items-center gap-1.5 text-white/40 text-[11px] uppercase tracking-wide mb-1">{icon}{label}</div>
    <div className="text-2xl font-extrabold text-white tabular-nums">{value}</div>
    {sub && <div className="text-[11px] text-white/35">{sub}</div>}
  </div>
);

export default AdminProgramIntelligence;
