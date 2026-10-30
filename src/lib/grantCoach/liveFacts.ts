// The live numbers behind a grant draft.
//
// Grant Coach never makes a number up: every figure it writes comes from the
// back end, for a stated period, with the source named. This module gathers
// those facts (youth served, attendance, demographics, meals, rides, Juniors
// Aftercare sessions) and the folder page shows the same list to Josh, so
// what the writer was told and what he can see are one thing.
//
// The year: the last COMPLETE program year (Sept 1 – Aug 31), and only that.
// Josh's rule (2026-10-17): a complete year gives a grant reader an honest
// picture of where NLA is; "so far this year" numbers in October would not.
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAttendanceYear, programYearRange, shortProgramYear } from "@/lib/programYear";
import { buildIntelligence, type ZoneStats } from "@/lib/transportIntelligence";
import { isSingleParent as isSingleParentShared } from "@/lib/demographics";
import { groupOf, GROUP_LABEL } from "@/lib/districtGroups";
import { isBelowPoverty } from "@/lib/demographics";

export interface Fact {
  /** Stable id, e.g. "youth_served.last" */
  key: string;
  label: string;
  value: string;
  /** The period the number covers, in words. */
  period: string;
  /** Where it comes from, in words. */
  source: string;
}

export interface FactPeriod {
  key: "last";
  /** The program year, e.g. "2025-2026". */
  year: string;
  label: string;
  from: string;
  to: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The one period a draft speaks about: the last complete program year. */
export const factPeriods = (today = new Date()): FactPeriod[] => {
  const current = getCurrentAttendanceYear(today);
  const lastYear = `${Number(current.slice(0, 4)) - 1}-${Number(current.slice(0, 4))}`;
  const [ls, le] = programYearRange(lastYear);
  return [
    { key: "last", year: lastYear, label: `program year ${shortProgramYear(lastYear)}, the last complete year (${fmtDay(iso(ls))} – ${fmtDay(iso(le))})`, from: iso(ls), to: iso(le) },
  ];
};

/** The program year the facts describe, e.g. "2025-26". */
export const factYearLabel = (today = new Date()) => shortProgramYear(factPeriods(today)[0].year);

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/* ── Pure summaries, so they can be tested without a database ── */

export interface RegRow {
  id: string;
  youth_link_id: string | null;
  program_year: string | null;
  child_sex: string | null;
  child_race_ethnicity: string | null;
  household_income_range: string | null;
  free_or_reduced_lunch: string | null;
  child_school_district: string | null;
  /** The family-structure answer on the registration form ("Mom Only", "Dad and Mom", …). */
  family_structure: string | null;
  child_date_of_birth: string | null;
}

/**
 * Single-parent, by the rule Josh set on 2026-06-16 for the funder snapshot:
 * "Mom Only", "Dad Only", or the backfill label "Single Parent Household".
 * Nothing else counts, not "Other" and not a bare number of adults.
 */
export const isSingleParent = isSingleParentShared;

/**
 * Districts exactly as the By School District chart groups and names them
 * (src/lib/districtGroups.ts): Lower Cape May = Cape May, West Cape May and
 * Lower Township; Middle includes Dennis; Wildwood includes the Crest and
 * North Wildwood. One grouping, so Grant Coach and the chart never disagree
 * (Josh, 2026-10-30: "I see 20% for Lower, not 19!").
 */
export const districtGroup = (d: string | null | undefined) => GROUP_LABEL[groupOf(d)].name;

/** One person per youth (re-registrations collapse), then the shares funders ask for. */
export const summarizeRegistrations = (rows: RegRow[], asOf = new Date()) => {
  const byPerson = new Map<string, RegRow>();
  rows.forEach((r) => byPerson.set(r.youth_link_id ?? r.id, r));
  const people = [...byPerson.values()];
  const n = people.length;
  const tally = (pick: (r: RegRow) => string | null | undefined) => {
    const m: Record<string, number> = {};
    people.forEach((r) => { const k = (pick(r) ?? "").trim() || "Not given"; m[k] = (m[k] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  // Ages: the median and the share inside NLA's 7–19 range. A single mistyped
  // birth date cannot move either, where it would set a min or a max.
  const ages = people
    .map((r) => (r.child_date_of_birth ? Math.floor((asOf.getTime() - new Date(r.child_date_of_birth + "T12:00:00").getTime()) / (365.25 * 86_400_000)) : null))
    .filter((a): a is number => a != null && a >= 0 && a <= 99)
    .sort((a, b) => a - b);
  const median = ages.length ? ages[Math.floor((ages.length - 1) / 2)] : null;
  return {
    youth: n,
    economicallyDisadvantaged: people.filter(isBelowPoverty).length,
    singleParent: people.filter(isSingleParent).length,
    sex: tally((r) => r.child_sex),
    race: tally((r) => r.child_race_ethnicity),
    districts: tally((r) => districtGroup(r.child_school_district)),
    agesKnown: ages.length,
    ageMedian: median,
    ageInRange: ages.filter((a) => a >= 7 && a <= 19).length,
  };
};

export interface AttRow { registration_id: string; check_in_date: string; program_source: string | null }

/** Nights, check-ins and distinct youth for the gym program, plus the other sources. */
export const summarizeAttendance = (rows: AttRow[]) => {
  const nla = rows.filter((r) => (r.program_source ?? "NLA") === "NLA");
  const nights = new Set(nla.map((r) => r.check_in_date)).size;
  const youth = new Set(nla.map((r) => r.registration_id)).size;
  const bySource: Record<string, number> = {};
  rows.forEach((r) => { const k = r.program_source ?? "NLA"; bySource[k] = (bySource[k] ?? 0) + 1; });
  return { checkIns: nla.length, nights, youth, avgPerNight: nights ? Math.round(nla.length / nights) : 0, bySource };
};

/**
 * The span a set of dated records actually covers. Some logs (the kiosk, the
 * Meal Tracker, the driver app) began partway through a year; a count from
 * such a log is "since logging began", never the year's total. The writer is
 * told so, and the sidebar shows it.
 */
export const coverage = (dates: string[], period: { from: string; to: string }) => {
  const sorted = [...new Set(dates.filter(Boolean).map((d) => d.slice(0, 10)))].sort();
  if (!sorted.length) return { first: null, last: null, partial: false, note: "" };
  const first = sorted[0], last = sorted[sorted.length - 1];
  const dayGap = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000);
  const startsLate = dayGap(period.from, first) > 21;
  const endsEarly = dayGap(last, period.to) > 21;
  const partial = startsLate || endsEarly;
  const note = partial
    ? ` — records on file ${fmtDay(first)} to ${fmtDay(last)} only, not the whole year${startsLate ? " (logging began partway through)" : ""}`
    : "";
  return { first, last, partial, note };
};

/**
 * Rates from the full months a log covers.
 *
 * A log that began partway through the year cannot give the year's total,
 * but every complete month inside it is a true measurement: meals a night,
 * youth a night, nights a week. Josh's rule (2026-10-17): use those rates,
 * and the strongest full month named as such, so the numbers are honest
 * and show NLA at its real size. Never project beyond them.
 */
export interface DatedRow { date: string; count?: number; who?: string }
export interface MonthRate {
  /** "2026-05" */
  month: string;
  label: string;
  nights: number;
  total: number;
  perNight: number;
  nightsPerWeek: number;
  people: number | null;
}

const monthLabel = (ym: string) => new Date(ym + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
const daysIn = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();

export const fullMonthRates = (rows: DatedRow[], period: { from: string; to: string }, minNights = 4): MonthRate[] => {
  const dated = rows.map((r) => ({ ...r, date: r.date.slice(0, 10) })).filter((r) => r.date >= period.from && r.date <= period.to);
  if (!dated.length) return [];
  const dates = dated.map((r) => r.date).sort();
  const first = dates[0], last = dates[dates.length - 1];
  // The first month counts as full only if logging was running by the 5th;
  // the last only if it ran past the 25th (or to the end of the period).
  const firstFull = Number(first.slice(8, 10)) <= 5 ? first.slice(0, 7) : nextMonth(first.slice(0, 7));
  const lastFull = (Number(last.slice(8, 10)) >= 25 || last === period.to) ? last.slice(0, 7) : prevMonth(last.slice(0, 7));
  const byMonth = new Map<string, DatedRow[]>();
  dated.forEach((r) => { const m = r.date.slice(0, 7); byMonth.set(m, [...(byMonth.get(m) ?? []), r]); });
  return [...byMonth.entries()]
    .filter(([m]) => m >= firstFull && m <= lastFull)
    .map(([m, rs]) => {
      const nights = new Set(rs.map((r) => r.date)).size;
      const total = rs.reduce((s, r) => s + (r.count ?? 1), 0);
      const people = rs.some((r) => r.who) ? new Set(rs.map((r) => r.who).filter(Boolean)).size : null;
      return { month: m, label: monthLabel(m), nights, total, perNight: nights ? Math.round(total / nights) : 0, nightsPerWeek: Math.round((nights / (daysIn(m) / 7)) * 10) / 10, people };
    })
    .filter((r) => r.nights >= minNights)
    .sort((a, b) => a.month.localeCompare(b.month));
};
const nextMonth = (ym: string) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const prevMonth = (ym: string) => { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

/** The full months as one line, strongest month first, for a fact. */
export const describeRates = (rates: MonthRate[], unit: string, peopleWord?: string) => {
  if (!rates.length) return "";
  const best = [...rates].sort((a, b) => b.perNight - a.perNight)[0];
  const avg = Math.round(rates.reduce((s, r) => s + r.perNight, 0) / rates.length);
  const months = rates.map((r) => `${r.label}: ${r.perNight} ${unit} a night over ${r.nights} nights (${r.nightsPerWeek} nights a week)${r.people != null && peopleWord ? `, ${r.people} ${peopleWord}` : ""}`).join("; ");
  return ` Full months logged — ${months}. Strongest full month: ${best.label}, ${best.perNight} ${unit} a night. Average across full months: ${avg} ${unit} a night.`;
};

/* ── Estimates Josh can stand behind (2026-10-22) ──
   The Meal Tracker and the driver app are younger than a program year, so a
   year's total would undersell NLA and a projection would overstate it.
   These name their basis every time: the rate measured, and the nights it is
   multiplied by — dinner nights (Monday to Friday), never calendar days. */

/** Monday-to-Friday nights between two dates, inclusive (YYYY-MM-DD). */
export const weekdayNights = (from: string, to: string) => {
  const [fy, fm, fd] = from.split("-").map(Number), [ty, tm, td] = to.split("-").map(Number);
  const d = new Date(fy, fm - 1, fd), end = new Date(ty, tm - 1, td);
  let n = 0;
  for (; d <= end; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w >= 1 && w <= 5) n += 1; }
  return n;
};

export interface MealEstimate {
  month: string; monthLabel: string; nights: number; meals: number; perNight: number;
  monthNights: number; monthly: number; seasonFrom: string; seasonTo: string; seasonNights: number; season: number;
}

/**
 * The Meal Train at this month's rate: meals a night so far this month, times
 * the month's dinner nights, and times the dinner nights from the season's
 * first meal to June 30. Holidays are not taken out, so it is "about".
 */
export const mealEstimate = (rows: { date: string; count: number }[], today: string): MealEstimate | null => {
  const month = today.slice(0, 7);
  const these = rows.filter((r) => r.date.slice(0, 7) === month);
  const nights = new Set(these.map((r) => r.date)).size;
  if (nights < 4) return null;
  const meals = these.reduce((t, r) => t + (r.count ?? 0), 0);
  const perNight = Math.round(meals / nights);
  const [y, m] = month.split("-").map(Number);
  const monthEnd = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const monthNights = weekdayNights(`${month}-01`, monthEnd);
  const seasonFrom = rows.map((r) => r.date).sort()[0];
  const sy = Number(seasonFrom.slice(5, 7)) >= 7 ? Number(seasonFrom.slice(0, 4)) + 1 : Number(seasonFrom.slice(0, 4));
  const seasonTo = `${sy}-06-30`;
  const seasonNights = weekdayNights(seasonFrom, seasonTo);
  return {
    month, monthLabel: new Date(y, m - 1, 15).toLocaleDateString("en-US", { month: "long", year: "numeric" }), nights, meals, perNight,
    monthNights, monthly: perNight * monthNights, seasonFrom, seasonTo, seasonNights, season: perNight * seasonNights,
  };
};

export interface Rider { first_name: string; last_name: string; date_of_birth: string | null; pickup_zone: string | null }
const personKey = (first: string, last: string, dob: string | null) => `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}|${dob ?? ""}`;

/** One zone's riders in a sentence: ages, sex, race, school district and single-parent households, counts with the matched base (2026-10-30). */
export const riderDemographics = (z: ZoneStats) => {
  if (!z.assessedYouth) return `${z.uniqueYouth} riders, none matched to a registration form, so no demographics.`;
  const list = (b: { label: string; count: number }[], top = 6) => b.slice(0, top).map((x) => `${x.label} ${x.count}`).join(", ") || "not recorded";
  const ages = z.age.map((a) => Number(a.label)).filter((n) => !Number.isNaN(n));
  const expanded = z.age.flatMap((a) => Array<number>(a.count).fill(Number(a.label))).sort((a, b) => a - b);
  const median = expanded.length ? expanded[Math.floor((expanded.length - 1) / 2)] : null;
  return `${z.assessedYouth} of ${z.uniqueYouth} riders matched to a registration form. ` +
    (ages.length ? `Ages ${Math.min(...ages)}–${Math.max(...ages)}${median != null ? ` (median ${median})` : ""}. ` : "") +
    `Sex: ${list(z.gender)}. Race/ethnicity: ${list(z.race)}. School district: ${list(z.district)}. ` +
    `Single-parent households: ${z.singleParentCount} of ${z.assessedYouth} (${z.singleParentPct}%). Economically disadvantaged: ${z.povertyCount} of ${z.assessedYouth} (${z.povertyPct}%).`;
};

/** Who rides: ages and towns from the rider list; income from the matching registration form (name + date of birth). */
export const riderProfile = (riders: Rider[], regs: (RegRow & { child_first_name: string; child_last_name: string })[], asOf: Date) => {
  const byKey = new Map(regs.map((r) => [personKey(r.child_first_name, r.child_last_name, r.child_date_of_birth), r]));
  const matched = riders.map((x) => byKey.get(personKey(x.first_name, x.last_name, x.date_of_birth))).filter((r): r is RegRow & { child_first_name: string; child_last_name: string } => !!r);
  const ages = riders
    .map((x) => (x.date_of_birth ? Math.floor((asOf.getTime() - new Date(x.date_of_birth + "T12:00:00").getTime()) / (365.25 * 86_400_000)) : null))
    .filter((a): a is number => a != null && a >= 0 && a <= 99).sort((a, b) => a - b);
  const zones: Record<string, number> = {};
  riders.forEach((x) => { const z = (x.pickup_zone ?? "").trim() || "Not given"; zones[z] = (zones[z] ?? 0) + 1; });
  return {
    riders: riders.length,
    matched: matched.length,
    disadvantaged: matched.filter(isBelowPoverty).length,
    ageMedian: ages.length ? ages[Math.floor((ages.length - 1) / 2)] : null,
    ageMin: ages[0] ?? null, ageMax: ages[ages.length - 1] ?? null,
    zones: Object.entries(zones).sort((a, b) => b[1] - a[1]),
  };
};

const shareList = (entries: [string, number][], total: number, top = 5) =>
  entries.slice(0, top).map(([k, v]) => `${k} ${pct(v, total)}%`).join(", ");

/* ── Reading the database ── */

const PAGE = 1000;
/** PostgREST returns 1,000 rows at a time; walk the pages. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, cap = 40_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type Served = { nla_youth: number; hawk_youth: number; bam_youth: number; in_both: number; combined: number };

/** Every live fact the writer may cite. Each query that fails becomes a note, not a crash. */
export async function gatherLiveFacts(today = new Date(), period?: { from: string; to: string; label: string }): Promise<Fact[]> {
  const facts: Fact[] = [];
  // A report speaks about its own period (Josh, 2026-10-24); everything else, the last complete year.
  const periods = period ? [{ ...factPeriods(today)[0], label: period.label, from: period.from, to: period.to }] : factPeriods(today);
  const rpc = (n: string, a: Record<string, unknown>) =>
    (supabase.rpc as unknown as (name: never, args: never) => PromiseLike<{ data: unknown; error: { message: string } | null }>).call(supabase, n as never, a as never);
  const from = (t: string) => supabase.from(t as never);

  for (const p of periods) {
    // Youth served, all programs, nobody counted twice (the Youth Served page's own function).
    try {
      const { data, error } = await rpc("youth_served_all_programs", { _from: p.from, _to: p.to });
      if (error) throw new Error(error.message);
      const s = (data as Served[])?.[0];
      if (s) {
        facts.push({ key: `youth_served.${p.key}`, label: "Youth who checked in at the kiosk (a partial-year log — the year's headcount is \"Youth registered\")", value: String(s.combined), period: p.label, source: "kiosk check-ins across NLA, Hawk Squad and BAM, one count per person; the kiosk began logging in spring 2026" });
        if (s.hawk_youth) facts.push({ key: `hawk.${p.key}`, label: "Hawk Squad students served", value: String(s.hawk_youth), period: p.label, source: "Hawk Squad check-ins" });
        if (s.bam_youth) facts.push({ key: `bam.${p.key}`, label: "BAM students served", value: String(s.bam_youth), period: p.label, source: "BAM check-ins" });
      }
    } catch (e) {
      facts.push({ key: `youth_served.${p.key}`, label: "Unduplicated youth served", value: `unavailable (${(e as Error).message})`, period: p.label, source: "youth_served_all_programs" });
    }

    // Attendance at the gym.
    try {
      const rows = await fetchAll<AttRow>((a, b) =>
        from("attendance_records").select("registration_id, check_in_date, program_source").gte("check_in_date", p.from).lte("check_in_date", p.to).range(a, b) as never);
      const s = summarizeAttendance(rows);
      const nlaRows = rows.filter((r) => (r.program_source ?? "NLA") === "NLA");
      const cov = coverage(nlaRows.map((r) => r.check_in_date), p);
      const rates = describeRates(fullMonthRates(nlaRows.map((r) => ({ date: r.check_in_date, who: r.registration_id })), p), "youth", "different youth");
      facts.push({ key: `attendance.${p.key}`, label: "Check-ins to the NLA after-school program", value: `${s.checkIns.toLocaleString()} check-ins over ${s.nights} nights, ${s.youth} different youth, about ${s.avgPerNight} per night${cov.note}.${rates}`, period: p.label, source: "the NLA check-in kiosk" });
      const juniors = s.bySource["Smile Lab"] ?? 0;
      if (juniors) facts.push({ key: `juniors_attendance.${p.key}`, label: "Juniors Aftercare check-ins", value: String(juniors), period: p.label, source: "the Juniors Aftercare kiosk" });
      const excursions = s.bySource["Excursion"] ?? 0;
      if (excursions) facts.push({ key: `excursion_attendance.${p.key}`, label: "Excursion check-ins", value: String(excursions), period: p.label, source: "excursion check-ins" });
    } catch (e) {
      facts.push({ key: `attendance.${p.key}`, label: "Attendance", value: `unavailable (${(e as Error).message})`, period: p.label, source: "attendance_records" });
    }

    // Excursions: the trips themselves (Josh, 2026-10-22 — they were missing from a funding purpose).
    try {
      const { data, error } = await from("excursions").select("date, name, youth_count").gte("date", p.from).lte("date", p.to).order("date") as unknown as { data: { date: string; name: string; youth_count: number | null }[] | null; error: { message: string } | null };
      if (error) throw new Error(error.message);
      const trips = data ?? [];
      if (trips.length) {
        const dow = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).getDay(); };
        const fridayWeekend = trips.filter((t) => [0, 5, 6].includes(dow(t.date))).length;
        const summer = trips.filter((t) => ["06", "07", "08"].includes(t.date.slice(5, 7))).length;
        const cov = coverage(trips.map((t) => t.date), p);
        facts.push({
          key: `excursions.${p.key}`, label: "Excursions (full-day trips)",
          value: `${trips.length} excursions logged${cov.note}: ${summer} in summer, ${fridayWeekend} on a Friday or weekend. Places: ${[...new Set(trips.map((t) => t.name))].join(", ")}.`,
          period: p.label, source: "the excursion records (the excursion log began in spring 2026; earlier trips are not counted)",
        });
      }
    } catch (e) {
      facts.push({ key: `excursions.${p.key}`, label: "Excursions", value: `unavailable (${(e as Error).message})`, period: p.label, source: "excursions" });
    }

    // Excursion reach — the Excursion Intelligence page's own figures: distinct youth
    // on at least one trip, their check-ins, and the economically disadvantaged share.
    try {
      const rows = await fetchAll<{ registration_id: string; check_in_date: string }>((a, b) =>
        from("attendance_records").select("registration_id, check_in_date").eq("program_source", "Excursion").not("excursion_id", "is", null).gte("check_in_date", p.from).lte("check_in_date", p.to).range(a, b) as never);
      const ids = [...new Set(rows.map((r) => r.registration_id).filter(Boolean))];
      if (ids.length) {
        const regs: RegRow[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await from("youth_registrations").select("id, youth_link_id, program_year, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch, child_school_district, family_structure, child_date_of_birth").in("id", ids.slice(i, i + 200)) as unknown as { data: RegRow[] | null };
          regs.push(...(data ?? []));
        }
        const poor = regs.filter(isBelowPoverty).length;
        facts.push({
          key: `excursion_reach.${p.key}`, label: "Youth reached by excursions",
          value: `${ids.length} different youth went on at least one excursion (${rows.length.toLocaleString()} check-ins); ${pct(poor, regs.length)}% economically disadvantaged (${poor} of ${regs.length}).`,
          period: p.label, source: "the Excursion Intelligence page (excursion check-ins matched to registration forms)",
        });
      }
    } catch { /* optional */ }

    // Meals.
    try {
      const rows = await fetchAll<{ event_date: string; meal_count: number; donor_name: string | null }>((a, b) =>
        from("meal_events").select("event_date, meal_count, donor_name").gte("event_date", p.from).lte("event_date", p.to).range(a, b) as never);
      const meals = rows.reduce((s, r) => s + (r.meal_count ?? 0), 0);
      const donors = new Set(rows.map((r) => (r.donor_name ?? "").trim()).filter(Boolean)).size;
      const cov = coverage(rows.map((r) => r.event_date), p);
      const rates = describeRates(fullMonthRates(rows.map((r) => ({ date: r.event_date, count: r.meal_count ?? 0 })), p), "meals");
      if (rows.length) facts.push({ key: `meals.${p.key}`, label: "Meals served through the Meal Train", value: `${meals.toLocaleString()} meals on ${rows.length} nights, cooked by ${donors} different donor families, businesses and groups${cov.note}.${rates}`, period: p.label, source: "the Meal Tracker" });
    } catch (e) {
      facts.push({ key: `meals.${p.key}`, label: "Meals", value: `unavailable (${(e as Error).message})`, period: p.label, source: "meal_events" });
    }

    // Rides.
    try {
      const rows = await fetchAll<{ youth_id: string; status: string; recorded_at: string }>((a, b) =>
        from("transport_attendance").select("youth_id, status, recorded_at").gte("recorded_at", p.from + "T00:00:00").lte("recorded_at", p.to + "T23:59:59").in("status", ["present", "picked_up", "dropped_off"]).range(a, b) as never);
      const cov = coverage(rows.map((r) => r.recorded_at), p);
      const rates = describeRates(fullMonthRates(rows.map((r) => ({ date: r.recorded_at, who: r.youth_id })), p), "rides", "different riders");
      if (rows.length) facts.push({ key: `rides.${p.key}`, label: "Rides given", value: `${rows.length.toLocaleString()} rides for ${new Set(rows.map((r) => r.youth_id)).size} different youth${cov.note}.${rates}`, period: p.label, source: "the driver app" });
    } catch (e) {
      facts.push({ key: `rides.${p.key}`, label: "Rides", value: `unavailable (${(e as Error).message})`, period: p.label, source: "transport_attendance" });
    }

    // Juniors Aftercare sessions written up.
    try {
      const { count, error } = await from("smile_lab_sessions").select("session_date", { count: "exact", head: true }).gte("session_date", p.from).lte("session_date", p.to);
      if (error) throw new Error(error.message);
      if (count) facts.push({ key: `juniors_sessions.${p.key}`, label: "Juniors Aftercare sessions journaled", value: String(count), period: p.label, source: "the Juniors Aftercare journal" });
    } catch { /* optional */ }
  }

  // The Meal Train this season, at this month's rate (Josh, 2026-10-22): the log restarted in the fall,
  // so the season's rate, named as an estimate with its basis, is the honest figure.
  try {
    const today = iso(new Date());
    const [cs] = programYearRange(getCurrentAttendanceYear(new Date()));
    const rows = await fetchAll<{ event_date: string; meal_count: number }>((a, b) =>
      from("meal_events").select("event_date, meal_count").gte("event_date", iso(cs)).lte("event_date", today).range(a, b) as never);
    const est = mealEstimate(rows.map((r) => ({ date: r.event_date, count: r.meal_count ?? 0 })), today);
    if (est) facts.push({
      key: "meals.estimate", label: "Meal Train — estimate at this month's rate",
      value: `${est.monthLabel} so far: ${est.meals.toLocaleString()} meals on ${est.nights} nights, ${est.perNight} a night. At that rate: about ${est.monthly.toLocaleString()} meals a month (${est.perNight} × ${est.monthNights} dinner nights, Monday to Friday) and about ${est.season.toLocaleString()} meals this season (${est.perNight} × ${est.seasonNights} dinner nights from ${fmtDay(est.seasonFrom)} to ${fmtDay(est.seasonTo)}, before holidays). Always say it is an estimate at this month's rate.`,
      period: `this season, ${shortProgramYear(getCurrentAttendanceYear(new Date()))}`, source: "the Meal Tracker; multiplied by dinner nights, never calendar days",
    });
  } catch { /* the estimate is optional; the year's meals fact stands */ }

  // Who rides: every youth the driver app carried in the last complete year, by age, town and income.
  try {
    const year = periods[0];
    const rides = await fetchAll<{ youth_id: string }>((a, b) =>
      from("transport_attendance").select("youth_id").gte("recorded_at", year.from + "T00:00:00").lte("recorded_at", year.to + "T23:59:59").in("status", ["present", "picked_up", "dropped_off"]).range(a, b) as never);
    const ids = [...new Set(rides.map((r) => r.youth_id))];
    if (ids.length) {
      const riders: Rider[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await from("youth_profiles").select("first_name, last_name, date_of_birth, pickup_zone").in("id", ids.slice(i, i + 200)) as unknown as { data: Rider[] | null };
        riders.push(...(data ?? []));
      }
      const regs = await fetchAll<RegRow & { child_first_name: string; child_last_name: string }>((a, b) =>
        from("youth_registrations").select("id, youth_link_id, program_year, child_first_name, child_last_name, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch, child_school_district, family_structure, child_date_of_birth").eq("program_year", year.year).range(a, b) as never);
      const pr = riderProfile(riders, regs, new Date(year.to + "T12:00:00"));
      // The counts and the poverty shares are the Transport Intelligence page's own
      // (per zone, divided by youth matched to a registration) — the figures Josh
      // reads and quotes. The ages come from the rider list.
      let vans = "";
      try {
        const ti = await buildIntelligence(year.year);
        const zone = (name: "Woodbine" | "Wildwood") => {
          const z = ti[name];
          return `${name}: ${z.uniqueYouth} youth served, ${z.rides.toLocaleString()} rides on ${z.trips} trips, ${z.povertyPct}% economically disadvantaged (${z.povertyCount} of ${z.assessedYouth} matched to a registration)`;
        };
        vans = `Transport Intelligence, ${shortProgramYear(year.year)}: ${ti.Combined.uniqueYouth} youth served, ${ti.Combined.rides.toLocaleString()} rides on ${ti.Combined.trips} completed trips, ${ti.Combined.povertyPct}% economically disadvantaged (${ti.Combined.povertyCount} of ${ti.Combined.assessedYouth} matched). ${zone("Woodbine")}. ${zone("Wildwood")}. `;
        // The riders' own demographics (Josh, 2026-10-30: "I want to use them there, not NLA general demographics"):
        // the page's counts, zone by zone, with the matched base stated — never NLA's registered-youth figures.
        facts.push({
          key: "riders.demographics", label: "Who rides NLA's vans — the riders' own demographics by pick-up zone",
          value: `Counts are riders matched by name to a registration form, as the Transport Intelligence page shows them (the driver app began in spring 2026). ` +
            `ALL RIDERS: ${riderDemographics(ti.Combined)} WOODBINE: ${riderDemographics(ti.Woodbine)} WILDWOOD: ${riderDemographics(ti.Wildwood)} ` +
            `These are the RIDERS' figures; NLA's overall race, sex, single-parent and district figures are different facts and must not be mixed with these.`,
          period: year.label, source: "the Transport Intelligence page (riders matched to registration forms: age, sex, race, school district, single-parent households)",
        });
      } catch { /* the rider-list figures below still stand */ }
      facts.push({
        key: "riders.profile", label: "Who rides NLA's vans",
        value: vans
          ? `${vans}${pr.ageMedian != null ? `Riders are ages ${pr.ageMin}–${pr.ageMax} (median ${pr.ageMedian}). ` : ""}The driver app began in spring 2026, so these are the riders since then.`
          : `${pr.riders} different youth rode${pr.ageMedian != null ? `, ages ${pr.ageMin}–${pr.ageMax} (median ${pr.ageMedian})` : ""}. Pick-up areas: ${pr.zones.map(([z, n]) => `${z} ${pct(n, pr.riders)}%`).join(", ")}. Economically disadvantaged: ${pr.disadvantaged} of the ${pr.matched} riders matched to a registration form (${pct(pr.disadvantaged, pr.matched)}%)${pr.matched < pr.riders ? `; ${pr.riders - pr.matched} riders could not be matched by name and date of birth` : ""}. The driver app began in spring 2026, so these are the riders since then.`,
        period: year.label, source: "the Transport Intelligence page (completed trips, riders by pick-up zone, poverty share of riders matched to a registration), and the driver app's rider list for ages",
      });
    }
  } catch { /* optional */ }

  // Who the youth were: that year's registrations, one per person, ages as of the year's end.
  try {
    const year = periods[0];
    const rows = await fetchAll<RegRow>((a, b) =>
      from("youth_registrations").select("id, youth_link_id, program_year, child_sex, child_race_ethnicity, household_income_range, free_or_reduced_lunch, child_school_district, family_structure, child_date_of_birth").eq("program_year", year.year).range(a, b) as never);
    const s = summarizeRegistrations(rows, new Date(year.to + "T12:00:00"));
    const period = `program year ${shortProgramYear(year.year)} registrations`;
    facts.push({ key: "registered.current", label: "Youth registered", value: String(s.youth), period, source: "registration forms" });
    facts.push({ key: "econ.current", label: "Economically disadvantaged youth", value: `${s.economicallyDisadvantaged} of ${s.youth} (${pct(s.economicallyDisadvantaged, s.youth)}%)`, period, source: "household income under $35,000 or free/reduced-price lunch, from the registration form" });
    facts.push({ key: "single_parent.current", label: "Youth in single-parent households", value: `${s.singleParent} of ${s.youth} (${pct(s.singleParent, s.youth)}%)`, period, source: "the family question on the registration form: Mom Only or Dad Only" });
    if (s.ageMedian != null) facts.push({ key: "ages.current", label: "Ages", value: `median ${s.ageMedian}; ${s.ageInRange} of ${s.agesKnown} (${pct(s.ageInRange, s.agesKnown)}%) between 7 and 19`, period, source: `dates of birth, as of the end of the year` });
    facts.push({ key: "sex.current", label: "Sex", value: shareList(s.sex, s.youth), period, source: "registration forms" });
    facts.push({ key: "race.current", label: "Race / ethnicity", value: shareList(s.race, s.youth, 6), period, source: "registration forms" });
    facts.push({ key: "districts.current", label: "School districts", value: shareList(s.districts, s.youth, 8), period, source: "registration forms, grouped and named as the By School District chart on the Youth Served page groups them (Lower Cape May = Cape May, West Cape May and Lower Township; Middle Township includes Dennis; Wildwood includes the Crest and North Wildwood)" });
  } catch (e) {
    facts.push({ key: "registered.current", label: "Registrations", value: `unavailable (${(e as Error).message})`, period: "the last complete program year", source: "youth_registrations" });
  }

  return facts;
}
