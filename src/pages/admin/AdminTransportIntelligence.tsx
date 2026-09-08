import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, differenceInYears, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, FileText, Bus, Users, DollarSign, ArrowUpRight, ArrowDownRight, UserCheck } from "lucide-react";
import {
  getCurrentAttendanceYear, programYearRange, shortProgramYear, nextProgramYear,
} from "@/lib/programYear";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { isBelowPoverty } from "@/lib/demographics";
import { fetchAllRows } from "@/lib/fetchAllRows";

/* ── zones ── */
const ZONES = ["Woodbine", "Wildwood"] as const;
type ZoneKey = (typeof ZONES)[number];
const ZONE_ACCENT: Record<ZoneKey, string> = { Woodbine: "#E0A400", Wildwood: "#8C1D3F" };

// A reporting period is either this calendar month or one program year.
// "All-time" used to be an option and has been removed on purpose: nobody
// reports on it, and sooner or later somebody reads a number off it and puts it
// in a grant application as though it were a year.
type Period = "month" | string; // "month" | "2025-2026" | "2026-2027" | …

/* ── per-zone rolled-up stats ── */
type Breakdown = { label: string; count: number }[];
type ZoneStats = {
  trips: number;
  pickups: number;
  dropoffs: number;
  rides: number;
  uniqueYouth: number;
  assessedYouth: number;
  avgYouthPerTrip: string;
  drivers: { name: string; trips: number }[];
  age: Breakdown;
  gender: Breakdown;
  race: Breakdown;
  povertyCount: number;
  povertyPct: string;
};

const sortBreakdown = (rec: Record<string, number>): Breakdown =>
  Object.entries(rec).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

// Poverty rule lives in one place (@/lib/demographics) so every Intelligence
// screen and the printed report agree — see isBelowPoverty.

function windowRange(period: Period): [Date, Date] {
  const now = new Date();
  if (period === "month") return [startOfMonth(now), now];
  // In-session attendance year (flips Sept 1), not the sign-up year (flips
  // Aug 1) — otherwise Aug 1–31 points at next season's future window and
  // shows "no completed trips".
  return programYearRange(period);
}

/** The program year a period reports on, used to match registrations to it. */
const periodYear = (period: Period) =>
  period === "month" ? getCurrentAttendanceYear() : period;

/**
 * Which program years to offer — derived from the ride data rather than hard
 * coded, so next September's year appears on its own and nobody has to
 * remember to add it.
 */
async function availableYears(): Promise<string[]> {
  const { data } = await supabase
    .from("runs")
    .select("started_at")
    .eq("status", "completed")
    .order("started_at", { ascending: true })
    .limit(1);

  const current = getCurrentAttendanceYear();
  const first = data?.[0]?.started_at;
  if (!first) return [current];

  const years: string[] = [];
  let tag = getCurrentAttendanceYear(new Date(first));
  // Walk forward to today. Bounded so a bad date can never spin forever.
  for (let i = 0; i < 30 && tag !== current; i++) {
    years.push(tag);
    tag = nextProgramYear(tag);
  }
  years.push(current);
  return years.reverse(); // newest first
}

/* ── data fetch + per-zone computation ── */
async function buildIntelligence(period: Period) {
  const [start, end] = windowRange(period);
  const year = periodYear(period);
  // Ages are reported as of the END of the period, capped at today. Computing
  // them from today would describe last season's riders with this season's
  // ages — a 14-year-old driven all last year would appear in the 2025-26
  // breakdown as 15.
  const asOf = end.getTime() > Date.now() ? new Date() : end;
  const ds = format(start, "yyyy-MM-dd");
  const de = format(end, "yyyy-MM-dd");

  const runs = (await fetchAllRows((from, to) =>
    supabase
      .from("runs")
      .select("id, run_type, started_at, driver:drivers(name), route:routes(name)")
      .eq("status", "completed")
      .gte("started_at", ds)
      .lte("started_at", de + "T23:59:59")
      .range(from, to)
  )) as any[];

  // Attendance (batched) — carries each youth's pickup_zone via the join.
  const runIds = runs.map((r) => r.id);
  let attendance: any[] = [];
  for (let i = 0; i < runIds.length; i += 50) {
    const { data } = await supabase
      .from("transport_attendance")
      .select("run_id, youth_id, youth:youth_profiles(id, first_name, last_name, pickup_zone)")
      .neq("status", "no_show") // a no-show isn't a ride given or a youth served
      .in("run_id", runIds.slice(i, i + 50));
    if (data) attendance = attendance.concat(data);
  }

  // Registrations for demographics (matched to youth by name, like the report).
  const regs = (await fetchAllRows((from, to) =>
    supabase
      .from("youth_registrations")
      .select("child_first_name, child_last_name, child_date_of_birth, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch, program_year")
      .range(from, to)
  )) as any[];

  // Riders are matched to registrations BY NAME, and a youth has one
  // registration per program year. This used to keep whichever row happened to
  // load last, so the poverty figure could be computed from a different year's
  // paperwork than the year on screen — income and free/reduced lunch are
  // exactly the fields that change year to year. Now every registration for a
  // name is kept and the one for the year being viewed wins, falling back to
  // their most recent.
  const regsByName = new Map<string, any[]>();
  regs.forEach((r) => {
    const key = `${(r.child_first_name || "").toLowerCase()}|${(r.child_last_name || "").toLowerCase()}`;
    if (!regsByName.has(key)) regsByName.set(key, []);
    regsByName.get(key)!.push(r);
  });
  const regForYear = (key: string) => {
    const list = regsByName.get(key);
    if (!list?.length) return null;
    return (
      list.find((r) => r.program_year === year) ??
      [...list].sort((a, b) => String(b.program_year ?? "").localeCompare(String(a.program_year ?? "")))[0]
    );
  };

  // run id → youth count per zone, so each trip can be attributed to ONE primary
  // zone (the zone most of its riders came from). That single-assignment is what
  // makes the two zone columns add up exactly to the Combined total.
  const runZoneCounts = new Map<string, Record<string, number>>();
  // unique youth → { zone, registration }
  const youthById = new Map<string, { zone: string; reg: any }>();
  attendance.forEach((a) => {
    const zone = a.youth?.pickup_zone;
    if (!zone || !ZONES.includes(zone)) return;
    if (!runZoneCounts.has(a.run_id)) runZoneCounts.set(a.run_id, {});
    const rec = runZoneCounts.get(a.run_id)!;
    rec[zone] = (rec[zone] || 0) + 1;
    if (!youthById.has(a.youth_id)) {
      const reg = regForYear(`${(a.youth?.first_name || "").toLowerCase()}|${(a.youth?.last_name || "").toLowerCase()}`);
      youthById.set(a.youth_id, { zone, reg: reg || null });
    }
  });

  // A run's primary zone = the zone most of its riders came from (ties broken by
  // ZONES order for a stable, deterministic result).
  const primaryZone = (runId: string): ZoneKey | null => {
    const rec = runZoneCounts.get(runId);
    if (!rec) return null;
    let best: ZoneKey | null = null;
    let bestN = 0;
    for (const z of ZONES) {
      const n = rec[z] || 0;
      if (n > bestN) { bestN = n; best = z; }
    }
    return best;
  };

  // accumulator per zone (+ combined)
  type Acc = {
    trips: Set<string>; pickups: Set<string>; dropoffs: Set<string>; rides: number;
    youth: Set<string>; matched: Set<string>; drivers: Map<string, Set<string>>;
    age: Record<string, number>; gender: Record<string, number>; race: Record<string, number>; poverty: Set<string>;
  };
  const mkAcc = (): Acc => ({
    trips: new Set(), pickups: new Set(), dropoffs: new Set(), rides: 0,
    youth: new Set(), matched: new Set(), drivers: new Map(), age: {}, gender: {}, race: {}, poverty: new Set(),
  });
  const acc: Record<string, Acc> = { Woodbine: mkAcc(), Wildwood: mkAcc(), Combined: mkAcc() };
  const bump = (a: Acc, driver: string, runId: string, type: string) => {
    a.trips.add(runId);
    if (type === "pickup") a.pickups.add(runId);
    if (type === "dropoff") a.dropoffs.add(runId);
    if (!a.drivers.has(driver)) a.drivers.set(driver, new Set());
    a.drivers.get(driver)!.add(runId);
  };

  // Trips / pickups / dropoffs / drivers — each run counted ONCE, in its primary
  // zone, so Woodbine + Wildwood always equals the Combined total.
  runs.forEach((r) => {
    const primary = primaryZone(r.id);
    if (!primary) return; // run with no zoned youth — skip
    const driver = r.driver?.name || "Unknown";
    bump(acc[primary], driver, r.id, r.run_type);
    bump(acc.Combined, driver, r.id, r.run_type); // combined counts the run once
  });

  // Rides — one per attendance record, by that youth's zone.
  attendance.forEach((a) => {
    const zone = a.youth?.pickup_zone;
    if (!zone || !ZONES.includes(zone)) return;
    acc[zone].rides++; acc.Combined.rides++;
  });

  // Youth + demographics — once per unique youth.
  youthById.forEach((info, youthId) => {
    const targets = [acc[info.zone], acc.Combined];
    targets.forEach((a) => a.youth.add(youthId));
    const reg = info.reg;
    if (!reg) return;
    // Only youth matched to a registration can be assessed for poverty — track
    // them so the poverty % divides by "assessed," not by all youth served.
    targets.forEach((a) => a.matched.add(youthId));
    if (reg.child_date_of_birth) {
      const age = differenceInYears(asOf, parseISO(reg.child_date_of_birth));
      if (age >= 0 && age < 30) targets.forEach((a) => { a.age[String(age)] = (a.age[String(age)] || 0) + 1; });
    }
    if (reg.child_sex) targets.forEach((a) => { a.gender[reg.child_sex] = (a.gender[reg.child_sex] || 0) + 1; });
    if (reg.child_race_ethnicity) targets.forEach((a) => { a.race[reg.child_race_ethnicity] = (a.race[reg.child_race_ethnicity] || 0) + 1; });
    if (isBelowPoverty(reg)) targets.forEach((a) => a.poverty.add(youthId));
  });

  const finalize = (a: Acc): ZoneStats => {
    const trips = a.trips.size;
    const uniqueYouth = a.youth.size;
    const assessedYouth = a.matched.size;
    return {
      trips,
      pickups: a.pickups.size,
      dropoffs: a.dropoffs.size,
      rides: a.rides,
      uniqueYouth,
      assessedYouth,
      avgYouthPerTrip: trips > 0 ? (a.rides / trips).toFixed(1) : "0",
      drivers: [...a.drivers.entries()].map(([name, ids]) => ({ name, trips: ids.size })).sort((x, y) => y.trips - x.trips),
      age: sortBreakdown(a.age).sort((x, y) => Number(x.label) - Number(y.label)),
      gender: sortBreakdown(a.gender),
      race: sortBreakdown(a.race),
      povertyCount: a.poverty.size,
      // Divide by ASSESSED youth (matched to a registration), matching the
      // printed report — not by all youth served, which would read low.
      povertyPct: assessedYouth > 0 ? ((a.poverty.size / assessedYouth) * 100).toFixed(0) : "0",
    };
  };

  return {
    Woodbine: finalize(acc.Woodbine),
    Wildwood: finalize(acc.Wildwood),
    Combined: finalize(acc.Combined),
    range: [start, end] as [Date, Date],
    generatedAt: new Date(),
  };
}

/* ── small UI pieces ── */
const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-white/5 rounded-lg p-3 text-center">
    <p className="text-2xl font-bold text-white leading-none">{value}</p>
    <p className="text-white/50 text-[11px] mt-1.5 leading-tight">{label}</p>
  </div>
);

const BreakdownRows = ({ title, items, total }: { title: string; items: Breakdown; total: number }) => (
  <div>
    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">{title}</p>
    {items.length === 0 ? (
      <p className="text-white/30 text-xs">No data</p>
    ) : (
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            <span className="text-white/70 text-xs w-28 shrink-0 truncate">{it.label}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-white/25 rounded-full" style={{ width: `${total > 0 ? (it.count / total) * 100 : 0}%` }} />
            </div>
            <span className="text-white/50 text-xs w-8 text-right shrink-0">{it.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ZoneColumn = ({ name, stats }: { name: ZoneKey; stats: ZoneStats }) => (
  <Card className="bg-zinc-900/60 border-white/10 overflow-hidden">
    <div className="h-1.5" style={{ backgroundColor: ZONE_ACCENT[name] }} />
    <CardHeader className="pb-3">
      <CardTitle className="text-white flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ZONE_ACCENT[name] }} />
        {name}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Trips" value={stats.trips} />
        <Kpi label="Rides Provided" value={stats.rides} />
        <Kpi label="Youth Served" value={stats.uniqueYouth} />
        <Kpi label="Avg Youth / Trip" value={stats.avgYouthPerTrip} />
        <Kpi label="Pickups" value={stats.pickups} />
        <Kpi label="Drop-offs" value={stats.dropoffs} />
      </div>

      <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-[11px]">At / below federal poverty line</p>
          <p className="text-white/40 text-[11px]">{stats.povertyCount} of {stats.assessedYouth} assessed</p>
        </div>
        <p className="text-2xl font-bold" style={{ color: ZONE_ACCENT[name] }}>{stats.povertyPct}%</p>
      </div>

      <div>
        <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Drivers</p>
        {stats.drivers.length === 0 ? <p className="text-white/30 text-xs">No drivers</p> : (
          <div className="space-y-1">
            {stats.drivers.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="text-white/70 truncate">{d.name}</span>
                <span className="text-white/40">{d.trips} trip{d.trips === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BreakdownRows title="Age" items={stats.age.map((a) => ({ label: `Age ${a.label}`, count: a.count }))} total={stats.uniqueYouth} />
      <BreakdownRows title="Gender" items={stats.gender} total={stats.uniqueYouth} />
      <BreakdownRows title="Race / Ethnicity" items={stats.race} total={stats.uniqueYouth} />
    </CardContent>
  </Card>
);

/* ── page ── */
export default function AdminTransportIntelligence() {
  const navigate = useNavigate();
  // Defaults to the program year in session, which is what anyone opening this
  // page wants nine times in ten.
  const [period, setPeriod] = useState<Period>(() => getCurrentAttendanceYear());

  const { data: years = [] } = useQuery({
    queryKey: ["transport-intelligence-years"],
    queryFn: availableYears,
    staleTime: 60 * 60 * 1000,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["transport-intelligence", period],
    queryFn: () => buildIntelligence(period),
    staleTime: 60_000,
  });

  const windowLabel = useMemo(
    () =>
      period === "month"
        ? format(new Date(), "MMMM yyyy")
        : `Program Year ${shortProgramYear(period)}`,
    [period]
  );

  const combined = data?.Combined;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bus className="w-6 h-6 text-red-400" /> Transportation Intelligence</h1>
          <p className="text-white/50 text-sm mt-1">Live snapshot of who we serve — Woodbine and Wildwood, side by side.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* One control, one answer to "what period am I looking at". */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[190px] bg-zinc-900 border-white/15 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/15 text-white">
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  Program Year {shortProgramYear(y)}
                </SelectItem>
              ))}
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-white/15 text-white hover:bg-white/10 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/admin/operations/transportation/impact-reports")} className="bg-[#002868] hover:bg-[#002868]/80 text-white gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Dated Report
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
      ) : !combined || combined.trips === 0 ? (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardContent className="py-16 text-center">
            <Bus className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No completed trips in {windowLabel.toLowerCase()}</p>
            <p className="text-white/40 text-sm mt-1">Try a wider window, or check back once trips are logged.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* combined strip */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/70 text-sm font-semibold">Combined · {windowLabel}</p>
              {data?.generatedAt && <p className="text-white/30 text-xs">Updated {format(data.generatedAt, "MMM d, h:mm a")}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Total Trips" value={combined.trips} />
              <Kpi label="Rides Provided" value={combined.rides} />
              <Kpi label="Youth Served" value={combined.uniqueYouth} />
              <Kpi label="Avg Youth / Trip" value={combined.avgYouthPerTrip} />
              <Kpi label="% ≤ Poverty Line" value={`${combined.povertyPct}%`} />
            </div>
          </div>

          {/* two zone columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ZoneColumn name="Woodbine" stats={data!.Woodbine} />
            <ZoneColumn name="Wildwood" stats={data!.Wildwood} />
          </div>

          <p className="text-white/30 text-xs text-center">
            Each trip is counted once, in the zone most of its riders came from, so the two zones add up to the total.
            Youth are counted once, in their home pickup zone. Demographics reflect youth matched to a registration record.
          </p>
        </>
      )}
    </div>
  );
}
