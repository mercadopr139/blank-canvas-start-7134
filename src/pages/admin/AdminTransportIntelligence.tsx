import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, differenceInYears, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, FileText, Bus, Users, DollarSign, ArrowUpRight, ArrowDownRight, UserCheck } from "lucide-react";
import { getProgramYearForRegistration, programYearRange, shortProgramYear } from "@/lib/programYear";

/* ── zones ── */
const ZONES = ["Woodbine", "Wildwood"] as const;
type ZoneKey = (typeof ZONES)[number];
const ZONE_ACCENT: Record<ZoneKey, string> = { Woodbine: "#E0A400", Wildwood: "#8C1D3F" };

type Window = "month" | "year" | "all";

/* ── per-zone rolled-up stats ── */
type Breakdown = { label: string; count: number }[];
type ZoneStats = {
  trips: number;
  pickups: number;
  dropoffs: number;
  rides: number;
  uniqueYouth: number;
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

// Identical poverty rule to Attendance Intelligence so the two screens agree:
// a youth counts as at/below the line if their household income bracket is low
// OR they qualify for free/reduced lunch (NLA's primary economic-need signal).
const POVERTY_INCOMES = ["Under $25,000", "Less than $25,000", "Less than $35,000"];
const isBelowPoverty = (reg: any): boolean =>
  !!reg && (POVERTY_INCOMES.includes(reg.household_income_range) || reg.free_or_reduced_lunch === "Yes");

function windowRange(w: Window): [Date, Date] {
  const now = new Date();
  if (w === "month") return [startOfMonth(now), now];
  if (w === "all") return [new Date(2020, 0, 1), now];
  return programYearRange(getProgramYearForRegistration()); // program year
}

/* ── data fetch + per-zone computation ── */
async function buildIntelligence(w: Window) {
  const [start, end] = windowRange(w);
  const ds = format(start, "yyyy-MM-dd");
  const de = format(end, "yyyy-MM-dd");

  const { data: runsRaw } = await supabase
    .from("runs")
    .select("id, run_type, started_at, driver:drivers(name), route:routes(name)")
    .eq("status", "completed")
    .gte("started_at", ds)
    .lte("started_at", de + "T23:59:59");
  const runs = (runsRaw || []) as any[];

  // Attendance (batched) — carries each youth's pickup_zone via the join.
  const runIds = runs.map((r) => r.id);
  let attendance: any[] = [];
  for (let i = 0; i < runIds.length; i += 50) {
    const { data } = await supabase
      .from("transport_attendance")
      .select("run_id, youth_id, youth:youth_profiles(id, first_name, last_name, pickup_zone)")
      .in("run_id", runIds.slice(i, i + 50));
    if (data) attendance = attendance.concat(data);
  }

  // Registrations for demographics (matched to youth by name, like the report).
  const { data: regsRaw } = await supabase
    .from("youth_registrations")
    .select("child_first_name, child_last_name, child_date_of_birth, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch");
  const regs = (regsRaw || []) as any[];
  const regByName = new Map<string, any>();
  regs.forEach((r) => regByName.set(`${(r.child_first_name || "").toLowerCase()}|${(r.child_last_name || "").toLowerCase()}`, r));

  // run id → set of zones it actually served (from the youth carried).
  const runZones = new Map<string, Set<string>>();
  // unique youth → { zone, registration }
  const youthById = new Map<string, { zone: string; reg: any }>();
  attendance.forEach((a) => {
    const zone = a.youth?.pickup_zone;
    if (!zone || !ZONES.includes(zone)) return;
    if (!runZones.has(a.run_id)) runZones.set(a.run_id, new Set());
    runZones.get(a.run_id)!.add(zone);
    if (!youthById.has(a.youth_id)) {
      const reg = regByName.get(`${(a.youth?.first_name || "").toLowerCase()}|${(a.youth?.last_name || "").toLowerCase()}`);
      youthById.set(a.youth_id, { zone, reg: reg || null });
    }
  });

  // accumulator per zone (+ combined)
  type Acc = {
    trips: Set<string>; pickups: Set<string>; dropoffs: Set<string>; rides: number;
    youth: Set<string>; drivers: Map<string, Set<string>>;
    age: Record<string, number>; gender: Record<string, number>; race: Record<string, number>; poverty: Set<string>;
  };
  const mkAcc = (): Acc => ({
    trips: new Set(), pickups: new Set(), dropoffs: new Set(), rides: 0,
    youth: new Set(), drivers: new Map(), age: {}, gender: {}, race: {}, poverty: new Set(),
  });
  const acc: Record<string, Acc> = { Woodbine: mkAcc(), Wildwood: mkAcc(), Combined: mkAcc() };
  const bump = (a: Acc, driver: string, runId: string, type: string) => {
    a.trips.add(runId);
    if (type === "pickup") a.pickups.add(runId);
    if (type === "dropoff") a.dropoffs.add(runId);
    if (!a.drivers.has(driver)) a.drivers.set(driver, new Set());
    a.drivers.get(driver)!.add(runId);
  };

  // Trips / pickups / dropoffs / drivers — attribute each run to every zone it served.
  runs.forEach((r) => {
    const zones = runZones.get(r.id);
    if (!zones) return; // run with no zoned youth — skip
    const driver = r.driver?.name || "Unknown";
    zones.forEach((z) => bump(acc[z], driver, r.id, r.run_type));
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
    if (reg.child_date_of_birth) {
      const age = differenceInYears(new Date(), parseISO(reg.child_date_of_birth));
      if (age >= 0 && age < 30) targets.forEach((a) => { a.age[String(age)] = (a.age[String(age)] || 0) + 1; });
    }
    if (reg.child_sex) targets.forEach((a) => { a.gender[reg.child_sex] = (a.gender[reg.child_sex] || 0) + 1; });
    if (reg.child_race_ethnicity) targets.forEach((a) => { a.race[reg.child_race_ethnicity] = (a.race[reg.child_race_ethnicity] || 0) + 1; });
    if (isBelowPoverty(reg)) targets.forEach((a) => a.poverty.add(youthId));
  });

  const finalize = (a: Acc): ZoneStats => {
    const trips = a.trips.size;
    const uniqueYouth = a.youth.size;
    return {
      trips,
      pickups: a.pickups.size,
      dropoffs: a.dropoffs.size,
      rides: a.rides,
      uniqueYouth,
      avgYouthPerTrip: trips > 0 ? (a.rides / trips).toFixed(1) : "0",
      drivers: [...a.drivers.entries()].map(([name, ids]) => ({ name, trips: ids.size })).sort((x, y) => y.trips - x.trips),
      age: sortBreakdown(a.age).sort((x, y) => Number(x.label) - Number(y.label)),
      gender: sortBreakdown(a.gender),
      race: sortBreakdown(a.race),
      povertyCount: a.poverty.size,
      povertyPct: uniqueYouth > 0 ? ((a.poverty.size / uniqueYouth) * 100).toFixed(0) : "0",
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
          <p className="text-white/40 text-[11px]">{stats.povertyCount} of {stats.uniqueYouth} youth</p>
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
  const [win, setWin] = useState<Window>("year");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["transport-intelligence", win],
    queryFn: () => buildIntelligence(win),
    staleTime: 60_000,
  });

  const windowLabel = useMemo(() => {
    if (win === "month") return format(new Date(), "MMMM yyyy");
    if (win === "all") return "All-time";
    return `Program Year ${shortProgramYear(getProgramYearForRegistration())}`;
  }, [win]);

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
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            {([["month", "This Month"], ["year", "Program Year"], ["all", "All-Time"]] as [Window, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setWin(k)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${win === k ? "bg-[#CC0000] text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                {label}
              </button>
            ))}
          </div>
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
            Trips serving both communities count toward each zone. Youth are counted once, in their home pickup zone.
            Demographics reflect youth matched to a registration record.
          </p>
        </>
      )}
    </div>
  );
}
