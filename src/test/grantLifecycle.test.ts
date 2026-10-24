import { describe, it, expect } from "vitest";
import { pipelineStats, dueItems, documentAge, nextYearName, plusYear, daysUntil, nyDate, type PipelineFolder, type GrantReport } from "@/lib/grantCoach/lifecycle";

const folder = (p: Partial<PipelineFolder>): PipelineFolder => ({
  id: p.id ?? "f", name: p.name ?? "Grant", funder: p.funder ?? "Funder", status: p.status ?? "applying",
  due_at: p.due_at ?? null, amount_requested: p.amount_requested ?? null, amount_awarded: p.amount_awarded ?? null,
  period_start: p.period_start ?? null, period_end: p.period_end ?? null,
});
const report = (p: Partial<GrantReport>): GrantReport => ({
  id: p.id ?? "r", folder_id: p.folder_id ?? "f", title: p.title ?? "Report", kind: p.kind ?? "narrative", detail: null,
  period_start: null, period_end: null, due_on: p.due_on ?? null, status: p.status ?? "todo", draft: null, submitted_at: null, sort_order: 0,
});

describe("the pipeline", () => {
  it("counts asked from everything sent in, won from awards, and the win rate of decided grants only", () => {
    const s = pipelineStats([
      folder({ status: "applying", amount_requested: 75000 }),
      folder({ status: "submitted", amount_requested: 50000 }),
      folder({ status: "active", amount_requested: 40000, amount_awarded: 30000 }),
      folder({ status: "declined", amount_requested: 20000 }),
      folder({ status: "closed", amount_requested: 10000, amount_awarded: null }),
    ]);
    expect(s.applying).toBe(1);
    expect(s.pending).toBe(1);
    expect(s.asked).toBe(120000); // the applying one isn't asked yet
    expect(s.won).toBe(40000); // the closed one counts its request when no award amount was recorded
    expect(s.winRate).toBe(67); // 2 won of 3 decided; the pending one isn't counted
  });
  it("has no win rate until something is decided", () => {
    expect(pipelineStats([folder({ status: "submitted" })]).winRate).toBeNull();
  });
});

describe("one calendar", () => {
  it("lists applications due, open reports on active grants and periods ending, soonest first", () => {
    const items = dueItems(
      [
        folder({ id: "a", status: "applying", due_at: "2026-10-30T21:00:00Z", name: "O.C.E.A.N." }),
        folder({ id: "b", status: "active", period_end: "2027-12-31", name: "CSBG" }),
        folder({ id: "c", status: "declined", due_at: "2026-11-01T12:00:00Z" }),
      ],
      [
        report({ folder_id: "b", due_on: "2027-02-15", title: "January package" }),
        report({ folder_id: "b", due_on: "2027-01-15", title: "Sent already", status: "submitted" }),
        report({ folder_id: "c", due_on: "2027-01-01" }),
      ],
    );
    expect(items.map((d) => `${d.kind}:${d.date}`)).toEqual(["application:2026-10-30", "report:2027-02-15", "period_end:2027-12-31"]);
  });
  it("dates an instant in Eastern time, not UTC", () => {
    // 11:30 PM Eastern on Oct 30 is already Oct 31 in UTC.
    expect(nyDate("2026-10-31T03:30:00Z")).toBe("2026-10-30");
  });
  it("counts days between calendar dates", () => {
    expect(daysUntil("2026-10-30", "2026-10-24")).toBe(6);
    expect(daysUntil("2026-10-20", "2026-10-24")).toBe(-4);
  });
});

describe("documents that know their age", () => {
  const today = new Date("2026-10-24T12:00:00Z");
  it("flags a 990 older than a year and one coming due", () => {
    expect(documentAge("form_990", "2025-09-01T12:00:00Z", today).state).toBe("stale");
    expect(documentAge("form_990", "2025-11-10T12:00:00Z", today).state).toBe("due");
    expect(documentAge("form_990", "2026-06-01T12:00:00Z", today).state).toBe("fresh");
  });
  it("never ages a determination letter", () => {
    expect(documentAge("determination_letter", "2019-12-17T12:00:00Z", today).state).toBe("never");
  });
});

describe("apply again", () => {
  it("moves every year in the name forward one", () => {
    expect(nextYearName("O.C.E.A.N. 2027 CSBG Partnership")).toBe("O.C.E.A.N. 2028 CSBG Partnership");
    expect(nextYearName("Summer grant")).toBe("Summer grant (next year)");
  });
  it("moves a date forward a year, and Feb 29 to Feb 28", () => {
    expect(plusYear("2027-01-01")).toBe("2028-01-01");
    expect(plusYear("2028-02-29")).toBe("2029-02-28");
    expect(plusYear(null)).toBeNull();
  });
});
