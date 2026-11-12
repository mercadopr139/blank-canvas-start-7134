// A program's Snapshot sheet (Josh, 2026-11-12): run it on the period the
// Intelligence page is showing, see every block on a white page, untick the
// ones that don't complement the program, choose full names or initials,
// and download the PDF. Nothing is saved; the numbers are live.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { ProgramConfig } from "@/lib/programs";
import { hawkIdentity, hawkPeriodStats, hawkTodayET, type HawkBreakdown, type HawkIntelRow, type HawkPeriodStats } from "@/lib/hawkSquad";
import { getCurrentAttendanceYear } from "@/lib/programYear";
import { availableBlocks, buildSnapshot, longDay, previousPeriod, SNAPSHOT_BLOCKS, type NameStyle, type SnapshotBlockKey, type SnapshotCheckIn } from "@/lib/programSnapshot";
import { buildProgramSnapshotPdf, snapshotFileName } from "@/lib/generateProgramSnapshotPdf";

interface Props {
  program: ProgramConfig;
  open: boolean;
  onClose: () => void;
  from: string;
  to: string;
  period: string;
  stats: HawkPeriodStats;
  breakdown: HawkBreakdown;
  rows: HawkIntelRow[];
  moments: Array<{ week: string; notes: string }>;
}

type Q = PromiseLike<{ data: unknown; error: { message: string } | null }> & { gte: (k: string, v: string) => Q; lte: (k: string, v: string) => Q; lt: (k: string, v: string) => Q; eq: (k: string, v: string) => Q; is: (k: string, v: null) => Q };
const table = (name: string) => supabase.from(name as never) as never as { select: (s: string, o?: { count: "exact"; head: boolean }) => Q & PromiseLike<{ count: number | null }> };

const ProgramSnapshotSheet = ({ program, open, onClose, from, to, period, stats, breakdown, rows, moments }: Props) => {
  const regCols = "id, youth_link_id, child_first_name, child_last_name, grade_level";
  const goingHome = program.hasGoingHome ? ", going_home" : "";
  const filtered = (q: Q) => (program.attendanceFilter ? q.eq(program.attendanceFilter.column, program.attendanceFilter.value) : q);

  // The period's check-ins with their times, for the attendance report.
  const { data: checkIns = [], isLoading: loadingCheckIns } = useQuery({
    queryKey: ["program-snapshot-checkins", program.key, from, to],
    enabled: open,
    queryFn: async (): Promise<SnapshotCheckIn[]> => {
      const { data, error } = await filtered(table(program.tables.attendance).select(`registration_id, check_in_date, check_in_at${goingHome}, ${program.tables.registrations}(${regCols})`).gte("check_in_date", from).lte("check_in_date", to));
      if (error) throw new Error(error.message);
      return ((data as Array<Record<string, unknown>>) ?? []).map((r) => {
        const reg = (r[program.tables.registrations] as { youth_link_id: string | null; child_first_name: string; child_last_name: string; grade_level: string | null } | null) ?? null;
        return {
          identity: reg?.youth_link_id ?? (r.registration_id as string), date: r.check_in_date as string, at: (r.check_in_at as string) ?? null,
          going_home: (r.going_home as "bus" | "dismissed" | undefined) ?? null, first: reg?.child_first_name ?? "", last: reg?.child_last_name ?? "", grade: reg?.grade_level ?? null,
        };
      });
    },
  });

  // Who had checked in before the period began: the returning students.
  const { data: prior = new Set<string>() } = useQuery({
    queryKey: ["program-snapshot-prior", program.key, from],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await filtered(table(program.tables.attendance).select(`registration_id, ${program.tables.registrations}(youth_link_id)`).lt("check_in_date", from));
      if (error) throw new Error(error.message);
      return new Set(((data as Array<Record<string, unknown>>) ?? []).map((r) => ((r[program.tables.registrations] as { youth_link_id: string | null } | null)?.youth_link_id) ?? (r.registration_id as string)));
    },
  });

  // The previous period of the same length, for the comparison block.
  const prev = useMemo(() => previousPeriod(from, to), [from, to]);
  const { data: previous = null } = useQuery({
    queryKey: ["program-snapshot-previous", program.key, prev.from, prev.to],
    enabled: open,
    queryFn: async (): Promise<HawkPeriodStats | null> => {
      const { data, error } = await filtered(table(program.tables.attendance).select(`registration_id, check_in_date${goingHome}, ${program.tables.registrations}(id, youth_link_id)`).gte("check_in_date", prev.from).lte("check_in_date", prev.to));
      if (error) throw new Error(error.message);
      const list = ((data as Array<Record<string, unknown>>) ?? []).map((r) => ({
        registration_id: r.registration_id as string, check_in_date: r.check_in_date as string, going_home: (r.going_home as "bus" | "dismissed") ?? "bus",
        reg: (r[program.tables.registrations] as HawkIntelRow["reg"]) ?? null,
      })) as HawkIntelRow[];
      if (!list.length) return null;
      return hawkPeriodStats(list, prev.from, prev.to, {}, hawkTodayET(), program.defaultWeekdays, program.scheduleDates);
    },
  });

  // Registered this program year: approved and not archived.
  const { data: registered = null } = useQuery({
    queryKey: ["program-snapshot-registered", program.key, from],
    enabled: open && !program.attendanceFilter,
    queryFn: async () => {
      const year = getCurrentAttendanceYear(new Date(`${from}T12:00:00`));
      const res = await (table(program.tables.registrations).select("id", { count: "exact", head: true }).eq("approved_for_attendance", "true").is("archived_at", null).eq("program_year", year) as unknown as PromiseLike<{ count: number | null; error: { message: string } | null }>);
      if (res.error) return null;
      return res.count;
    },
  });

  const [names, setNames] = useState<NameStyle>("full");
  const available = useMemo(() => availableBlocks({ hasCte: program.hasCte, hasGrades: program.grades.length > 0, hasPrevious: !!previous, hasMoments: moments.length > 0 }), [program.hasCte, program.grades.length, previous, moments.length]);
  const [off, setOff] = useState<Set<SnapshotBlockKey>>(new Set());
  const blocks = useMemo(() => new Set(available.filter((k) => !off.has(k))), [available, off]);
  const toggle = (k: SnapshotBlockKey) => setOff((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const snapshot = useMemo(() => buildSnapshot({ stats, breakdown, checkIns, priorIdentities: prior, registered, previous, moments, hasGoingHome: program.hasGoingHome, names }), [stats, breakdown, checkIns, prior, registered, previous, moments, program.hasGoingHome, names]);
  const on = (k: SnapshotBlockKey) => blocks.has(k);
  const printedOn = hawkTodayET();
  const [downloading, setDownloading] = useState(false);
  const download = () => {
    setDownloading(true);
    try {
      const doc = buildProgramSnapshotPdf({ program, period, blocks, snapshot, printedOn });
      doc.save(snapshotFileName(program, period, printedOn));
      toast.success("Snapshot downloaded.");
    } catch (e) {
      toast.error(`Couldn't build the PDF: ${(e as Error).message}`);
    } finally { setDownloading(false); }
  };

  // Identity helper kept for parity with the page's own math (the page's rows are the source of stats).
  void hawkIdentity;

  const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="rounded-md p-3 text-white" style={{ backgroundColor: program.brand.primary }}>
      <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-1.5" style={{ color: program.brand.accent }}>{label}</p>
      {sub && <p className="text-[10px] text-white/80 mt-0.5">{sub}</p>}
    </div>
  );
  const Table = ({ title, rows: r }: { title: string; rows: Array<{ label: string; n: number; pct: number }> }) => (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: program.brand.primary }}>{title}</p>
      <div className="mt-1 space-y-1">
        {r.map((x) => (
          <div key={x.label}>
            <div className="flex items-baseline gap-2 text-[12.5px]"><span className="flex-1 text-neutral-800">{x.label}</span><span className="font-semibold tabular-nums">{x.n}</span><span className="w-9 text-right text-neutral-500 tabular-nums">{x.pct}%</span></div>
            <div className="h-[2px] bg-neutral-200"><div className="h-full" style={{ width: `${x.pct}%`, backgroundColor: program.brand.primary }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
  const s = snapshot;
  const tiles: Array<{ label: string; value: string; sub?: string }> = [];
  if (on("reached")) tiles.push({ label: "Students reached", value: String(s.reached.students), sub: s.reached.registered != null ? `of ${s.reached.registered} registered · ${s.reached.pct}%` : undefined });
  if (on("sessions")) { tiles.push({ label: "Sessions held", value: String(s.sessions.held), sub: s.sessions.planned ? `of ${s.sessions.planned} planned` : undefined }); tiles.push({ label: "Check-ins", value: String(s.sessions.checkIns), sub: `${s.sessions.avg} per session` }); if (program.hasGoingHome) tiles.push({ label: "Bus / dismissed", value: `${s.sessions.bus} / ${s.sessions.dismissed}`, sub: "check-ins" }); }
  if (on("rate")) tiles.push({ label: `Attended ${s.rate.threshold}%+`, value: `${s.rate.pct}%`, sub: `${s.rate.consistent} of ${s.rate.of} students` });
  if (on("newReturning")) tiles.push({ label: "New / returning", value: `${s.newReturning.fresh} / ${s.newReturning.returning}`, sub: "first check-in in this period, or before" });
  if (on("minority")) tiles.push({ label: "Minority", value: `${s.minority.pct}%`, sub: `${s.minority.n} of ${s.minority.recorded} with a race recorded` });
  if (on("disadvantaged")) tiles.push({ label: "Economically disadvantaged", value: `${s.disadvantaged.pct}%`, sub: `${s.disadvantaged.n} of ${s.disadvantaged.of} students` });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl bg-neutral-900 border-white/10 text-white p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-white/10 flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-white">{program.name} Snapshot · {period}</DialogTitle>
            <p className="text-[12px] text-white/50">Untick any block that doesn't complement the program; the page and the PDF follow.</p>
          </div>
          <Button size="sm" onClick={download} disabled={downloading || loadingCheckIns} className={`${program.tw.button} font-semibold gap-2`}>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 grid md:grid-cols-[240px_1fr]">
          {/* The blocks */}
          <div className="border-b md:border-b-0 md:border-r border-white/10 p-4 overflow-y-auto space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">In the Snapshot</p>
            {SNAPSHOT_BLOCKS.filter((b) => available.includes(b.key)).map((b) => (
              <label key={b.key} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 cursor-pointer">
                <input type="checkbox" checked={blocks.has(b.key)} onChange={() => toggle(b.key)} className="mt-0.5 accent-current" style={{ accentColor: program.brand.ui }} />
                <span className="min-w-0">
                  <span className="block text-[13px] text-white">{b.label}</span>
                  <span className="block text-[11px] text-white/40 leading-tight">{b.hint}</span>
                </span>
              </label>
            ))}
            <div className="pt-3 mt-2 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Student names</p>
              {(["full", "initial"] as NameStyle[]).map((v) => (
                <label key={v} className="flex items-center gap-2 px-2 py-1 text-[13px] cursor-pointer">
                  <input type="radio" name="names" checked={names === v} onChange={() => setNames(v)} style={{ accentColor: program.brand.ui }} />
                  {v === "full" ? "Full names (for the school)" : "First name + initial (for a funder)"}
                </label>
              ))}
            </div>
          </div>

          {/* The page */}
          <div className="overflow-y-auto bg-neutral-800 p-4">
            <div className="mx-auto max-w-[8.5in] bg-white text-neutral-900 shadow-2xl">
              <div className="px-8 py-5 text-white" style={{ backgroundColor: program.brand.primary, borderBottom: `5px solid ${program.brand.accent}` }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-black tracking-wide" style={{ color: program.brand.accent }}>{program.brand.wordmark}</p>
                    <p className="text-[10px] text-white/80">{program.brand.sub}</p>
                    <p className="text-[12px] font-bold italic mt-1">{program.brand.tagline}</p>
                  </div>
                  <div className="text-right"><p className="font-bold">Snapshot</p><p className="text-[12px]" style={{ color: program.brand.accent }}>{period}</p></div>
                </div>
              </div>
              <div className="px-8 py-6 space-y-6">
                {loadingCheckIns && <p className="text-[12px] text-neutral-500">Reading the period's check-ins…</p>}
                {tiles.length > 0 && <div className="grid grid-cols-3 gap-2.5">{tiles.map((t) => <Tile key={t.label} {...t} />)}</div>}
                {(on("grade") || on("cte") || on("sex") || on("race")) && (
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                    {on("grade") && s.grade.length > 0 && <Table title="Grade" rows={s.grade} />}
                    {on("cte") && s.cte.length > 0 && <Table title="CTE program" rows={s.cte} />}
                    {on("sex") && s.sex.length > 0 && <Table title="Male / female" rows={s.sex} />}
                    {on("race") && s.race.length > 0 && <Table title="Race / ethnicity" rows={s.race} />}
                  </div>
                )}
                {on("comparison") && s.comparison && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: program.brand.primary }}>Compared to the previous period of the same length</p>
                    <div className="mt-1.5 grid grid-cols-4 gap-3">
                      {s.comparison.map((c) => (
                        <div key={c.label}><p className="text-[9px] uppercase tracking-wide text-neutral-500 font-bold">{c.label}</p><p className="text-lg font-bold tabular-nums">{c.now}</p><p className={`text-[11px] tabular-nums ${c.delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>{c.delta > 0 ? "+" : ""}{c.delta} vs {c.before}</p></div>
                      ))}
                    </div>
                  </div>
                )}
                {on("moments") && s.moments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: program.brand.primary }}>Weekly Standout Moments</p>
                    <div className="mt-1.5 space-y-2">{s.moments.map((m) => <div key={m.week}><p className="text-[12px] font-bold" style={{ color: program.brand.primary }}>{m.week}</p><p className="text-[12.5px] leading-relaxed whitespace-pre-wrap">{m.notes}</p></div>)}</div>
                  </div>
                )}
                {on("attendance") && s.attendance.sessions.length > 0 && (
                  <div className="pt-4 border-t border-neutral-200 space-y-4">
                    <div>
                      <p className="text-base font-bold">Attendance report</p>
                      <p className="text-[11px] text-neutral-500">{s.attendance.sessions.length} sessions · {s.sessions.checkIns} check-ins · {s.reached.students} students</p>
                    </div>
                    <table className="w-full text-[12px]">
                      <thead><tr className="text-white" style={{ backgroundColor: program.brand.primary }}><th className="text-left px-2 py-1 font-bold">Session</th><th className="text-right px-2 py-1">Checked in</th>{program.hasGoingHome && <><th className="text-right px-2 py-1">Bus</th><th className="text-right px-2 py-1">Dismissed</th></>}</tr></thead>
                      <tbody>
                        {s.attendance.sessions.map((ss, i) => <tr key={ss.date} className={i % 2 ? "bg-neutral-100" : ""}><td className="px-2 py-1">{longDay(ss.date)}</td><td className="px-2 py-1 text-right tabular-nums">{ss.count}</td>{program.hasGoingHome && <><td className="px-2 py-1 text-right tabular-nums">{ss.bus}</td><td className="px-2 py-1 text-right tabular-nums">{ss.dismissed}</td></>}</tr>)}
                        <tr className="bg-neutral-100 font-bold"><td className="px-2 py-1">Total</td><td className="px-2 py-1 text-right tabular-nums">{s.sessions.checkIns}</td>{program.hasGoingHome && <><td className="px-2 py-1 text-right tabular-nums">{s.sessions.bus}</td><td className="px-2 py-1 text-right tabular-nums">{s.sessions.dismissed}</td></>}</tr>
                      </tbody>
                    </table>
                    <div className="space-y-3">
                      {s.attendance.sessions.map((ss) => (
                        <div key={ss.date}>
                          <div className="flex items-baseline justify-between"><p className="text-[12.5px] font-bold">{longDay(ss.date)}</p><p className="text-[11px] text-neutral-500">{ss.count} checked in{program.hasGoingHome ? ` · ${ss.bus} bus · ${ss.dismissed} dismissed` : ""}</p></div>
                          <div className="grid grid-cols-3 gap-x-4 text-[11.5px]">{ss.people.map((p, i) => <div key={i} className="flex justify-between gap-2 border-b border-neutral-100 py-0.5"><span className="truncate">{p.name}</span><span className="text-neutral-500 shrink-0">{[p.time, program.hasGoingHome ? (p.goingHome === "dismissed" ? "D" : "B") : null].filter(Boolean).join(" · ")}</span></div>)}</div>
                        </div>
                      ))}
                      {program.hasGoingHome && <p className="text-[10px] italic text-neutral-500">B = rode the bus · D = dismissed from NLA</p>}
                    </div>
                    <table className="w-full text-[12px]">
                      <thead><tr className="text-white" style={{ backgroundColor: program.brand.primary }}><th className="text-left px-2 py-1 font-bold">Student</th><th className="text-right px-2 py-1">Sessions</th><th className="text-right px-2 py-1">Of</th><th className="text-right px-2 py-1">Rate</th>{program.hasGoingHome && <th className="text-right px-2 py-1">Bus / dism.</th>}</tr></thead>
                      <tbody>{s.attendance.students.map((st, i) => <tr key={st.name + i} className={i % 2 ? "bg-neutral-100" : ""}><td className="px-2 py-1">{st.name}</td><td className="px-2 py-1 text-right tabular-nums">{st.attended}</td><td className="px-2 py-1 text-right tabular-nums">{st.of}</td><td className="px-2 py-1 text-right tabular-nums">{st.pct}%</td>{program.hasGoingHome && <td className="px-2 py-1 text-right tabular-nums">{st.bus} / {st.dismissed}</td>}</tr>)}</tbody>
                    </table>
                  </div>
                )}
                <p className="text-[10px] italic text-neutral-500">From NLA's {program.name} check-in records, printed {new Date(`${printedOn}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramSnapshotSheet;
