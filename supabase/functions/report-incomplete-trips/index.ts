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

type YouthRow = { id: string; first_name: string; last_name: string };
type RunRow = {
  id: string;
  run_type: string;
  started_at: string;
  drivers: { id: string; name: string } | null;
  routes: { id: string; name: string } | null;
};
type AttendanceRow = {
  run_id: string;
  youth_id: string;
  status: string;
  youth_profiles: YouthRow | null;
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
    const runById = new Map<string, RunRow>(todayRuns.map((r) => [r.id, r]));

    // Attendance across both completed and in-progress runs. Drivers
    // tap pickup/dropoff live; the attendance row is written even if
    // the run is never formally submitted, so we want to count those
    // taps too — otherwise an "I forgot to submit but I did tap them"
    // case would over-flag.
    const { data: attendanceRaw, error: attErr } = await supabase
      .from("transport_attendance")
      .select("run_id, youth_id, status, youth_profiles:youth_profiles(id, first_name, last_name)")
      .in("run_id", runIds);
    if (attErr) throw attErr;

    const attendance = (attendanceRaw || []) as unknown as AttendanceRow[];

    type YouthStatus = {
      youth: YouthRow;
      pickedUp: { run: RunRow }[];
      droppedOff: { run: RunRow }[];
    };
    const youthMap = new Map<string, YouthStatus>();
    for (const att of attendance) {
      if (!att.youth_profiles) continue;
      const run = runById.get(att.run_id);
      if (!run) continue;
      if (!youthMap.has(att.youth_id)) {
        youthMap.set(att.youth_id, { youth: att.youth_profiles, pickedUp: [], droppedOff: [] });
      }
      const entry = youthMap.get(att.youth_id)!;
      if (att.status === "picked_up") entry.pickedUp.push({ run });
      if (att.status === "dropped_off") entry.droppedOff.push({ run });
    }

    type IncompleteEntry = { youth: YouthRow; runs: RunRow[] };
    const pickedNoDropoff: IncompleteEntry[] = [];
    const droppedNoPickup: IncompleteEntry[] = [];

    for (const entry of youthMap.values()) {
      if (entry.pickedUp.length > 0 && entry.droppedOff.length === 0) {
        pickedNoDropoff.push({ youth: entry.youth, runs: entry.pickedUp.map((p) => p.run) });
      }
      if (entry.droppedOff.length > 0 && entry.pickedUp.length === 0) {
        droppedNoPickup.push({ youth: entry.youth, runs: entry.droppedOff.map((d) => d.run) });
      }
    }

    if (pickedNoDropoff.length === 0 && droppedNoPickup.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "all clean" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action-oriented grouping. The email's job is to tell the operator
    // what to do next — not just list which pickup the youth came from.
    // For each missing youth we figure out:
    //   - which route they need their dropoff (or pickup) submitted for
    //   - whether a matching run already exists today (so the action is
    //     "add these youth to that run") or not (so it's "submit a new run")
    const pickupByRoute = new Map<string, RunRow>();
    const dropoffByRoute = new Map<string, RunRow>();
    for (const run of todayRuns) {
      const name = run.routes?.name;
      if (!name) continue;
      if (run.run_type === "pickup" && !pickupByRoute.has(name)) pickupByRoute.set(name, run);
      if (run.run_type === "dropoff" && !dropoffByRoute.has(name)) dropoffByRoute.set(name, run);
    }

    type ActionGroup = {
      routeName: string;
      sourceRun: RunRow;            // the run where they were recorded (pickup for missing-dropoff, vice versa)
      matchingRun: RunRow | null;   // existing opposite-direction run for the same route, if any
      direction: "dropoff" | "pickup"; // which direction is missing
      youth: YouthRow[];
    };

    const groupByRouteAndAction = (
      entries: IncompleteEntry[],
      missingDirection: "dropoff" | "pickup",
    ): ActionGroup[] => {
      const m = new Map<string, ActionGroup>();
      for (const e of entries) {
        for (const sourceRun of e.runs) {
          const routeName = sourceRun.routes?.name || "Unknown route";
          const key = routeName;
          if (!m.has(key)) {
            const matchingRun = missingDirection === "dropoff"
              ? dropoffByRoute.get(routeName) ?? null
              : pickupByRoute.get(routeName) ?? null;
            m.set(key, {
              routeName,
              sourceRun,
              matchingRun,
              direction: missingDirection,
              youth: [],
            });
          }
          m.get(key)!.youth.push(e.youth);
        }
      }
      // Dedupe youth list (a youth could appear via multiple pickup runs).
      for (const g of m.values()) {
        const seen = new Set<string>();
        g.youth = g.youth.filter((y) => {
          if (seen.has(y.id)) return false;
          seen.add(y.id);
          return true;
        });
      }
      return Array.from(m.values()).sort((a, b) =>
        a.sourceRun.started_at.localeCompare(b.sourceRun.started_at),
      );
    };

    const missingDropoffGroups = groupByRouteAndAction(pickedNoDropoff, "dropoff");
    const missingPickupGroups = groupByRouteAndAction(droppedNoPickup, "pickup");

    const renderActionGroup = (g: ActionGroup): string => {
      const route = escapeHtml(g.routeName);
      const driver = escapeHtml(g.sourceRun.drivers?.name || "Unknown");
      const sourceTime = formatEasternTime(g.sourceRun.started_at);
      const names = g.youth.map((y) => escapeHtml(`${y.first_name} ${y.last_name}`)).join(", ");
      const sourceLabel = g.direction === "dropoff" ? "picked up" : "dropped off";
      const directionWord = g.direction === "dropoff" ? "Dropoff" : "Pickup";

      const action = g.matchingRun
        ? `Add ${g.youth.length === 1 ? "this youth" : `these ${g.youth.length} youth`} to the existing <strong>${route} ${directionWord}</strong> at ${formatEasternTime(g.matchingRun.started_at)} (driver: <em>${escapeHtml(g.matchingRun.drivers?.name || "Unknown")}</em>).`
        : `No <strong>${route} ${directionWord}</strong> run was submitted today — a driver needs to submit one.`;

      return `<li style="margin-bottom: 18px; line-height: 1.55;">
        <strong style="color: #111827;">${route}</strong> &mdash; ${g.youth.length} youth ${sourceLabel} at ${sourceTime} by <em>${driver}</em>
        <div style="margin-top: 6px; padding: 8px 12px; background: #fef3c7; border-left: 3px solid #d97706; border-radius: 4px; font-size: 13px; color: #78350f;">
          <strong>Action:</strong> ${action}
        </div>
        <div style="margin-top: 6px; font-size: 13px; color: #6b7280;">${g.youth.length} youth: ${names}</div>
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

    ${missingDropoffGroups.length > 0 ? `
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #b91c1c;">
        ${pickedNoDropoff.length} youth picked up today but no dropoff on record
      </h3>
      <ul style="margin: 0 0 24px 0; padding-left: 18px; color: #111827; list-style: disc;">
        ${missingDropoffGroups.map(renderActionGroup).join("")}
      </ul>
    ` : ""}

    ${missingPickupGroups.length > 0 ? `
      <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #b45309;">
        ${droppedNoPickup.length} youth dropped off today but no pickup on record
      </h3>
      <ul style="margin: 0 0 24px 0; padding-left: 18px; color: #111827; list-style: disc;">
        ${missingPickupGroups.map(renderActionGroup).join("")}
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
      picked_up_no_dropoff: pickedNoDropoff.length,
      dropoff_no_pickup: droppedNoPickup.length,
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
