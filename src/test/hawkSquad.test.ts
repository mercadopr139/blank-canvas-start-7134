import { describe, it, expect } from "vitest";
import {
  isHawkPracticeDay, datesInMonth, canBeDismissed, hawkTodayET, datesBetween, hawkPeriodStats, hawkBreakdown, type HawkIntelRow,
  isSameHawkStudent, hawkPossibleDuplicates,
} from "@/lib/hawkSquad";

const reg = (id: string, over: Partial<NonNullable<HawkIntelRow["reg"]>> = {}): NonNullable<HawkIntelRow["reg"]> => ({
  id, youth_link_id: null, child_first_name: "Kid", child_last_name: id, child_headshot_url: null,
  grade_level: "10th", cte_program: null, child_sex: "Male", child_race_ethnicity: null, free_or_reduced_lunch: null, ...over,
});
const row = (registration_id: string, check_in_date: string, going_home: "bus" | "dismissed" = "bus", over: Partial<NonNullable<HawkIntelRow["reg"]>> = {}): HawkIntelRow =>
  ({ registration_id, check_in_date, going_home, reg: reg(registration_id, over) });

describe("Hawk Squad intelligence", () => {
  const rows = [
    row("a", "2026-09-29"), row("b", "2026-09-29", "dismissed"),
    row("a", "2026-10-01"), row("c", "2026-10-01", "bus", { grade_level: "11th", child_sex: "Female" }),
  ];

  it("counts sessions, check-ins, distinct students and going-home", () => {
    const s = hawkPeriodStats(rows, "2026-09-28", "2026-10-04", {}, "2026-10-04");
    expect(s.sessionsHeld).toBe(2);
    expect(s.sessionsPlanned).toBe(2); // Tue 29th, Thu 1st
    expect(s.checkIns).toBe(4);
    expect(s.students).toBe(3);
    expect(s.avgPerSession).toBe(2);
    expect(s.bus).toBe(3);
    expect(s.dismissed).toBe(1);
  });

  it("only counts planned sessions up to today", () => {
    expect(hawkPeriodStats(rows, "2026-09-28", "2026-10-04", {}, "2026-09-30").sessionsPlanned).toBe(1);
  });

  it("treats two registrations with one link as one student", () => {
    const linked = [row("a", "2026-09-29"), row("a2", "2026-10-01", "bus", { youth_link_id: "a" })];
    expect(hawkPeriodStats(linked, "2026-09-28", "2026-10-04", {}).students).toBe(1);
  });

  it("breaks distinct students down, not check-ins", () => {
    const b = hawkBreakdown(rows);
    expect(b.Grade).toEqual({ "10th": 2, "11th": 1 });
    expect(b.Sex).toEqual({ Male: 2, Female: 1 });
    expect(b["CTE program"]).toEqual({ "Not given": 3 });
  });

  it("lists every date in a range inclusive", () => {
    expect(datesBetween("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("Hawk Squad practice days", () => {
  it("runs Tuesday and Thursday by default", () => {
    expect(isHawkPracticeDay("2026-09-29", {})).toBe(true);  // Tue
    expect(isHawkPracticeDay("2026-10-01", {})).toBe(true);  // Thu
    expect(isHawkPracticeDay("2026-09-30", {})).toBe(false); // Wed
    expect(isHawkPracticeDay("2026-10-03", {})).toBe(false); // Sat
  });

  it("lets the calendar move a day in either direction", () => {
    expect(isHawkPracticeDay("2026-10-01", { "2026-10-01": false })).toBe(false); // Thursday off
    expect(isHawkPracticeDay("2026-09-30", { "2026-09-30": true })).toBe(true);   // Wednesday on
  });

  it("lists every date in a month once", () => {
    const sept = datesInMonth(2026, 8);
    expect(sept.length).toBe(30);
    expect(sept[0]).toBe("2026-09-01");
    expect(sept[29]).toBe("2026-09-30");
    expect(datesInMonth(2026, 1).length).toBe(28);
  });
});

describe("Hawk Squad duplicates", () => {
  const base = { program_year: "2026-2027", archived_at: null, child_date_of_birth: "2010-04-02", parent_phone: "+16095551234", parent_email: "p@x.com" };
  const luka = { id: "1", child_first_name: "Luka", child_last_name: "Mercado", ...base };
  it("matches the same name with a shared birthday, even with spacing differences", () => {
    const again = { id: "2", child_first_name: "luka", child_last_name: "Mer cado", ...base, parent_phone: null, parent_email: null };
    expect(isSameHawkStudent(luka, again)).toBe(true);
  });
  it("does not match twins or a namesake with different contact details", () => {
    const twin = { id: "3", child_first_name: "Nico", child_last_name: "Mercado", ...base };
    const namesake = { id: "4", child_first_name: "Luka", child_last_name: "Mercado", ...base, child_date_of_birth: "2011-01-01", parent_phone: "+16095550000", parent_email: "other@x.com" };
    expect(isSameHawkStudent(luka, twin)).toBe(false);
    expect(isSameHawkStudent(luka, namesake)).toBe(false);
  });
  it("only flags live registrations in the same year", () => {
    const lastYear = { id: "5", child_first_name: "Luka", child_last_name: "Mercado", ...base, program_year: "2025-2026" };
    const archived = { id: "6", child_first_name: "Luka", child_last_name: "Mercado", ...base, archived_at: "2026-09-01T00:00:00Z" };
    const live = { id: "7", child_first_name: "Luka", child_last_name: "Mercado", ...base };
    expect(hawkPossibleDuplicates(luka, [luka, lastYear, archived, live]).map((d) => d.id)).toEqual(["7"]);
  });
});

describe("Hawk Squad dismissal", () => {
  it("only a signed waiver allows dismissal", () => {
    expect(canBeDismissed({ dismissal_waiver_signed_at: null })).toBe(false);
    expect(canBeDismissed({ dismissal_waiver_signed_at: "2026-09-29T20:00:00Z" })).toBe(true);
  });
});

describe("today in the gym's timezone", () => {
  it("is a YYYY-MM-DD in New York time", () => {
    // 03:30 UTC on the 30th is still the evening of the 29th in New Jersey.
    expect(hawkTodayET(new Date("2026-09-30T03:30:00Z"))).toBe("2026-09-29");
  });
});
