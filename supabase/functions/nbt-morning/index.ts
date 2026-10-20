// nbt-morning — the Non-Battle Team workout, emailed the morning of.
//
// Rev (Pastor Bill) leads the Non-Battle Team on Monday, Tuesday and Thursday.
// At 7 AM Eastern on those days he gets the day's workout — both tracks, the
// kit, the circuit — plus the night's Non-Battle Team column from the Practice
// Plan, and one link into the plan to edit it (Josh, 2026-10-20).
//
// The week's lock is the review: whatever is locked at 7 AM is what he gets.
// If the week is not locked, Rev gets nothing and Josh gets one line saying so.
//
// Callers: pg_cron with X-Cron-Secret (hour- and day-guarded), or an admin JWT
// (sends now, any day — for testing). Cron body {"sample_to": "<academy
// address>"} sends a sample of today's (or the next) NBT day to one address.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FROM = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";
const PLAN_URL = "https://www.nolimitsboxingacademy.org/admin/operations/nbt-board";
const NLA_RED = "#bf0f3e";
const BRAVO = "#a3e635";
const ALPHA = "#a78bfa";
/** Who gets the workout. */
export const RECIPIENTS = ["pastorbill@revolvechurchnj.com"];
/** Who hears when there is nothing locked to send. */
export const FALLBACK = ["joshmercado@nolimitsboxingacademy.org"];
/** 7 AM Eastern. */
const SEND_HOUR = 7;

/** The Non-Battle Team's days: weekday (0 = Sunday) → the day key in nbt_weeks.days. */
export const NBT_DAYS: Record<number, { key: string; label: string; title: string }> = {
  1: { key: "monday", label: "Monday", title: "Squat + Push" },
  2: { key: "tuesday", label: "Tuesday", title: "Athletic + Overhead" },
  4: { key: "thursday", label: "Thursday", title: "Hinge + Pull" },
};

interface Track { name?: string; detail?: string }
interface NbtDay {
  focus?: string;
  minutes?: { prep?: number; lift?: number; work?: number; reset?: number };
  prep?: string[];
  lift?: { pattern?: string; bravo?: Track; alpha?: Track; cues?: string[] };
  work?: { emphasis?: string; title?: string; bravo?: string[]; alpha?: string[]; result_unit?: string };
  reset?: string[];
}
interface PlanBlock { category: string; lines: string[] }

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** YYYY-MM-DD → the Monday of that week, as YYYY-MM-DD (pure string math, Eastern dates). */
export const mondayOf = (ymd: string): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
};
export const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
/** Today if it is an NBT day, else the next one. */
export const nextNbtDay = (ymd: string): string => { let d = ymd; for (let i = 0; i < 7 && !NBT_DAYS[weekdayOf(d)]; i++) d = addDays(d, 1); return d; };

/** A detail's lines, bullets and all, trimmed. */
const linesOf = (detail: string | null | undefined): string[] =>
  (detail ?? "").split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);

export function renderWorkout(date: string, day: NbtDay, plan: PlanBlocks | null): { subject: string; html: string; text: string } {
  const meta = NBT_DAYS[weekdayOf(date)];
  const when = longDate(date);
  const subject = `Non-Battle Team · ${meta.label}: ${meta.title}${day.focus ? ` — ${day.focus}` : ""}`;
  const m = day.minutes ?? {};
  const total = (m.prep ?? 0) + (m.lift ?? 0) + (m.work ?? 0) + (m.reset ?? 0);

  const h = (t: string, mins?: number) =>
    `<p style="margin:22px 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">${escapeHtml(t)}${mins ? ` <span style="color:#b0b0b0;font-weight:600;letter-spacing:0;">· ${mins} min</span>` : ""}</p>`;
  const list = (items: string[] | undefined) =>
    items?.length ? `<ul style="margin:0;padding:0 0 0 18px;color:#111;font-size:14px;line-height:1.55;">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";
  const trackBox = (label: string, color: string, inner: string) =>
    `<td width="50%" valign="top" style="padding:0 6px 0 0;"><div style="border:1px solid ${color}66;border-left:4px solid ${color};border-radius:10px;padding:10px 12px;">
      <p style="margin:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;letter-spacing:2px;color:${color};">${label}</p>${inner}</div></td>`;
  const lift = day.lift ?? {};
  const liftTrack = (t?: Track) => t?.name ? `<p style="margin:0;color:#111;font-size:15px;font-weight:700;">${escapeHtml(t.name)}</p>${t.detail ? `<p style="margin:2px 0 0 0;color:#374151;font-size:14px;">${escapeHtml(t.detail)}</p>` : ""}` : `<p style="margin:0;color:#9ca3af;font-size:13px;">—</p>`;
  const work = day.work ?? {};

  const planHtml = plan?.blocks.length
    ? h(`Tonight at practice · Non-Battle Team`) +
      plan.blocks.map((b) => `<p style="margin:10px 0 2px 0;color:#111;font-size:14px;font-weight:700;">${escapeHtml(b.category)}</p>${b.lines.length ? list(b.lines) : `<p style="margin:0;color:#9ca3af;font-size:13px;font-style:italic;">Coach's call</p>`}`).join("")
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        <tr><td style="background-color:${NLA_RED};padding:26px 32px;text-align:center;">
          <p style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:4px;margin:0;font-family:Arial,Helvetica,sans-serif;">NON-BATTLE TEAM</p>
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0 0;font-style:italic;">Today's workout · ${escapeHtml(meta.title)}</p>
        </td></tr>
        <tr><td style="padding:30px 36px 26px 36px;">
          <h1 style="color:#111;font-size:21px;margin:0 0 4px 0;font-weight:700;">${escapeHtml(when)}</h1>
          ${day.focus ? `<p style="color:#6b7280;font-size:14px;margin:0;line-height:1.5;">Focus: ${escapeHtml(day.focus)}${total ? ` · about ${total} minutes, then boxing` : ""}</p>` : ""}

          ${h(`Learn + lift${lift.pattern ? ` · ${lift.pattern}` : ""}`, m.lift)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${trackBox("ALPHA", ALPHA, liftTrack(lift.alpha))}
            ${trackBox("BRAVO", BRAVO, liftTrack(lift.bravo))}
          </tr></table>
          ${lift.cues?.length ? `<p style="margin:8px 0 0 0;color:#374151;font-size:13px;line-height:1.5;">${lift.cues.map(escapeHtml).join(" · ")}</p>` : ""}

          ${h(`Cardio${work.title ? ` · ${work.title}` : ""}`, m.work)}
          ${work.emphasis ? `<p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">${escapeHtml(work.emphasis)}${work.result_unit ? ` · athletes write down ${escapeHtml(work.result_unit)}` : ""}</p>` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${trackBox("ALPHA", ALPHA, list(work.alpha) || `<p style="margin:0;color:#9ca3af;font-size:13px;">—</p>`)}
            ${trackBox("BRAVO", BRAVO, list(work.bravo) || `<p style="margin:0;color:#9ca3af;font-size:13px;">—</p>`)}
          </tr></table>

          ${planHtml}

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 0 0 0;text-align:center;">
            <a href="${PLAN_URL}" style="display:inline-block;background-color:${NLA_RED};color:#ffffff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:10px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Open the plan to edit</a>
            <p style="margin:10px 0 0 0;color:#9ca3af;font-size:12px;">Change anything before practice and the wall shows your change tonight.</p>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 36px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
          <p style="color:#b0b0b0;font-size:11px;margin:0;">No Limits Academy · Cape May County, NJ</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const t: string[] = [subject, "", when + (day.focus ? ` — ${day.focus}` : ""), ""];
  t.push(`LEARN + LIFT${lift.pattern ? ` · ${lift.pattern}` : ""}${m.lift ? ` (${m.lift} min)` : ""}`);
  t.push(`Alpha: ${lift.alpha?.name ?? "—"}${lift.alpha?.detail ? ` — ${lift.alpha.detail}` : ""}`);
  t.push(`Bravo: ${lift.bravo?.name ?? "—"}${lift.bravo?.detail ? ` — ${lift.bravo.detail}` : ""}`);
  if (lift.cues?.length) t.push(`Cues: ${lift.cues.join(" · ")}`);
  t.push("");
  t.push(`CARDIO${work.title ? ` · ${work.title}` : ""}${m.work ? ` (${m.work} min)` : ""}`);
  t.push("Alpha:"); for (const l of work.alpha ?? []) t.push(`  • ${l}`);
  t.push("Bravo:"); for (const l of work.bravo ?? []) t.push(`  • ${l}`);
  t.push("");
  if (plan?.blocks.length) { t.push("TONIGHT AT PRACTICE · NON-BATTLE TEAM"); for (const b of plan.blocks) { t.push(b.category); for (const l of b.lines) t.push(`  • ${l}`); } t.push(""); }
  t.push(`Open the plan to edit: ${PLAN_URL}`);
  return { subject, html, text: t.join("\n") };
}

export function renderNothingLocked(date: string): { subject: string; html: string; text: string } {
  const meta = NBT_DAYS[weekdayOf(date)];
  const subject = `Nothing locked for the Non-Battle Team today (${meta.label})`;
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Georgia,serif;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:${NLA_RED};padding:20px 32px;text-align:center;color:#fff;font-family:Arial,sans-serif;font-weight:800;letter-spacing:4px;">NON-BATTLE TEAM</td></tr>
    <tr><td style="padding:28px 36px;">
      <h1 style="font-size:19px;margin:0 0 8px 0;color:#111;">${escapeHtml(longDate(date))}: the week isn't locked.</h1>
      <p style="color:#6b7280;font-size:14px;line-height:1.5;margin:0 0 20px 0;">Rev's 7 AM email was held because this week's Non-Battle Team plan is still a draft. Lock it and send it from the plan.</p>
      <p style="text-align:center;margin:0;"><a href="${PLAN_URL}" style="display:inline-block;background:${NLA_RED};color:#fff;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;">Open the plan</a></p>
    </td></tr>
  </table></body></html>`;
  return { subject, html, text: `${subject}\n\nThe week isn't locked, so Rev's email was held. Lock it and send it from the plan: ${PLAN_URL}` };
}

interface PlanBlocks { blocks: PlanBlock[] }
/** The night's Non-Battle Team column from the Practice Plan: the week's blocks, each with its own words or the template's standing words. */
async function loadPlan(service: ReturnType<typeof createClient>, date: string): Promise<PlanBlocks | null> {
  const weekStart = mondayOf(date);
  const weekday = weekdayOf(date);
  const { data: week } = await service.from("practice_weeks").select("id").eq("week_start", weekStart).maybeSingle();
  if (!week) return null;
  const [{ data: blocks }, { data: tpl }] = await Promise.all([
    service.from("practice_blocks").select("position, category, detail, hidden").eq("week_id", week.id).eq("group", "non_battle_team").eq("weekday", weekday).order("position"),
    service.from("practice_template_blocks").select("position, detail").eq("group", "non_battle_team").eq("weekday", weekday),
  ]);
  const standing = new Map((tpl ?? []).map((t: { position: number; detail: string | null }) => [t.position, t.detail]));
  const out: PlanBlock[] = [];
  for (const b of (blocks ?? []) as { position: number; category: string; detail: string | null; hidden: boolean }[]) {
    if (b.hidden) continue;
    out.push({ category: b.category, lines: linesOf(b.detail?.trim() ? b.detail : standing.get(b.position) ?? null) });
  }
  return { blocks: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");
    const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    let sampleTo = "";
    let date = todayET;

    if (isCron) {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      sampleTo = typeof body?.sample_to === "string" ? body.sample_to.trim().toLowerCase() : "";
      if (sampleTo && !sampleTo.endsWith("@nolimitsboxingacademy.org")) return json({ error: "Samples go to academy addresses only." }, 400);
      if (sampleTo) {
        // A sample of a particular day, or of today / the next NBT day.
        const asked = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : "";
        date = asked && NBT_DAYS[weekdayOf(asked)] ? asked : nextNbtDay(todayET);
      } else {
        const easternHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
        if (easternHour !== SEND_HOUR) return json({ sent: [], reason: `wrong hour: ${easternHour}` });
        if (!NBT_DAYS[weekdayOf(todayET)]) return json({ sent: [], reason: `not a Non-Battle Team day` });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: role } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admins only" }, 403);
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      // "Send to Rev now": today, or a date the plan names.
      date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : nextNbtDay(todayET);
      if (!NBT_DAYS[weekdayOf(date)]) return json({ error: "That is not a Non-Battle Team day." }, 400);
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const meta = NBT_DAYS[weekdayOf(date)];
    const { data: week } = await service.from("nbt_weeks").select("status, days").eq("week_start", mondayOf(date)).maybeSingle();
    const day = (week?.days as Record<string, NbtDay> | undefined)?.[meta.key];
    const locked = week?.status === "locked" && !!day?.lift;

    if (!locked) {
      const mail = renderNothingLocked(date);
      const to = sampleTo ? [sampleTo] : FALLBACK;
      const { error } = await resend.emails.send({ from: FROM, to, subject: `${sampleTo ? "[SAMPLE] " : ""}${mail.subject}`, html: mail.html, text: mail.text });
      if (error) throw new Error(`Resend failed: ${error.message}`);
      return json({ sent: to, held: true, date });
    }

    const plan = await loadPlan(service, date);
    const mail = renderWorkout(date, day!, plan);
    const to = sampleTo ? [sampleTo] : RECIPIENTS;
    const { error } = await resend.emails.send({ from: FROM, to, subject: `${sampleTo ? "[SAMPLE] " : ""}${mail.subject}`, html: mail.html, text: mail.text });
    if (error) throw new Error(`Resend failed: ${error.message}`);
    return json({ sent: to, date, sample: !!sampleTo });
  } catch (e) {
    console.error("nbt-morning error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
