// The life of a grant after the application (Josh, 2026-10-24), in his order:
// submitted → awarded or declined → active (reporting) → closed → apply again.
// Plus what Grant Coach home shows across every grant: the pipeline (asked,
// won, win rate), one calendar of what is due, and documents that know their
// age. Pure helpers here; the pages do the reading and writing.
import { supabase } from "@/integrations/supabase/client";
import type { PlannedReport } from "@/lib/grantCoach/writer";

export type FolderStatus = "applying" | "submitted" | "active" | "declined" | "closed";

export const STATUS_LABEL: Record<FolderStatus, string> = {
  applying: "Applying",
  submitted: "Submitted",
  active: "Awarded · active",
  declined: "Declined",
  closed: "Closed",
};

export interface PipelineFolder {
  id: string;
  name: string;
  funder: string;
  status: FolderStatus | string;
  due_at: string | null;
  amount_requested: number | null;
  amount_awarded: number | null;
  period_start?: string | null;
  period_end?: string | null;
}

export interface GrantReport {
  id: string;
  folder_id: string;
  title: string;
  kind: "narrative" | "financial" | "data" | "reimbursement" | "other";
  detail: string | null;
  period_start: string | null;
  period_end: string | null;
  due_on: string | null;
  status: "todo" | "drafted" | "approved" | "submitted";
  draft: string | null;
  submitted_at: string | null;
  sort_order: number;
}

export const REPORT_KIND_LABEL: Record<GrantReport["kind"], string> = {
  narrative: "Narrative report",
  financial: "Financial report",
  data: "Data report",
  reimbursement: "Reimbursement package",
  other: "Report",
};

/* ── The pipeline ── */

const num = (n: number | null | undefined) => (n == null ? 0 : Number(n));

/** Asked (everything sent in), won (awarded), and the win rate of decided grants. */
export function pipelineStats(folders: PipelineFolder[]) {
  const sent = folders.filter((f) => ["submitted", "active", "declined", "closed"].includes(f.status));
  const won = folders.filter((f) => f.status === "active" || f.status === "closed");
  const lost = folders.filter((f) => f.status === "declined");
  const decided = won.length + lost.length;
  return {
    applying: folders.filter((f) => f.status === "applying").length,
    pending: folders.filter((f) => f.status === "submitted").length,
    asked: sent.reduce((s, f) => s + num(f.amount_requested), 0),
    won: won.reduce((s, f) => s + num(f.amount_awarded ?? f.amount_requested), 0),
    wonCount: won.length,
    lostCount: lost.length,
    /** null until a grant has been decided either way. */
    winRate: decided ? Math.round((won.length / decided) * 100) : null,
  };
}

/* ── One calendar ── */

export interface DueItem {
  date: string; // YYYY-MM-DD, Eastern
  kind: "application" | "report" | "period_end";
  title: string;
  folderId: string;
  funder: string;
}

/** An instant as its America/New_York calendar date. */
export const nyDate = (isoInstant: string) => new Date(isoInstant).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Days from `today` (YYYY-MM-DD) to `date` (YYYY-MM-DD); negative when past. */
export const daysUntil = (date: string, today: string) =>
  Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);

/** Everything with a date across every grant: applications due, reports due, grant periods ending. Sorted, soonest first. */
export function dueItems(folders: PipelineFolder[], reports: (GrantReport & { folder?: PipelineFolder })[]): DueItem[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: DueItem[] = [];
  for (const f of folders) {
    if (f.status === "applying" && f.due_at) out.push({ date: nyDate(f.due_at), kind: "application", title: `Application due · ${f.name}`, folderId: f.id, funder: f.funder });
    if (f.status === "active" && f.period_end) out.push({ date: f.period_end, kind: "period_end", title: `Grant period ends · ${f.name}`, folderId: f.id, funder: f.funder });
  }
  for (const r of reports) {
    if (!r.due_on || r.status === "submitted") continue;
    const f = byId.get(r.folder_id);
    if (!f || f.status !== "active") continue;
    out.push({ date: r.due_on, kind: "report", title: `${r.title} · ${f.name}`, folderId: f.id, funder: f.funder });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Documents that know their age ── */

/** Months a Vault document stays current before funders expect a new one. Missing = it never goes stale. */
export const REFRESH_MONTHS: Record<string, number> = {
  form_990: 12,
  operating_budget: 12,
  audit: 12,
  board_list: 12,
  insurance: 12,
  nj_charity: 12,
  letters_packet: 12,
  w9: 36,
};

/** "fresh" | "due" (within a month of its refresh) | "stale" | "never" (doesn't go stale). */
export function documentAge(key: string, updatedAt: string | null, today = new Date()) {
  const months = REFRESH_MONTHS[key];
  if (!updatedAt) return { state: "missing" as const, months: null, ageMonths: null };
  const ageMonths = Math.floor((today.getTime() - new Date(updatedAt).getTime()) / (30.44 * 86_400_000));
  if (!months) return { state: "never" as const, months: null, ageMonths };
  if (ageMonths >= months) return { state: "stale" as const, months, ageMonths };
  if (ageMonths >= months - 1) return { state: "due" as const, months, ageMonths };
  return { state: "fresh" as const, months, ageMonths };
}

/* ── Reports ── */

export async function loadReports(folderId?: string): Promise<GrantReport[]> {
  let q = supabase.from("grant_reports" as never).select("*").order("due_on", { ascending: true, nullsFirst: false }).order("sort_order");
  if (folderId) q = q.eq("folder_id", folderId);
  const { data, error } = await (q as unknown as Promise<{ data: GrantReport[] | null; error: { message: string } | null }>);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The next program-year-style name: "O.C.E.A.N. 2027 CSBG" → "O.C.E.A.N. 2028 CSBG". */
export const nextYearName = (name: string) => {
  let bumped = false;
  const out = name.replace(/\b(20\d{2})\b/g, (y) => { bumped = true; return String(Number(y) + 1); });
  return bumped ? out : `${name} (next year)`;
};

/** A YYYY-MM-DD one year later (Feb 29 → Feb 28). */
export const plusYear = (ymd: string | null) => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
};

/** Save Grant Coach's planned reports onto the folder. */
export async function saveReports(folderId: string, planned: PlannedReport[], userId: string | null) {
  if (!planned.length) return 0;
  const rows = planned.map((r, i) => ({ folder_id: folderId, title: r.title, kind: r.kind, detail: r.detail, period_start: r.period_start, period_end: r.period_end, due_on: r.due_on, sort_order: i, updated_by: userId }));
  const { error } = await supabase.from("grant_reports" as never).insert(rows as never);
  if (error) throw new Error(error.message);
  return rows.length;
}
