// lap-reminder — the morning of the weekly agenda (The Lap), 8 AM Eastern.
//
// To Josh and Chrissy: last lap's open commitments, by owner, so both arrive
// at the start line knowing what they will be asked about. Nothing open →
// a one-line "see you at the start line". Lap day is Monday (LAP_WEEKDAY).
//
// Callers: pg_cron with X-Cron-Secret (hour- and day-guarded), or an admin
// JWT (sends now, any day — for testing). Cron body {"sample_to": "<academy
// address>"} sends a sample to one address with example commitments.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FROM = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";
const LAP_URL = "https://www.nolimitsboxingacademy.org/admin/the-lap";
const NLA_RED = "#bf0f3e";
/** 1 = Monday. The day the weekly agenda runs. */
export const LAP_WEEKDAY = 1;
export const RECIPIENTS = ["joshmercado@nolimitsboxingacademy.org", "chrissycasiello@nolimitsboxingacademy.org"];
const NAME_BY_MANAGER: Record<string, string> = { PD: "Josh", PC: "Chrissy", ATM: "Alex", APC: "Alex" };

export interface OpenCommitment { title: string; owners: string[]; carry_count: number; topic: string | null }

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const managerOf = (source: string | null) => (!source ? "PD" : source.includes(":") ? source.split(":")[0] : "PD");

/** Rows → one line per commitment, both owners named, the most-carried first. */
export const groupOpen = (rows: Array<{ title: string; source: string | null; lap_commitment_id: string | null; carry_count: number; topic: string | null }>): OpenCommitment[] => {
  const by = new Map<string, OpenCommitment>();
  for (const r of rows) {
    const k = r.lap_commitment_id ?? `${r.title}|${r.source}`;
    const owner = NAME_BY_MANAGER[managerOf(r.source)] ?? managerOf(r.source);
    const g = by.get(k) ?? { title: r.title, owners: [], carry_count: 0, topic: r.topic };
    if (!g.owners.includes(owner)) g.owners.push(owner);
    g.carry_count = Math.max(g.carry_count, r.carry_count);
    by.set(k, g);
  }
  return [...by.values()].sort((a, b) => b.carry_count - a.carry_count || a.title.localeCompare(b.title));
};

export function renderEmail(lapDate: string, open: OpenCommitment[]): { subject: string; html: string; text: string } {
  const day = new Date(`${lapDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const subject = open.length ? `The Lap is today — ${open.length} commitment${open.length === 1 ? "" : "s"} to review first` : "The Lap is today — nothing open from last week";
  const rows = open.map((o) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;color:#111;font-size:14px;">${escapeHtml(o.title)}${o.carry_count >= 2 ? ` <span style="color:#dc2626;font-weight:700;">· carried ${o.carry_count} laps</span>` : o.carry_count === 1 ? ` <span style="color:#b45309;">· carried once</span>` : ""}</td>
      <td style="padding:8px 0 8px 12px;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;text-align:right;white-space:nowrap;">${escapeHtml(o.owners.join(" & "))}${o.topic ? `<br><span style="font-size:11px;">${escapeHtml(o.topic)}</span>` : ""}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        <tr><td style="background-color:${NLA_RED};padding:26px 32px;text-align:center;">
          <p style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:4px;margin:0;font-family:Arial,Helvetica,sans-serif;">THE LAP</p>
          <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:6px 0 0 0;font-style:italic;">The weekly agenda · one lap around NLA</p>
        </td></tr>
        <tr><td style="padding:30px 36px 26px 36px;">
          <h1 style="color:#111;font-size:21px;margin:0 0 6px 0;font-weight:700;">${escapeHtml(day)}: the lap is today.</h1>
          ${open.length
            ? `<p style="color:#6b7280;font-size:14px;margin:0 0 18px 0;line-height:1.5;">Last lap's commitments still open. Each one gets a check, a carry forward, or a drop before the start line.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`
            : `<p style="color:#6b7280;font-size:14px;margin:0 0 18px 0;line-height:1.5;">Nothing is open from last lap. See you at the start line.</p>`}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 0 0 0;text-align:center;">
            <a href="${LAP_URL}" style="display:inline-block;background-color:${NLA_RED};color:#ffffff;font-size:14px;font-weight:700;padding:13px 32px;border-radius:10px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Open the Lap</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:16px 36px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
          <p style="color:#b0b0b0;font-size:11px;margin:0;">No Limits Academy · Cape May County, NJ</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = `${subject}\n\n${open.length ? open.map((o) => `• ${o.title} — ${o.owners.join(" & ")}${o.carry_count ? ` (carried ${o.carry_count})` : ""}`).join("\n") : "Nothing is open from last lap."}\n\n${LAP_URL}`;
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = !!cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");
    const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    let sampleTo = "";

    if (isCron) {
      const body = await req.json().catch(() => ({} as Record<string, unknown>));
      sampleTo = typeof body?.sample_to === "string" ? body.sample_to.trim().toLowerCase() : "";
      if (sampleTo && !sampleTo.endsWith("@nolimitsboxingacademy.org")) return json({ error: "Samples go to academy addresses only." }, 400);
      if (!sampleTo) {
        const easternHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date()));
        if (easternHour !== 8) return json({ sent: [], reason: `wrong hour: ${easternHour}` });
        const dow = new Date(`${todayET}T12:00:00Z`).getUTCDay();
        if (dow !== LAP_WEEKDAY) return json({ sent: [], reason: `not lap day (weekday ${dow})` });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: role } = await userClient.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Admins only" }, 403);
    }

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    if (sampleTo) {
      const sample = renderEmail(todayET, [
        { title: "Confirm the bus for November 7", owners: ["Chrissy"], carry_count: 2, topic: "Transportation" },
        { title: "Post the practice plan by Sunday", owners: ["Josh", "Chrissy"], carry_count: 0, topic: "Schedule" },
      ]);
      const { error } = await resend.emails.send({ from: FROM, to: [sampleTo], subject: `[SAMPLE] ${sample.subject}`, html: sample.html, text: sample.text });
      if (error) throw new Error(`Resend failed: ${error.message}`);
      return json({ sample: true, to: sampleTo });
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Last lap's open commitments, plus any already carried and waiting between laps.
    const { data: last } = await service.from("laps").select("id").in("status", ["finished", "incomplete"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
    let q = service.from("signals").select("title, source, lap_commitment_id, carry_count, lap_topic_id").not("lap_commitment_id", "is", null).eq("is_archived", false).eq("is_trashed", false).neq("status", "Complete");
    q = last ? q.or(`lap_id.eq.${last.id},lap_id.is.null`) : q.is("lap_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { data: topics } = await service.from("lap_topics").select("id, title");
    const titleOf = new Map((topics ?? []).map((t: { id: string; title: string }) => [t.id, t.title]));
    const open = groupOpen((rows ?? []).map((r: { title: string; source: string | null; lap_commitment_id: string | null; carry_count: number; lap_topic_id: string | null }) =>
      ({ title: r.title, source: r.source, lap_commitment_id: r.lap_commitment_id, carry_count: r.carry_count, topic: r.lap_topic_id ? titleOf.get(r.lap_topic_id) ?? null : null })));

    const mail = renderEmail(todayET, open);
    const { error: sendError } = await resend.emails.send({ from: FROM, to: RECIPIENTS, subject: mail.subject, html: mail.html, text: mail.text });
    if (sendError) throw new Error(`Resend failed: ${sendError.message}`);
    return json({ sent: RECIPIENTS, open: open.length });
  } catch (e) {
    console.error("lap-reminder error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
