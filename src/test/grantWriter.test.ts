// Grant Coach's writer, the parts that run without a database: the periods a
// draft speaks about, the summaries behind the live numbers, the narrative's
// order and word count, and the Word file.
import { describe, it, expect } from "vitest";
import { factPeriods, factYearLabel, summarizeRegistrations, summarizeAttendance, pct, isSingleParent, districtGroup, coverage, fullMonthRates, describeRates } from "@/lib/grantCoach/liveFacts";
import { narrativeItems, narrativeWordCount, wordCount, NARRATIVE_SECTION, NARRATIVE_WORD_LIMIT, STORY_ONLY_KEYS, APPROVED_FIGURE_KEYS } from "@/lib/grantCoach/writer";
import { ORG_FIELDS } from "@/lib/grantCoach/orgProfile";
import { buildNarrativeDocument, headingFromLabel } from "@/lib/grantCoach/narrativeDocx";
import { OCEAN_2027 } from "@/lib/grantCoach/oceanChecklist";
import { Packer } from "docx";

describe("the year a draft speaks about: the last complete program year, only", () => {
  it("in October 2026 that is 2025-26, in full", () => {
    const periods = factPeriods(new Date(2026, 9, 17, 12));
    expect(periods).toHaveLength(1);
    expect(periods[0].year).toBe("2025-2026");
    expect(periods[0].from).toBe("2025-09-01");
    expect(periods[0].to).toBe("2026-08-31");
    expect(periods[0].label).toContain("the last complete year");
    expect(factYearLabel(new Date(2026, 9, 17, 12))).toBe("2025-26");
  });
  it("in spring 2027 it is still 2025-26, because 2026-27 is not complete", () => {
    const [p] = factPeriods(new Date(2027, 3, 2, 12));
    expect(p.year).toBe("2025-2026");
  });
  it("from September 2027 it becomes 2026-27", () => {
    const [p] = factPeriods(new Date(2027, 8, 15, 12));
    expect(p.year).toBe("2026-2027");
    expect(p.to).toBe("2027-08-31");
  });
});

describe("the summaries behind the live numbers", () => {
  const reg = (over: Partial<Parameters<typeof summarizeRegistrations>[0][number]>) => ({
    id: Math.random().toString(36).slice(2), youth_link_id: null, program_year: "2026-2027", child_sex: "Male", child_race_ethnicity: "White",
    household_income_range: "$50,000 - $74,999", free_or_reduced_lunch: "No", child_school_district: "Middle Township", family_structure: "Dad and Mom",
    child_date_of_birth: "2014-05-01", ...over,
  });

  it("counts one person per youth and the shares funders ask for", () => {
    const rows = [
      reg({ id: "a", youth_link_id: "p1", household_income_range: "Under $25,000" }),
      reg({ id: "b", youth_link_id: "p1" }), // a re-registration of the same person
      reg({ id: "c", free_or_reduced_lunch: "Yes", family_structure: "Mom Only", child_sex: "Female", child_race_ethnicity: "Hispanic or Latino" }),
      reg({ id: "d", child_school_district: "Wildwood", family_structure: "Other" }),
    ];
    const s = summarizeRegistrations(rows, new Date(2026, 7, 31));
    expect(s.youth).toBe(3);
    expect(s.economicallyDisadvantaged).toBe(1); // "c"; p1's latest row is "b", not low income
    expect(s.singleParent).toBe(1); // "Other" is not single-parent
    expect(s.sex[0]).toEqual(["Male", 2]);
    expect(s.districts).toEqual([["Middle Township", 2], ["Wildwood", 1]]);
    expect(s.ageMedian).toBe(12);
    expect(s.ageInRange).toBe(3);
  });

  it("single-parent follows the June 2026 rule: Mom Only, Dad Only, or the backfill label", () => {
    expect(isSingleParent({ family_structure: "Mom Only" })).toBe(true);
    expect(isSingleParent({ family_structure: "Dad Only" })).toBe(true);
    expect(isSingleParent({ family_structure: "Single Parent Household" })).toBe(true);
    expect(isSingleParent({ family_structure: "Other" })).toBe(false);
    expect(isSingleParent({ family_structure: "Grandparent(s)" })).toBe(false);
    expect(isSingleParent({ family_structure: null })).toBe(false);
  });

  it("groups districts the way a funder reads them", () => {
    expect(districtGroup("Lower Cape May Regional")).toBe("Lower Township");
    expect(districtGroup("Lower Township")).toBe("Lower Township");
    expect(districtGroup("Dennis Township")).toBe("Middle Township");
    expect(districtGroup("Cape May City")).toBe("Cape May / West Cape May");
    expect(districtGroup("Wildwood")).toBe("Wildwood");
    expect(districtGroup(null)).toBe("Not given");
  });

  it("a mistyped birth date cannot move the ages", () => {
    const rows = [
      reg({ id: "a", child_date_of_birth: "2012-01-01" }),
      reg({ id: "b", child_date_of_birth: "2010-01-01" }),
      reg({ id: "c", child_date_of_birth: "2014-01-01" }),
      reg({ id: "d", child_date_of_birth: "1901-01-01" }), // a typo
    ];
    const s = summarizeRegistrations(rows, new Date(2026, 7, 31));
    expect(s.ageMedian).toBe(14);
    expect(s.ageInRange).toBe(3);
    expect(s.agesKnown).toBe(3); // the typo is dropped, not counted
  });

  it("reads nights, check-ins and youth off the gym program only", () => {
    const s = summarizeAttendance([
      { registration_id: "r1", check_in_date: "2026-09-08", program_source: "NLA" },
      { registration_id: "r2", check_in_date: "2026-09-08", program_source: "NLA" },
      { registration_id: "r1", check_in_date: "2026-09-09", program_source: "NLA" },
      { registration_id: "r3", check_in_date: "2026-09-09", program_source: "Smile Lab" },
      { registration_id: "r1", check_in_date: "2026-09-10", program_source: "Excursion" },
    ]);
    expect(s.checkIns).toBe(3);
    expect(s.nights).toBe(2);
    expect(s.youth).toBe(2);
    expect(s.avgPerNight).toBe(2);
    expect(s.bySource).toEqual({ NLA: 3, "Smile Lab": 1, Excursion: 1 });
  });

  it("says so when a log covers only part of the year", () => {
    const year = { from: "2025-09-01", to: "2026-08-31" };
    const late = coverage(["2026-03-03", "2026-05-10", "2026-08-20"], year);
    expect(late.partial).toBe(true);
    expect(late.note).toContain("Mar 3, 2026 to Aug 20, 2026");
    expect(late.note).toContain("logging began partway through");
    const full = coverage(["2025-09-08", "2026-01-15", "2026-08-25"], year);
    expect(full.partial).toBe(false);
    expect(full.note).toBe("");
    expect(coverage([], year).partial).toBe(false);
  });

  it("measures rates from full months only, and names the strongest", () => {
    const year = { from: "2025-09-01", to: "2026-08-31" };
    const rows: { date: string; count: number }[] = [];
    // Logging began April 14: April is partial. May and June are full. July has only two nights.
    ["2026-04-14", "2026-04-21", "2026-04-28"].forEach((d) => rows.push({ date: d, count: 40 }));
    for (let d = 1; d <= 31; d++) if ([1, 2, 3, 4, 5].includes(new Date(2026, 4, d).getDay())) rows.push({ date: `2026-05-${String(d).padStart(2, "0")}`, count: 60 });
    for (let d = 1; d <= 30; d++) if ([1, 2, 3, 4, 5].includes(new Date(2026, 5, d).getDay())) rows.push({ date: `2026-06-${String(d).padStart(2, "0")}`, count: 50 });
    rows.push({ date: "2026-07-07", count: 30 }, { date: "2026-07-14", count: 30 });
    const rates = fullMonthRates(rows, year);
    expect(rates.map((r) => r.month)).toEqual(["2026-05", "2026-06"]);
    const may = rates[0];
    expect(may.perNight).toBe(60);
    expect(may.nights).toBe(21);
    expect(may.nightsPerWeek).toBeCloseTo(4.7, 1);
    const line = describeRates(rates, "meals");
    expect(line).toContain("Strongest full month: May 2026, 60 meals a night");
    expect(line).toContain("Average across full months: 55 meals a night");
    expect(fullMonthRates([], year)).toEqual([]);
  });

  it("rounds a share the way the pages do", () => {
    expect(pct(16, 20)).toBe(80);
    expect(pct(1, 0)).toBe(0);
  });
});

describe("where the numbers come from", () => {
  it("marks every library field that carries youth statistics as story-only", () => {
    // The seeds that quote youth counts or shares from the website or the CPF proposal.
    const carriesYouthStats = ORG_FIELDS.filter((f) => /\b\d+(\.\d+)?%|\b\d{2,4}\+? (youth|students)|single-parent/i.test(f.seed ?? "")).map((f) => f.key);
    carriesYouthStats.forEach((key) => expect(STORY_ONLY_KEYS.has(key) || APPROVED_FIGURE_KEYS.has(key), key).toBe(true));
    expect(carriesYouthStats.length).toBeGreaterThan(3);
  });
});

describe("the three-page narrative", () => {
  const seeded = OCEAN_2027.items.map((seed, i) => ({ ...seed, id: String(i), detail: seed.detail ?? null, answer: null as string | null, required: seed.required ?? true, status: "todo" }));

  it("finds the seven items in the funder's order, and nothing else from that screen", () => {
    const seven = narrativeItems(seeded);
    expect(seven.map((i) => i.label[0])).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(seven.every((i) => i.section === NARRATIVE_SECTION)).toBe(true);
    expect(seven.some((i) => i.kind === "upload")).toBe(false);
  });

  it("counts words across all seven against the limit", () => {
    const seven = narrativeItems(seeded).map((i) => ({ ...i, answer: "one two three" }));
    expect(narrativeWordCount(seven)).toBe(21);
    expect(wordCount("  a  b\nc ")).toBe(3);
    expect(NARRATIVE_WORD_LIMIT).toBe(1350);
  });

  it("turns the funder's label into a heading", () => {
    expect(headingFromLabel("4. Staff roles, qualifications, supervision, and use of volunteers or subcontractors")).toBe("Staff roles, qualifications, supervision, and use of volunteers or subcontractors");
  });

  it("builds a Word file", async () => {
    const doc = buildNarrativeDocument(
      [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, heading: `Heading ${n}`, text: "First paragraph.\n\nSecond paragraph." })),
      { org: "No Limits Academy", grant: "O.C.E.A.N., Inc. 2027 CSBG Partnership Program", program: "Meal Train" },
    );
    const buf = await Packer.toBuffer(doc);
    expect(buf.length).toBeGreaterThan(2000);
    // A .docx is a zip; it starts with "PK".
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});
