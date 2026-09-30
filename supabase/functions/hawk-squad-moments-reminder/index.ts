// hawk-squad-moments-reminder — emails Chrissy at 8 AM Eastern, from Friday
// and then every day, until the week's Weekly Standout Moments entry is
// written. Skips weeks with no Hawk Squad check-ins (nothing to write about).
//
// Which week: the one whose sessions have just happened. Friday to Sunday
// that is the current week; Monday to Thursday it is last week, still open
// until it is done. Weeks run Monday to Sunday and are keyed by the Monday.
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
const PAGE = "https://www.nolimitsboxingacademy.org/admin/operations/hawk-squad/intelligence";
const GREEN = "#0f4c2f", GOLD = "#f2c230";
// Hawk Squad's first day is Tue Oct 6, 2026: no reminders for earlier weeks.
const START_WEEK = "2026-10-05";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Today in New Jersey as YYYY-MM-DD. */
const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The Monday of the week holding this date. */
const weekStart = (ymd: string) => addDays(ymd, -((new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7));
/** The week the reminder is about (see the header comment). */
export const targetWeek = (today: string) => {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  const thisMonday = weekStart(today);
  return dow === 5 || dow === 6 || dow === 0 ? thisMonday : addDays(thisMonday, -7);
};
const fmt = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderEmail(week: string, sessions: Array<{ date: string; count: number }>): { subject: string; html: string; text: string } {
  const label = `Week of ${fmt(week)}`;
  const link = `${PAGE}?moments=${week}#moments`;
  const sessionRows = sessions.map((s) =>
    `<tr><td style="padding:6px 0;color:#374151;font-size:14px;">${escapeHtml(new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }))}</td>
         <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;text-align:right;">${s.count} student${s.count === 1 ? "" : "s"}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        <tr><td style="background-color:${GREEN};padding:28px 32px;text-align:center;">
          <p style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:4px;margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;">HAWK SQUAD</p>
          <p style="color:${GOLD};font-size:12px;margin:0;font-style:italic;">The Ultimate Afterschool Experience</p>
        </td></tr>
        <tr><td style="height:6px;background-color:${GOLD};"></td></tr>
        <tr><td style="padding:32px 36px 28px 36px;">
          <h1 style="color:#111;font-size:22px;margin:0 0 6px 0;font-weight:700;">Weekly Standout Moments</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px 0;line-height:1.5;">${escapeHtml(label)} is still waiting for its nuggets. A few sentences is plenty — what the kids did, what they enjoyed, anything that made you smile.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:12px;border:1px solid #eee;">
            <tr><td style="padding:16px 22px;">
              <p style="margin:0 0 6px 0;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">This week's sessions</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sessionRows}</table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 0 0 0;text-align:center;">
              <a href="${link}" style="display:inline-block;background-color:${GREEN};color:${GOLD};font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;font-family:Arial,Helvetica,sans-serif;">Write this week's moments →</a>
            </td></tr>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin:22px 0 0 0;text-align:center;">This reminder comes every morning at 8 until the week is written. Once it is saved, it stops.</p>
        </td></tr>
        <tr><td style="padding:18px 36px;background-color:${GREEN};text-align:center;">
          <p style="color:${GOLD};font-size:11px;margin:0;">Hawk Squad at No Limits Academy</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `Weekly Standout Moments — ${label}\n\nThis week's entry is still waiting. A few sentences is plenty.\n\n${sessions.map((s) => `${s.date}: ${s.count} students`).join("\n")}\n\nWrite it here: ${link}`;
  return { subject: `Weekly Standout Moments — ${label}`, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");

    if (isCron) {
      // 12:00 and 13:00 UTC are scheduled; keep the one that is 8 AM Eastern.
      const easternHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
      if (easternHour !== 8) return json({ sent: false, reason: `wrong hour: ${easternHour}` });
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
    const today = todayET();
    const week = targetWeek(today);
    const weekEnd = addDays(week, 6);
    if (week < START_WEEK) return json({ sent: false, reason: "before the first week", week });

    // Already written? Then nothing to send.
    const { data: entry } = await service.from("hawk_squad_weekly_moments").select("notes").eq("week_start", week).maybeSingle();
    if (entry && String(entry.notes ?? "").trim()) return json({ sent: false, reason: "already written", week });

    // Any sessions that week? No check-ins means nothing to write about.
    const { data: att } = await service.from("hawk_squad_attendance").select("check_in_date").gte("check_in_date", week).lte("check_in_date", weekEnd);
    const counts = new Map<string, number>();
    for (const r of att ?? []) counts.set(r.check_in_date, (counts.get(r.check_in_date) ?? 0) + 1);
    if (counts.size === 0) return json({ sent: false, reason: "no sessions that week", week });
    const sessions = [...counts.entries()].sort().map(([date, count]) => ({ date, count }));

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const mail = renderEmail(week, sessions);
    const { error: sendError } = await resend.emails.send({ from: FROM, to: [TO], subject: mail.subject, html: mail.html, text: mail.text });
    if (sendError) throw new Error(`Resend failed: ${sendError.message}`);
    return json({ sent: true, week, sessions });
  } catch (e) {
    console.error("hawk-squad-moments-reminder error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
