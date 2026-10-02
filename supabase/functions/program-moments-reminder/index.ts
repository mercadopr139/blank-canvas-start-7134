// program-moments-reminder — emails Chrissy at 8 AM Eastern, every day from
// the day a week's Weekly Standout Moments become due, until the entry is
// written. One run covers every partner program. Skips weeks with no
// check-ins (nothing to write about) and weeks before a program's first.
//
// Which week is due: for a program that meets midweek (Hawk Squad, Tue/Thu)
// Friday to Sunday it is the current week, Monday to Thursday last week; for
// a program that meets Friday (BAM) it is always the week that just ended.
// Weeks run Monday to Sunday and are keyed by the Monday.
//
// Callers: pg_cron with X-Cron-Secret (hour-guarded), or an admin JWT
// (sends now, for testing).
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TO = "chrissycasiello@nolimitsboxingacademy.org";
const FROM = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";
const BASE = "https://www.nolimitsboxingacademy.org/admin/operations";

// The same facts as src/lib/programs.ts, for the pieces this function needs.
export interface Program {
  key: string; name: string; slug: string; tagline: string;
  attendance: string; moments: string;
  startWeek: string; dueFrom: 5 | 1;
  primary: string; accent: string;
}
export const PROGRAMS: Program[] = [
  { key: "hawk", name: "Hawk Squad", slug: "hawk-squad", tagline: "The Ultimate Afterschool Experience",
    attendance: "hawk_squad_attendance", moments: "hawk_squad_weekly_moments",
    startWeek: "2026-10-05", dueFrom: 5, primary: "#0f4c2f", accent: "#f2c230" },
  { key: "bam", name: "BAM", slug: "bam", tagline: "Body and Mind",
    attendance: "bam_attendance", moments: "bam_weekly_moments",
    startWeek: "2026-10-05", dueFrom: 1, primary: "#374151", accent: "#d1d5db" },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Today in New Jersey as YYYY-MM-DD. */
const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  // eslint-disable-next-line no-restricted-syntax -- pure UTC-noon date arithmetic on a YYYY-MM-DD string; no "today" involved
  return d.toISOString().slice(0, 10);
};
/** The Monday of the week holding this date. */
const weekStart = (ymd: string) => addDays(ymd, -((new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7));
/** The week the reminder is about (see the header comment). */
export const targetWeek = (today: string, dueFrom: 5 | 1 = 5) => {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const thisMonday = weekStart(today);
  if (dueFrom === 1) return addDays(thisMonday, -7);
  return dow === 5 || dow === 6 || dow === 0 ? thisMonday : addDays(thisMonday, -7);
};
const fmt = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEmail(p: Program, week: string, sessions: Array<{ date: string; count: number }>): { subject: string; html: string; text: string } {
  const label = `Week of ${fmt(week)}`;
  const link = `${BASE}/${p.slug}/intelligence?moments=${week}#moments`;
  const sessionRows = sessions.map((s) =>
    `<tr><td style="padding:6px 0;color:#374151;font-size:14px;">${escapeHtml(new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }))}</td>
         <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">${s.count} student${s.count === 1 ? "" : "s"}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        <tr><td style="background-color:${p.primary};padding:28px 32px;text-align:center;">
          <p style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:4px;margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(p.name.toUpperCase())}</p>
          <p style="color:${p.accent};font-size:12px;margin:0;font-style:italic;">${escapeHtml(p.tagline)}</p>
        </td></tr>
        <tr><td style="height:6px;background-color:${p.accent};"></td></tr>
        <tr><td style="padding:32px 36px 28px 36px;">
          <h1 style="color:#111;font-size:22px;margin:0 0 6px 0;font-weight:700;">Weekly Standout Moments</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px 0;line-height:1.5;">${escapeHtml(p.name)} — ${escapeHtml(label)} is still waiting for its nuggets. A few sentences is plenty — what the kids did, what they enjoyed, anything that made you smile.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:12px;border:1px solid #eee;">
            <tr><td style="padding:16px 22px;">
              <p style="margin:0 0 6px 0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">That week's sessions</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sessionRows}</table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 0 0 0;text-align:center;">
              <a href="${link}" style="display:inline-block;background-color:${p.primary};color:${p.accent};font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;">Write the week's moments →</a>
            </td></tr>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin:22px 0 0 0;text-align:center;">This reminder comes every morning at 8 until the week is written. Once it is saved, it stops.</p>
        </td></tr>
        <tr><td style="padding:18px 36px;background-color:${p.primary};text-align:center;">
          <p style="color:${p.accent};font-size:11px;margin:0;">${escapeHtml(p.name)} at No Limits Academy</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `Weekly Standout Moments — ${p.name} — ${label}\n\nThat week's entry is still waiting. A few sentences is plenty.\n\n${sessions.map((s) => `${s.date}: ${s.count} students`).join("\n")}\n\nWrite it here: ${link}`;
  return { subject: `${p.name} Weekly Standout Moments — ${label}`, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");

    if (isCron) {
      // 12:00 and 13:00 UTC are scheduled; keep the one that is 8 AM Eastern.
      const easternHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
      if (easternHour !== 8) return json({ sent: [], reason: `wrong hour: ${easternHour}` });
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
      if (error || !user) return json({ error: "Unauthorized" }, 401);
      const { data: role } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admin access required." }, 403);
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const today = todayET();
    const results: Array<{ program: string; week: string; sent: boolean; reason?: string }> = [];

    for (const p of PROGRAMS) {
      const week = targetWeek(today, p.dueFrom);
      const weekEnd = addDays(week, 6);
      if (week < p.startWeek) { results.push({ program: p.key, week, sent: false, reason: "before the first week" }); continue; }

      const { data: entry } = await service.from(p.moments).select("notes").eq("week_start", week).maybeSingle();
      if (entry && String(entry.notes ?? "").trim()) { results.push({ program: p.key, week, sent: false, reason: "already written" }); continue; }

      const { data: att } = await service.from(p.attendance).select("check_in_date").gte("check_in_date", week).lte("check_in_date", weekEnd);
      const counts = new Map<string, number>();
      for (const r of att ?? []) counts.set(r.check_in_date, (counts.get(r.check_in_date) ?? 0) + 1);
      if (counts.size === 0) { results.push({ program: p.key, week, sent: false, reason: "no sessions that week" }); continue; }
      const sessions = [...counts.entries()].sort().map(([date, count]) => ({ date, count }));

      const mail = renderEmail(p, week, sessions);
      const { error: sendError } = await resend.emails.send({ from: FROM, to: [TO], subject: mail.subject, html: mail.html, text: mail.text });
      if (sendError) throw new Error(`Resend failed for ${p.key}: ${sendError.message}`);
      results.push({ program: p.key, week, sent: true });
    }
    return json({ results });
  } catch (e) {
    console.error("program-moments-reminder error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
