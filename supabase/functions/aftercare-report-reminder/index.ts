// aftercare-report-reminder — at 8 PM Eastern, every day, emails each lab's
// coach about any Tuesday aftercare session whose half of the journal is not
// written yet, until it is.
//
//   Jaime   owns Smile Lab: the "what we covered" note (caring_note) and at
//           least one Smile Lab standout moment.
//   Chrissy owns Life Lab:  the note (sharing_note) and at least one Life Lab
//           standout moment.
//
// A session counts only if it had aftercare check-ins (attendance_records
// with program_source 'Smile Lab'); a skipped week never nags. Each person
// gets one email listing every open date, and nothing once their half is
// complete. Josh is not copied.
//
// Callers: pg_cron with X-Cron-Secret (hour-guarded), or an admin JWT
// (runs now, for testing; pass {"dry": true} to see who would get what).
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FROM = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";
const JOURNAL_URL = "https://www.nolimitsboxingacademy.org/admin/operations/smile-lab-attendance";
const LOOKBACK_DAYS = 56; // the last eight Tuesdays
// Nothing before this date is ever asked for (Josh, 2026-10-07).
const FIRST_SESSION = "2026-10-06";

export type Lab = "smile" | "life";
export const LABS: Record<Lab, { name: string; coach: string; to: string; colour: string; emoji: string }> = {
  smile: { name: "Smile Lab", coach: "Jaime", to: "jaime@nolimitsboxingacademy.org", colour: "#0d9488", emoji: "🦷" },
  // Life Lab is rose on the Intelligence page; a deeper rose here so white text reads.
  life: { name: "Life Lab", coach: "Chrissy", to: "chrissycasiello@nolimitsboxingacademy.org", colour: "#e11d48", emoji: "😊" },
};
const LAB_PREFIX: Record<Lab, string> = { smile: "Smile Lab — ", life: "Life Lab — " };

export interface SessionRow { session_date: string; caring_note: string | null; sharing_note: string | null; highlights: unknown }

/** What is still missing for one lab on one date: [] when that half is done. */
export const missingFor = (lab: Lab, row: SessionRow | null): string[] => {
  const note = lab === "smile" ? row?.caring_note : row?.sharing_note;
  const highlights = Array.isArray(row?.highlights) ? (row!.highlights as unknown[]).filter((h): h is string => typeof h === "string") : [];
  const moments = highlights.filter((h) => h.startsWith(LAB_PREFIX[lab]) && h.slice(LAB_PREFIX[lab].length).trim());
  const out: string[] = [];
  if (!(note ?? "").trim()) out.push("what we covered");
  if (moments.length === 0) out.push("standout moments");
  return out;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmt = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface OpenDate { date: string; missing: string[]; students: number }

export function renderEmail(lab: Lab, open: OpenDate[]): { subject: string; html: string; text: string } {
  const L = LABS[lab];
  const first = open[0];
  const subject = open.length === 1
    ? `Submit your ${L.name} report for ${fmt(first.date)}`
    : `Submit your ${L.name} reports — ${open.length} Tuesdays open`;
  const rows = open.map((o) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;vertical-align:top;">
        <p style="margin:0;color:#111;font-size:15px;font-weight:700;">${escapeHtml(fmt(o.date))}</p>
        <p style="margin:2px 0 0 0;color:#6b7280;font-size:13px;">${o.students} student${o.students === 1 ? "" : "s"} · still needs: <strong style="color:#111;">${escapeHtml(o.missing.join(" and "))}</strong></p>
      </td>
      <td style="padding:10px 0 10px 12px;border-bottom:1px solid #eee;text-align:right;vertical-align:middle;white-space:nowrap;">
        <a href="${JOURNAL_URL}?journal=${o.date}" style="display:inline-block;background-color:${L.colour};color:#ffffff;font-size:13px;font-weight:700;padding:9px 14px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Write it →</a>
      </td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        <tr><td style="background-color:${L.colour};padding:26px 32px;text-align:center;">
          <p style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:2px;margin:0;font-family:Arial,Helvetica,sans-serif;">${L.emoji} ${escapeHtml(L.name.toUpperCase())}</p>
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0 0;font-style:italic;">Juniors Aftercare · No Limits Academy</p>
        </td></tr>
        <tr><td style="padding:30px 36px 26px 36px;">
          <h1 style="color:#111;font-size:21px;margin:0 0 6px 0;font-weight:700;">Hi ${escapeHtml(L.coach)} — your ${escapeHtml(L.name)} report is waiting</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 18px 0;line-height:1.5;">A few sentences on what you covered and one or two standout moments is all it takes. The grant reports are built from these.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <p style="color:#9ca3af;font-size:12px;margin:22px 0 0 0;text-align:center;">This reminder comes every evening at 8 until the report is in. Once it is saved, it stops.</p>
        </td></tr>
        <tr><td style="padding:16px 36px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
          <p style="color:#b0b0b0;font-size:11px;margin:0;">No Limits Academy · Cape May County, NJ</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `${subject}\n\n${open.map((o) => `${fmt(o.date)} — still needs: ${o.missing.join(" and ")}\n${JOURNAL_URL}?journal=${o.date}`).join("\n\n")}\n\nThis reminder comes every evening at 8 until the report is in.`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");
    let dry = false;

    if (isCron) {
      // A sample, for seeing what the email looks like: {"sample_to": "<academy address>", "sample_lab": "smile" | "life"}.
      // Needs the scheduler's secret; only academy addresses; example dates.
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      const sampleTo = typeof body?.sample_to === "string" ? body.sample_to.trim().toLowerCase() : "";
      if (sampleTo) {
        if (!sampleTo.endsWith("@nolimitsboxingacademy.org")) return json({ error: "Samples go to academy addresses only." }, 400);
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        const sampleLab: Lab = body?.sample_lab === "life" ? "life" : "smile";
        const sample = renderEmail(sampleLab, [
          { date: "2026-09-29", missing: ["standout moments"], students: 20 },
          { date: "2026-10-06", missing: ["what we covered", "standout moments"], students: 20 },
        ]);
        const { error: sendError } = await resend.emails.send({ from: FROM, to: [sampleTo], subject: `[SAMPLE] ${sample.subject}`, html: sample.html, text: sample.text });
        if (sendError) throw new Error(`Resend failed: ${sendError.message}`);
        return json({ sample: true, lab: sampleLab, to: sampleTo });
      }
      // Scheduled at 00:00 and 01:00 UTC; keep the run that is 8 PM Eastern.
      const easternHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
      if (easternHour !== 20) return json({ sent: [], reason: `wrong hour: ${easternHour}` });
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (error || !user) return json({ error: "Unauthorized" }, 401);
      const { data: role } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admin access required." }, 403);
      dry = !!(await req.json().catch(() => ({})))?.dry;
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = todayET();
    const lookback = addDays(today, -LOOKBACK_DAYS);
    const since = lookback > FIRST_SESSION ? lookback : FIRST_SESSION;

    // Session dates that actually happened: aftercare check-ins, up to today.
    const { data: att, error: attError } = await service.from("attendance_records")
      .select("check_in_date").eq("program_source", "Smile Lab").gte("check_in_date", since).lte("check_in_date", today);
    if (attError) throw new Error(attError.message);
    const students = new Map<string, number>();
    for (const r of att ?? []) students.set(r.check_in_date, (students.get(r.check_in_date) ?? 0) + 1);
    const dates = [...students.keys()].sort();
    if (dates.length === 0) return json({ sent: [], reason: "no sessions in the window" });

    const { data: sessions, error: sessError } = await service.from("smile_lab_sessions")
      .select("session_date, caring_note, sharing_note, highlights").in("session_date", dates);
    if (sessError) throw new Error(sessError.message);
    const byDate = new Map((sessions ?? []).map((s) => [s.session_date, s as SessionRow]));

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const results: Array<{ lab: Lab; to: string; open: OpenDate[]; sent: boolean }> = [];
    for (const lab of ["smile", "life"] as Lab[]) {
      const open: OpenDate[] = dates
        .map((date) => ({ date, missing: missingFor(lab, byDate.get(date) ?? null), students: students.get(date) ?? 0 }))
        .filter((o) => o.missing.length > 0);
      if (open.length === 0) { results.push({ lab, to: LABS[lab].to, open, sent: false }); continue; }
      if (dry) { results.push({ lab, to: LABS[lab].to, open, sent: false }); continue; }
      const mail = renderEmail(lab, open);
      const { error: sendError } = await resend.emails.send({ from: FROM, to: [LABS[lab].to], subject: mail.subject, html: mail.html, text: mail.text });
      if (sendError) throw new Error(`Resend failed for ${lab}: ${sendError.message}`);
      results.push({ lab, to: LABS[lab].to, open, sent: true });
    }
    return json({ results, dry });
  } catch (e) {
    console.error("aftercare-report-reminder error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
