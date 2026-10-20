// The Lap's numbers and dates (docs/LAP_PLAN.md, step 4).
//
// The data comes to the checkpoint so nobody has to remember: a topic shows
// this week against last week, read from the same tables the Intelligence
// pages use; the start line shows what is coming up in the next two weeks —
// a heads-up only, never something the lap asks anyone to act on. Dates are
// calendar dates in America/New_York (see CLAUDE.md), built from string math.
import { supabase } from "@/integrations/supabase/client";
import { todayNY } from "@/lib/programYear";
import type { Pillar } from "@/lib/lap/ring";

/* ───── Pure date helpers ───── */

export const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  // Built from UTC getters on a UTC-noon instant, so the calendar date never rolls.
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
};

/** Monday to Sunday of the week holding `ymd`. */
export const weekOf = (ymd: string): { from: string; to: string } => {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const from = addDays(ymd, -((dow + 6) % 7));
  return { from, to: addDays(from, 6) };
};

/** This week and the week before. */
export const thisAndLastWeek = (today = todayNY()) => {
  const cur = weekOf(today);
  return { cur, prev: weekOf(addDays(cur.from, -7)) };
};

export interface Stat {
  label: string;
  value: string;
  /** Last week's figure, when the comparison means something. */
  prev?: string;
  /** Extra line under the value. */
  note?: string;
}

export interface ComingUp {
  date: string;
  title: string;
  pillar: Pillar | null;
  source: "event" | "excursion" | "grant" | "date";
}

/** The next `days` days of dated things, soonest first; nothing past the window, nothing past. */
export const withinWindow = (items: ComingUp[], today: string, days = 14): ComingUp[] =>
  items
    .filter((i) => i.date >= today && i.date <= addDays(today, days))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

/** A yearly date's next occurrence on or after today. */
export const nextYearly = (ymd: string, today: string): string => {
  const [, mm, dd] = ymd.split("-");
  const y = Number(today.slice(0, 4));
  const thisYear = `${y}-${mm}-${dd}`;
  return thisYear >= today ? thisYear : `${y + 1}-${mm}-${dd}`;
};

/* ───── Reads ───── */

const n = (v: number) => v.toLocaleString();
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

const countRows = async (table: string, dateCol: string, from: string, to: string, extra?: (q: ReturnType<typeof supabase.from>) => unknown) => {
  let q = supabase.from(table as never).select("id", { count: "exact", head: true }).gte(dateCol, from).lte(dateCol, to);
  if (extra) q = extra(q as never) as typeof q;
  const { count } = await q;
  return count ?? 0;
};
const uniqueYouth = async (table: string, from: string, to: string, source?: string) => {
  let q = supabase.from(table as never).select("registration_id").gte("check_in_date", from).lte("check_in_date", to);
  if (source) q = q.eq("program_source", source);
  const { data } = await q;
  return new Set(((data ?? []) as { registration_id: string | null }[]).map((r) => r.registration_id).filter(Boolean)).size;
};
const sumMeals = async (from: string, to: string) => {
  const { data } = await supabase.from("meal_events").select("meal_count").gte("event_date", from).lte("event_date", to);
  const rows = (data ?? []) as { meal_count: number | null }[];
  return { meals: rows.reduce((a, r) => a + (r.meal_count ?? 0), 0), nights: rows.length };
};
const sumRevenue = async (from: string, to: string) => {
  const { data } = await supabase.from("revenue").select("amount").gte("date", from).lte("date", to);
  return ((data ?? []) as { amount: number | null }[]).reduce((a, r) => a + Number(r.amount ?? 0), 0);
};

/**
 * The numbers for one topic, by its title. A topic with nothing to show
 * returns an empty list and the checkpoint shows no numbers card.
 */
export const fetchTopicNumbers = async (topicTitle: string, today = todayNY()): Promise<Stat[]> => {
  const t = topicTitle.toLowerCase();
  const { cur, prev } = thisAndLastWeek(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  const lastMonthStart = `${lastMonthEnd.slice(0, 7)}-01`;

  if (t.includes("registration") || t.includes("attendance")) {
    const [a, b] = await Promise.all([uniqueYouth("attendance_records", cur.from, cur.to, "NLA"), uniqueYouth("attendance_records", prev.from, prev.to, "NLA")]);
    const { count } = await supabase.from("youth_registrations").select("id", { count: "exact", head: true }).is("archived_at", null).eq("approved_for_attendance", true);
    return [
      { label: "Unique youth this week", value: n(a), prev: `${n(b)} last week` },
      { label: "Approved registrations", value: n(count ?? 0), note: "on file now" },
    ];
  }
  if (t.includes("meal")) {
    const [a, b] = await Promise.all([sumMeals(cur.from, cur.to), sumMeals(prev.from, prev.to)]);
    return [
      { label: "Meals this week", value: n(a.meals), prev: `${n(b.meals)} last week` },
      { label: "Nights served", value: n(a.nights), prev: `${n(b.nights)} last week` },
    ];
  }
  if (t.includes("transport")) {
    const [a, b] = await Promise.all([
      countRows("runs", "started_at", `${cur.from}T00:00:00`, `${cur.to}T23:59:59`),
      countRows("runs", "started_at", `${prev.from}T00:00:00`, `${prev.to}T23:59:59`),
    ]);
    const { count: open } = await supabase.from("runs").select("id", { count: "exact", head: true }).is("closed_at", null).lt("started_at", `${today}T00:00:00`);
    return [
      { label: "Runs this week", value: n(a), prev: `${n(b)} last week` },
      { label: "Runs never closed out", value: n(open ?? 0), note: "before today" },
    ];
  }
  if (t.includes("hawk")) {
    const [a, b] = await Promise.all([uniqueYouth("hawk_squad_attendance", cur.from, cur.to), uniqueYouth("hawk_squad_attendance", prev.from, prev.to)]);
    return [{ label: "Hawk Squad students this week", value: n(a), prev: `${n(b)} last week` }];
  }
  if (t === "bam") {
    const [a, b] = await Promise.all([uniqueYouth("bam_attendance", cur.from, cur.to), uniqueYouth("bam_attendance", prev.from, prev.to)]);
    return [{ label: "BAM students this week", value: n(a), prev: `${n(b)} last week` }];
  }
  if (t.includes("excursion")) {
    const { data } = await supabase.from("excursions").select("date, name, youth_count" as never).gte("date" as never, today).order("date" as never).limit(1);
    const next = ((data ?? []) as unknown as { date: string; name: string; youth_count: number | null }[])[0];
    return next
      ? [{ label: "Next excursion", value: next.name, note: `${new Date(`${next.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${next.youth_count ? ` · ${next.youth_count} youth` : ""}` }]
      : [{ label: "Next excursion", value: "None planned" }];
  }
  if (t.includes("budget") || t.includes("revenue") || t.includes("finance report")) {
    const [a, b] = await Promise.all([sumRevenue(monthStart, today), sumRevenue(lastMonthStart, lastMonthEnd)]);
    return [{ label: "Revenue month to date", value: money(a), prev: `${money(b)} all of last month` }];
  }
  if (t.includes("donor")) {
    const { data } = await supabase.from("revenue").select("amount, revenue_type").gte("date", monthStart).lte("date", today);
    const rows = ((data ?? []) as { amount: number | null; revenue_type: string | null }[]).filter((r) => /donat|gift|sponsor/i.test(r.revenue_type ?? ""));
    return [{ label: "Donations this month", value: n(rows.length), note: money(rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)) }];
  }
  if (t.includes("grant")) {
    const { data } = await supabase.from("grant_folders" as never).select("name, status, due_at").in("status", ["applying", "submitted", "active"]).order("due_at", { ascending: true, nullsFirst: false });
    const rows = (data ?? []) as unknown as { name: string; status: string; due_at: string | null }[];
    const next = rows.find((r) => r.status === "applying" && r.due_at);
    return [
      { label: "Grants in play", value: n(rows.length), note: `${rows.filter((r) => r.status === "applying").length} applying · ${rows.filter((r) => r.status === "active").length} active` },
      ...(next ? [{ label: "Next due", value: next.name, note: new Date(next.due_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) }] : []),
    ];
  }
  if (t.includes("event")) {
    const { data } = await supabase.from("program_events" as never).select("date, name").gte("date", today).order("date").limit(1);
    const next = ((data ?? []) as unknown as { date: string; name: string }[])[0];
    return next ? [{ label: "Next event", value: next.name, note: new Date(`${next.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) }] : [];
  }
  return [];
};

/** The next two weeks: program events, excursions, grant due dates and the lap's own dates. */
export const fetchComingUp = async (today = todayNY(), days = 14): Promise<ComingUp[]> => {
  const to = addDays(today, days);
  const [ev, ex, gr, ld] = await Promise.all([
    supabase.from("program_events" as never).select("date, name").gte("date", today).lte("date", to),
    supabase.from("excursions").select("date, name" as never).gte("date" as never, today).lte("date" as never, to),
    supabase.from("grant_folders" as never).select("name, due_at, status").in("status", ["applying"]).not("due_at", "is", null),
    supabase.from("lap_dates" as never).select("title, on_date, pillar, recurring_every"),
  ]);
  const items: ComingUp[] = [
    ...((ev.data ?? []) as unknown as { date: string; name: string }[]).map((e) => ({ date: e.date, title: e.name, pillar: "sales_marketing" as Pillar, source: "event" as const })),
    ...((ex.data ?? []) as unknown as { date: string; name: string }[]).map((e) => ({ date: e.date, title: `Excursion: ${e.name}`, pillar: "operations" as Pillar, source: "excursion" as const })),
    ...((gr.data ?? []) as unknown as { name: string; due_at: string }[]).map((g) => ({
      date: new Date(g.due_at).toLocaleDateString("en-CA", { timeZone: "America/New_York" }), title: `Due: ${g.name}`, pillar: "finance" as Pillar, source: "grant" as const,
    })),
    ...((ld.data ?? []) as unknown as { title: string; on_date: string; pillar: Pillar | null; recurring_every: string | null }[]).map((d) => ({
      date: d.recurring_every === "year" ? nextYearly(d.on_date, today) : d.on_date, title: d.title, pillar: d.pillar, source: "date" as const,
    })),
  ];
  return withinWindow(items, today, days);
};

/** Conversations with new messages since an instant, by pillar — what moved on the message board. Ones in skipIds (archived by me) are left out. */
export const fetchMovedConversations = async (sinceIso: string, skipIds: string[] = []): Promise<Record<Pillar, number>> => {
  const out: Record<Pillar, number> = { operations: 0, sales_marketing: 0, finance: 0 };
  const { data: msgs } = await supabase.from("mb_messages").select("conversation_id").gt("created_at", sinceIso);
  const skip = new Set(skipIds);
  const ids = [...new Set(((msgs ?? []) as { conversation_id: string }[]).map((m) => m.conversation_id))].filter((id) => !skip.has(id));
  if (!ids.length) return out;
  const { data: convs } = await supabase.from("mb_conversations").select("id, pillar" as never).in("id", ids);
  for (const c of (convs ?? []) as unknown as { id: string; pillar: string | null }[]) if (c.pillar && c.pillar in out) out[c.pillar as Pillar]++;
  return out;
};
