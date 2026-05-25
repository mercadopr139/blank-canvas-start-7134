// Nightly 8 PM Eastern email listing Bald Eagles who didn't show up
// today and didn't submit a call-out either. Matches the in-app red
// banner alert logic exactly:
//   - Eagles are filtered to Active (bald_eagle_active = true).
//   - Today's attendance_records and today's callouts are subtracted.
//   - Call-outs are matched by case-insensitive first/last name pair,
//     not registration_id (the callouts table doesn't carry a reg id).
// Only sends when at least one Eagle is unaccounted for.

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

type EagleRow = {
  id: string;
  child_first_name: string;
  child_last_name: string;
  child_boxing_program: string | null;
};

type CalloutRow = {
  registration_id: string | null;
  first_name: string;
  last_name: string;
};

const formatEasternDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

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
    // Two callers: pg_cron (with X-Cron-Secret) or an admin from the UI
    // "Run Now" button (with a logged-in JWT). Admin path skips the
    // Eastern-hour guard and can pass an explicit date.
    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = cronSecret && cronSecret === Deno.env.get("CRON_SHARED_SECRET");

    if (isCron) {
      // DST-proof time guard for cron only. Scheduled at 00:00 UTC and
      // 01:00 UTC every day:
      //   - EDT (Mar–Nov): 00:00 UTC = 20 ET → sends. 01:00 UTC = 21 ET → skip.
      //   - EST (Nov–Mar): 00:00 UTC = 19 ET → skip. 01:00 UTC = 20 ET → sends.
      const easternHour = Number(new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date()));
      if (easternHour !== 20) {
        return new Response(JSON.stringify({ sent: false, reason: `wrong hour: ${easternHour}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Skip weekends — academy is closed Sat/Sun so a no-show alert
      // would be noise. The "wrong hour" guard above already pins us
      // to 8 PM Eastern, so weekday here is the Eastern weekday at
      // that moment. Manual "Run Now" calls intentionally bypass this
      // (admin can still test against a past Sunday).
      const easternWeekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
      }).format(new Date());
      if (easternWeekday === "Sat" || easternWeekday === "Sun") {
        return new Response(JSON.stringify({ sent: false, reason: `weekend: ${easternWeekday}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Manual UI invocation. Require an admin JWT.
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Date to scan: cron uses today (Eastern). Admin manual run can pass
    // an explicit YYYY-MM-DD in the body to scan a past day for testing.
    let todayEastern: string;
    if (isCron) {
      todayEastern = formatEasternDate(new Date());
    } else {
      try {
        const body = await req.json();
        if (body?.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          todayEastern = body.date;
        } else {
          todayEastern = formatEasternDate(new Date());
        }
      } catch {
        todayEastern = formatEasternDate(new Date());
      }
    }

    // 1. Active Bald Eagles
    const { data: eaglesRaw, error: eaglesErr } = await supabase
      .from("youth_registrations")
      .select("id, child_first_name, child_last_name, child_boxing_program")
      .eq("is_bald_eagle", true)
      .eq("bald_eagle_active", true);
    if (eaglesErr) throw eaglesErr;
    const eagles: EagleRow[] = (eaglesRaw || []) as EagleRow[];

    if (eagles.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no active eagles" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Today's attendance — only their registration_ids
    const eagleIds = eagles.map((e) => e.id);
    const { data: attendance, error: attErr } = await supabase
      .from("attendance_records")
      .select("registration_id")
      .eq("check_in_date", todayEastern)
      .in("registration_id", eagleIds);
    if (attErr) throw attErr;
    const checkedIn = new Set((attendance || []).map((a: { registration_id: string }) => a.registration_id));

    // 3. Today's call-outs. Prefer the bulletproof registration_id link
    // saved on new rows (form now stores the picked youth's reg id).
    // Fall back to case-insensitive name match for legacy rows that
    // pre-date that column — those land in calledOutNames.
    const { data: callouts, error: coErr } = await supabase
      .from("callouts")
      .select("registration_id, first_name, last_name")
      .eq("date", todayEastern);
    if (coErr) throw coErr;
    const calledOutIds = new Set<string>();
    const calledOutNames = new Set<string>();
    for (const c of (callouts || []) as CalloutRow[]) {
      if (c.registration_id) calledOutIds.add(c.registration_id);
      else calledOutNames.add(`${c.first_name.toLowerCase().trim()}|${c.last_name.toLowerCase().trim()}`);
    }

    // 4. No-shows = active eagles not in any of the three sets
    const noShows = eagles.filter((e) => {
      if (checkedIn.has(e.id)) return false;
      if (calledOutIds.has(e.id)) return false;
      const nameKey = `${e.child_first_name.toLowerCase().trim()}|${e.child_last_name.toLowerCase().trim()}`;
      if (calledOutNames.has(nameKey)) return false;
      return true;
    });

    if (noShows.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "all accounted for" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sort by last name, then first, for a stable readable list
    noShows.sort((a, b) => {
      const ln = a.child_last_name.localeCompare(b.child_last_name);
      return ln !== 0 ? ln : a.child_first_name.localeCompare(b.child_first_name);
    });

    const subjectDate = formatDateForSubject(todayEastern);
    const subject = `Bald Eagle No-Shows — ${subjectDate} (${noShows.length})`;

    const rows = noShows.map((e) => {
      const name = escapeHtml(`${e.child_first_name} ${e.child_last_name}`);
      const program = escapeHtml(e.child_boxing_program || "—");
      return `<li style="margin-bottom: 10px; line-height: 1.55;">
        <strong style="color: #111827; font-size: 15px;">🦅 ${name}</strong>
        <span style="color: #6b7280; font-size: 13px;"> · ${program}</span>
      </li>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 24px; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px;">
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #b91c1c;">Bald Eagle No-Shows</h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280;">${subjectDate}</p>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #111827;">
      ${noShows.length === 1
        ? "<strong>1 Bald Eagle</strong> didn't check in and didn't submit a call-out:"
        : `<strong>${noShows.length} Bald Eagles</strong> didn't check in and didn't submit a call-out:`}
    </p>

    <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #111827; list-style: none;">
      ${rows}
    </ul>

    <div style="margin-top: 8px; padding: 12px 14px; background: #fef3c7; border-left: 3px solid #d97706; border-radius: 4px; font-size: 13px; color: #78350f; line-height: 1.55;">
      <strong>Reminder:</strong> Inactive Bald Eagles are intentionally excluded from this list.
      Mark a youth Inactive on the Bald Eagles Watch List if you've already arranged a partial schedule with them.
    </div>
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
      no_shows: noShows.length,
      recipients: RECIPIENTS,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-bald-eagle-no-shows fatal:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
