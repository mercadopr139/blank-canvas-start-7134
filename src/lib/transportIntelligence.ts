// The Transport Intelligence math — trips, rides, youth served and the
// economically disadvantaged share, per pick-up zone — in one place, so the
// dashboard, the printed report and Grant Coach's live numbers all say the
// same thing (Josh, 2026-10-29: the reviewer called the dashboard's figures
// "not NLA's recorded numbers" because the writer computed them its own way).
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, differenceInYears, parseISO } from "date-fns";
import { getCurrentAttendanceYear, programYearRange, nextProgramYear } from "@/lib/programYear";
import { isBelowPoverty, isSingleParent } from "@/lib/demographics";
import { groupOf, GROUP_LABEL } from "@/lib/districtGroups";
import { fetchAllRows } from "@/lib/fetchAllRows";

/* ── zones ── */
export const ZONES = ["Woodbine", "Wildwood"] as const;
export type ZoneKey = (typeof ZONES)[number];
export const ZONE_ACCENT: Record<ZoneKey, string> = { Woodbine: "#E0A400", Wildwood: "#8C1D3F" };

// A reporting period is either this calendar month or one program year.
// "All-time" used to be an option and has been removed on purpose: nobody
// reports on it, and sooner or later somebody reads a number off it and puts it
// in a grant application as though it were a year.
export type Period = "month" | string; // "month" | "2025-2026" | "2026-2027" | …

/* ── per-zone rolled-up stats ── */
export type Breakdown = { label: string; count: number }[];
export type ZoneStats = {
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
  /** School districts, grouped and named as the By School District chart (2026-10-30). */
  district: Breakdown;
  /** Riders from a single-parent household (Mom Only / Dad Only), of the assessed youth (2026-10-30). */
  singleParentCount: number;
  singleParentPct: string;
  povertyCount: number;
  povertyPct: string;
};

export const sortBreakdown = (rec: Record<string, number>): Breakdown =>
  Object.entries(rec).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

// Poverty rule lives in one place (@/lib/demographics) so every Intelligence
// screen and the printed report agree — see isBelowPoverty.

export function windowRange(period: Period): [Date, Date] {
  const now = new Date();
  if (period === "month") return [startOfMonth(now), now];
  // In-session attendance year (flips Sept 1), not the sign-up year (flips
  // Aug 1) — otherwise Aug 1–31 points at next season's future window and
  // shows "no completed trips".
  return programYearRange(period);
}

/** The program year a period reports on, used to match registrations to it. */
export const periodYear = (period: Period) =>
  period === "month" ? getCurrentAttendanceYear() : period;

/**
 * Which program years to offer — derived from the ride data rather than hard
 * coded, so next September's year appears on its own and nobody has to
 * remember to add it.
 */
export async function availableYears(): Promise<string[]> {
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
export async function buildIntelligence(period: Period) {
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
      .select("child_first_name, child_last_name, child_date_of_birth, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch, program_year, family_structure, child_school_district")
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
    age: Record<string, number>; gender: Record<string, number>; race: Record<string, number>; district: Record<string, number>;
    singleParent: Set<string>; poverty: Set<string>;
  };
  const mkAcc = (): Acc => ({
    trips: new Set(), pickups: new Set(), dropoffs: new Set(), rides: 0,
    youth: new Set(), matched: new Set(), drivers: new Map(), age: {}, gender: {}, race: {}, district: {}, singleParent: new Set(), poverty: new Set(),
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
    if (isSingleParent(reg)) targets.forEach((a) => a.singleParent.add(youthId));
    // The district, grouped exactly as the By School District chart groups it (Lower Cape May, not Lower Township alone).
    const district = GROUP_LABEL[groupOf(reg.child_school_district)].name;
    targets.forEach((a) => { a.district[district] = (a.district[district] || 0) + 1; });
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
      district: sortBreakdown(a.district),
      singleParentCount: a.singleParent.size,
      singleParentPct: assessedYouth > 0 ? ((a.singleParent.size / assessedYouth) * 100).toFixed(0) : "0",
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
