// Detects youth whose pickup/dropoff pair is incomplete for the
// current day in America/New_York and emails the admins. Designed to
// run on a 9 PM Eastern cron, but also callable on demand from the
// Trips & Pay admin UI for testing.
//
// Detection rule (youth-level, not run-level — handles "different
// driver picks up vs. drops off the same kid" naturally):
//   - youth has picked_up record today but no dropped_off → flag
//   - youth has dropped_off record today but no picked_up → flag
//
// Runs across all routes (Woodbine, Wildwood, Both, Overflow, the
// zone-aware "Both - X" variants) without route-specific logic.

import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RECIPIENTS = [
  "joshmercado@nolimitsboxingacademy.org",
  "chrissycasiello@nolimitsboxingacademy.org",
];

const FROM_ADDRESS = "No Limits Academy <joshmercado@nolimitsboxingacademy.org>";

type RunRow = {
  id: string;
  run_type: string;
  started_at: string;
  drivers: { id: string; name: string } | null;
  routes: { id: string; name: string } | null;
};

const formatEasternDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const formatEasternTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });

const formatDateForSubject = (yyyymmdd: string): string => {
  const d = new Date(yyyymmdd + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: either the cron shared secret OR an admin user JWT (for
    // the manual "Run Now" button on Trips & Pay).
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");

    // DST-proof time guard for cron calls. The cron job is scheduled at
    // both 01:00 and 02:00 UTC to cover EDT and EST respectively; the
    // guard makes sure only the one that lines up with 9 PM Eastern
    // actually sends. Manual "Run Now" callers bypass this since
    // isCron is false.
    if (isCron) {
      const easternHour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date()));
      if (easternHour !== 21) {
        return new Response(JSON.stringify({ sent: false, reason: `wrong hour: ${easternHour}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await userClient.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await userClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Service role for the data fetch — RLS would otherwise scope to
    // the calling user, and we need a full picture.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Date to scan. The cron call leaves this null and we use today
    // in Eastern. Manual "Run Now" calls from the admin UI can pass a
    // specific YYYY-MM-DD via the request body to scan an earlier
    // day (e.g., to investigate yesterday's miss).
    let scanDate: string;
    if (!isCron) {
      try {
        const body = await req.json();
        if (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          scanDate = body.date;
        } else {
          scanDate = formatEasternDate(new Date());
        }
      } catch {
        scanDate = formatEasternDate(new Date());
      }
    } else {
      scanDate = formatEasternDate(new Date());
    }
    const todayEastern = scanDate;

    // Fetch all runs that fall on the scan date in Eastern. We bracket
    // the date in UTC with a generous buffer on either side, then
    // filter precisely in JS by Eastern date — handles both EDT and
    // EST and arbitrary historical scan dates without arithmetic.
    const dayUtc = new Date(scanDate + "T00:00:00Z");
    const windowStart = new Date(dayUtc.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(dayUtc.getTime() + 36 * 60 * 60 * 1000).toISOString();
    const { data: runsRaw, error: runsErr } = await supabase
      .from("runs")
      .select("id, run_type, started_at, drivers:drivers(id, name), routes:routes(id, name)")
      .gte("started_at", windowStart)
      .lte("started_at", windowEnd);
    if (runsErr) throw runsErr;

    const todayRuns: RunRow[] = ((runsRaw || []) as unknown as RunRow[])
      .filter((r) => formatEasternDate(new Date(r.started_at)) === todayEastern);

    if (todayRuns.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no runs today" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const runIds = todayRuns.map((r) => r.id);

    // Route-level completeness: a route is "closed out" for the day if
    // BOTH a Pickup run and a Dropoff run exist for it, regardless of
    // which driver did each or whether every kid is on both. This is
    // intentional — per-youth gaps (e.g., a kid picked up at 4:29 PM
    // who wasn't tapped on the 7:36 PM Dropoff) are a separate concern
    // from "the trip wasn't closed out." That separate concern doesn't
    // belong in this report.
    type RouteState = {
      routeName: string;
      pickups: RunRow[];
      dropoffs: RunRow[];
    };
    const byRoute = new Map<string, RouteState>();
    for (const run of todayRuns) {
      const name = run.routes?.name;
      if (!name) continue;
      if (!byRoute.has(name)) byRoute.set(name, { routeName: name, pickups: [], dropoffs: [] });
      const s = byRoute.get(name)!;
      if (run.run_type === "pickup") s.pickups.push(run);
      if (run.run_type === "dropoff") s.dropoffs.push(run);
    }

    const missingDropoff: RouteState[] = [];
    const missingPickup: RouteState[] = [];
    for (const s of byRoute.values()) {
      if (s.pickups.length > 0 && s.dropoffs.length === 0) missingDropoff.push(s);
      if (s.dropoffs.length > 0 && s.pickups.length === 0) missingPickup.push(s);
    }

    if (missingDropoff.length === 0 && missingPickup.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "all clean" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull attendance only to surface youth counts on each pickup/dropoff
    // for context — not for matching anymore.
    const { data: attendanceRaw } = await supabase
      .from("transport_attendance")
      .select("run_id, youth_id, status")
      .in("run_id", runIds);
    const youthCountByRun = new Map<string, number>();
    for (const a of (attendanceRaw || []) as { run_id: string; youth_id: string; status: string }[]) {
      if (a.status === "picked_up" || a.status === "dropped_off") {
        youthCountByRun.set(a.run_id, (youthCountByRun.get(a.run_id) || 0) + 1);
      }
    }

    const renderMissingRow = (s: RouteState, missing: "dropoff" | "pickup"): string => {
      const sourceRuns = missing === "dropoff" ? s.pickups : s.dropoffs;
      const missingWord = missing === "dropoff" ? "Dropoff" : "Pickup";
      const sourceLabel = missing === "dropoff" ? "picked up" : "dropped off";
      const route = escapeHtml(s.routeName);

      // If multiple pickups/dropoffs exist for the route, list them all
      // (different drivers/times). Usually just one.
      const sourceDetails = sourceRuns
        .sort((a, b) => a.started_at.localeCompare(b.started_at))
        .map((r) => {
          const time = formatEasternTime(r.started_at);
          const driver = escapeHtml(r.drivers?.name || "Unknown driver");
          const count = youthCountByRun.get(r.id) || 0;
          return `${count} youth ${sourceLabel} at ${time} by <em>${driver}</em>`;
        })
        .join("; ");

      return `<li style="margin-bottom: 18px; line-height: 1.55;">
        <strong style="color: #111827; font-size: 15px;">${route}</strong>
        <div style="margin-top: 4px; font-size: 13px; color: #6b7280;">${sourceDetails}</div>
        <div style="margin-top: 8px; padding: 10px 14px; background: #fef3c7; border-left: 3px solid #d97706; border-radius: 4px; font-size: 13px; color: #78350f;">
          <strong>Action:</strong> No <strong>${route} ${missingWord}</strong> run was submitted today — a driver needs to submit one.
        </div>
      </li>`;
    };

    const subjectDate = formatDateForSubject(todayEastern);
    const subject = `Unclosed Trips — ${subjectDate}`;

    const html = `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px;">
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #111827;">Unclosed Trips</h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">${subjectDate}</p>

    ${missingDropoff.length > 0 ? `
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #b91c1c;">
        ${missingDropoff.length} ${missingDropoff.length === 1 ? "route has" : "routes have"} a Pickup but no Dropoff
      </h3>
      <ul style="margin: 0 0 24px 0; padding-left: 18px; color: #111827; list-style: disc;">
        ${missingDropoff.map((s) => renderMissingRow(s, "dropoff")).join("")}
      </ul>
    ` : ""}

    ${missingPickup.length > 0 ? `
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #b45309;">
        ${missingPickup.length} ${missingPickup.length === 1 ? "route has" : "routes have"} a Dropoff but no Pickup
      </h3>
      <ul style="margin: 0 0 24px 0; padding-left: 18px; color: #111827; list-style: disc;">
        ${missingPickup.map((s) => renderMissingRow(s, "pickup")).join("")}
      </ul>
    ` : ""}

    <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Reach out to drivers and ask them to submit the missing attendance so pay calculates
      correctly and every youth is accounted for.
    </p>
  </div>
</body>
</html>`;

    const emailResult = await resend.emails.send({
      from: FROM_ADDRESS,
      to: RECIPIENTS,
      subject,
      html,
    });

    if (emailResult.error) {
      throw new Error(`Resend failed: ${emailResult.error.message}`);
    }

    return new Response(JSON.stringify({
      sent: true,
      routes_missing_dropoff: missingDropoff.length,
      routes_missing_pickup: missingPickup.length,
      recipients: RECIPIENTS,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-incomplete-trips fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
