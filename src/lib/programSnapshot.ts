// A program's Snapshot (Josh, 2026-11-12): the period's figures as blocks
// that can be switched off one by one before printing ("uncheck boxes that
// don't compliment the program"), and an attendance report behind it —
// every session, who checked in, and the totals. Pure: the sheet gathers
// the rows and this file does the arithmetic; the PDF and the preview draw
// the same Snapshot. Bus/dismissed, "attended 75%+" and new/returning were
// taken out for good the same day; average per session got its own tile.
import { NON_MINORITY_RACE } from "@/lib/demographics";
import type { HawkBreakdown, HawkPeriodStats } from "@/lib/hawkSquad";

export type SnapshotBlockKey =
  | "reached" | "sessions" | "grade" | "cte" | "sex" | "race" | "minority" | "disadvantaged"
  | "comparison" | "moments" | "attendance";

export interface SnapshotBlockDef { key: SnapshotBlockKey; label: string; hint: string }

/** Every block the Snapshot can carry, in print order. The sheet hides the ones a program has no data for. */
export const SNAPSHOT_BLOCKS: SnapshotBlockDef[] = [
  { key: "reached", label: "Students reached", hint: "Distinct students who checked in, and how many are registered" },
  { key: "sessions", label: "Sessions", hint: "Sessions held, check-ins, average per session" },
  { key: "grade", label: "Grade", hint: "Students by grade" },
  { key: "cte", label: "CTE program", hint: "Students by career and technical program" },
  { key: "sex", label: "Male / female", hint: "Students by sex" },
  { key: "race", label: "Race / ethnicity", hint: "Students by race or ethnicity" },
  { key: "minority", label: "Minority", hint: "Students with a race recorded other than White" },
  { key: "disadvantaged", label: "Economically disadvantaged", hint: "Free or reduced lunch, the academy's marker" },
  { key: "comparison", label: "Compared to the previous period", hint: "Sessions, check-ins and students against the same length of time before" },
  { key: "moments", label: "Weekly Standout Moments", hint: "The weeks' notes, as written" },
  { key: "attendance", label: "Attendance report", hint: "Every session with who checked in, then each student's total" },
];

export type NameStyle = "full" | "initial";

/** "Marcus Rivera" or "Marcus R." — initials when the report leaves the school. */
export const formatName = (first: string | null | undefined, last: string | null | undefined, style: NameStyle) => {
  const f = (first ?? "").trim(), l = (last ?? "").trim();
  if (style === "initial") return [f, l ? `${l[0].toUpperCase()}.` : ""].filter(Boolean).join(" ") || "Unknown";
  return [f, l].filter(Boolean).join(" ") || "Unknown";
};

export interface SnapshotCheckIn {
  /** Cross-year identity (youth_link_id, else registration id). */
  identity: string;
  date: string;          // YYYY-MM-DD
  at: string | null;     // ISO instant of the check-in
  first: string;
  last: string;
  grade: string | null;
}

export interface SnapshotInput {
  stats: HawkPeriodStats;
  breakdown: HawkBreakdown;
  checkIns: SnapshotCheckIn[];
  /** Approved, unarchived registrations for the period's program year; null when unknown. */
  registered: number | null;
  previous: HawkPeriodStats | null;
  moments: Array<{ week: string; notes: string }>;
  names: NameStyle;
}

export interface CountRow { label: string; n: number; pct: number }
export interface SnapshotSession { date: string; count: number; people: Array<{ name: string; time: string | null }> }
export interface SnapshotStudent { name: string; attended: number; of: number; pct: number }

export interface Snapshot {
  reached: { students: number; registered: number | null; pct: number | null };
  sessions: { held: number; planned: number; checkIns: number; avg: number };
  grade: CountRow[]; cte: CountRow[]; sex: CountRow[]; race: CountRow[];
  minority: { n: number; recorded: number; pct: number };
  disadvantaged: { n: number; of: number; pct: number };
  comparison: Array<{ label: string; now: number; before: number; delta: number }> | null;
  moments: Array<{ week: string; notes: string }>;
  attendance: { sessions: SnapshotSession[]; students: SnapshotStudent[] };
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const rows = (counts: Record<string, number> | undefined, total: number): CountRow[] =>
  Object.entries(counts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n, pct: pct(n, total) }));
/** Grades in school order — 9th, 10th, 11th, 12th — not by count (Josh, 2026-11-12); "Not given" last. */
const gradeRows = (counts: Record<string, number> | undefined, total: number): CountRow[] => {
  const num = (s: string) => (s === "Not given" ? Infinity : parseInt(s, 10) || 0);
  return rows(counts, total).sort((a, b) => num(a.label) - num(b.label));
};

/** Minority: students with a race recorded other than White, out of those with one recorded. Shared with the Intelligence page's tiles. */
export const snapshotMinority = (breakdown: HawkBreakdown) => {
  const race = breakdown["Race / ethnicity"] ?? {};
  const recorded = Object.entries(race).filter(([k]) => k !== "Not given").reduce((s, [, n]) => s + n, 0);
  const n = recorded - (race[NON_MINORITY_RACE] ?? 0);
  return { n, recorded, pct: pct(n, recorded) };
};
/** Economically disadvantaged: the academy's marker is free or reduced lunch, any "Yes…" answer. */
export const snapshotDisadvantaged = (breakdown: HawkBreakdown, total: number) => {
  const dis = breakdown["Economically disadvantaged youth"] ?? {};
  const n = Object.entries(dis).filter(([k]) => /^yes/i.test(k)).reduce((s, [, c]) => s + c, 0);
  return { n, of: total, pct: pct(n, total) };
};

const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : null);

export function buildSnapshot(input: SnapshotInput): Snapshot {
  const { stats, breakdown, checkIns } = input;
  const total = stats.students;
  const held = stats.sessionsHeld;

  // Per student across the period.
  const byStudent = new Map<string, { first: string; last: string; dates: Set<string> }>();
  for (const c of checkIns) {
    const s = byStudent.get(c.identity) ?? { first: c.first, last: c.last, dates: new Set<string>() };
    s.dates.add(c.date);
    byStudent.set(c.identity, s);
  }

  const prev = input.previous;
  const comparison = prev ? [
    { label: "Sessions held", now: held, before: prev.sessionsHeld, delta: held - prev.sessionsHeld },
    { label: "Check-ins", now: stats.checkIns, before: prev.checkIns, delta: stats.checkIns - prev.checkIns },
    { label: "Students reached", now: total, before: prev.students, delta: total - prev.students },
    { label: "Average per session", now: stats.avgPerSession, before: prev.avgPerSession, delta: Math.round((stats.avgPerSession - prev.avgPerSession) * 10) / 10 },
  ] : null;

  // The attendance report: each session, then each student.
  const byDate = new Map<string, SnapshotCheckIn[]>();
  for (const c of checkIns) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c]);
  const sessions: SnapshotSession[] = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, list]) => {
    const people = [...list].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "") || a.last.localeCompare(b.last))
      .map((c) => ({ name: formatName(c.first, c.last, input.names), time: timeOf(c.at) }));
    return { date, count: list.length, people };
  });
  const students: SnapshotStudent[] = [...byStudent.values()]
    .map((s) => ({ name: formatName(s.first, s.last, input.names), attended: s.dates.size, of: held, pct: pct(s.dates.size, held) }))
    .sort((a, b) => b.attended - a.attended || a.name.localeCompare(b.name));

  return {
    reached: { students: total, registered: input.registered, pct: input.registered ? pct(total, input.registered) : null },
    sessions: { held, planned: stats.sessionsPlanned, checkIns: stats.checkIns, avg: stats.avgPerSession },
    grade: gradeRows(breakdown["Grade"], total),
    cte: rows(breakdown["CTE program"], total),
    sex: rows(breakdown["Sex"], total),
    race: rows(breakdown["Race / ethnicity"], total),
    minority: snapshotMinority(breakdown),
    disadvantaged: snapshotDisadvantaged(breakdown, total),
    comparison,
    moments: input.moments,
    attendance: { sessions, students },
  };
}

/** The blocks a program can show at all: no CTE without the question, no grades without them, no comparison without a previous period. */
export function availableBlocks(opts: { hasCte: boolean; hasGrades: boolean; hasPrevious: boolean; hasMoments: boolean }): SnapshotBlockKey[] {
  return SNAPSHOT_BLOCKS.map((b) => b.key).filter((k) =>
    (k !== "cte" || opts.hasCte) && (k !== "grade" || opts.hasGrades) && (k !== "comparison" || opts.hasPrevious) && (k !== "moments" || opts.hasMoments));
}

/** The previous period of the same length, ending the day before this one began. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const d = (s: string) => new Date(`${s}T12:00:00`);
  const days = Math.round((d(to).getTime() - d(from).getTime()) / 86_400_000) + 1;
  const end = d(from); end.setDate(end.getDate() - 1);
  const start = new Date(end); start.setDate(start.getDate() - days + 1);
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: ymd(start), to: ymd(end) };
}

export const longDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const shortDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
