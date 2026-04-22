// One-time admin export of all public-schema tables to a JSON file in the
// `data-exports` storage bucket. Returns a signed download URL valid for 24h.
// Caller must be an authenticated admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// All public-schema tables to export. Order doesn't matter for JSON dump.
const TABLES = [
  "admin_allowlist",
  "attendance_records",
  "calendar_verses",
  "callouts",
  "client_services",
  "clients",
  "csbg_budget_actuals",
  "csbg_invoices",
  "csbg_monthly_checklists",
  "csbg_submissions",
  "dashboard_tiles",
  "deposit_batches",
  "donations",
  "driver_pay_periods",
  "drivers",
  "engagements",
  "excursions",
  "focus_areas",
  "incidents",
  "invoice_approvals",
  "invoice_sends",
  "invoices",
  "mb_calendar_events",
  "mb_conversation_members",
  "mb_conversations",
  "mb_messages",
  "mb_tasks",
  "meal_checkins",
  "meal_events",
  "meal_items",
  "practice_days",
  "registration_form_fields",
  "revenue",
  "routes",
  "run_approvals",
  "runs",
  "service_logs",
  "service_types",
  "signals",
  "staff_permissions",
  "staff_profiles",
  "supporters",
  "tasks",
  "transport_attendance",
  "transport_impact_reports",
  "upcoming_events",
  "user_roles",
  "vault_categories",
  "vault_documents",
  "vault_folders",
  "youth_profiles",
  "youth_registrations",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleRow, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dump every table. Service role bypasses RLS so we get full rows.
    const dump: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      project_ref: SUPABASE_URL.split("//")[1].split(".")[0],
      table_count: TABLES.length,
      tables: {} as Record<string, { row_count: number; rows: unknown[] }>,
      errors: {} as Record<string, string>,
    };

    for (const table of TABLES) {
      const rows: unknown[] = [];
      const pageSize = 1000;
      let from = 0;
      let lastBatchSize = pageSize;
      let tableErr: string | null = null;

      while (lastBatchSize === pageSize) {
        const { data, error } = await admin
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) {
          tableErr = error.message;
          break;
        }
        const batch = data ?? [];
        rows.push(...batch);
        lastBatchSize = batch.length;
        from += pageSize;
      }

      if (tableErr) {
        (dump.errors as Record<string, string>)[table] = tableErr;
        continue;
      }
      (dump.tables as Record<string, { row_count: number; rows: unknown[] }>)[
        table
      ] = { row_count: rows.length, rows };
    }

    const json = JSON.stringify(dump, null, 2);
    const bytes = new TextEncoder().encode(json);
    const filename = `export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    const { error: uploadErr } = await admin.storage
      .from("data-exports")
      .upload(filename, bytes, {
        contentType: "application/json",
        upsert: false,
      });
    if (uploadErr) {
      return new Response(
        JSON.stringify({ error: `Upload failed: ${uploadErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 24h signed URL
    const { data: signed, error: signErr } = await admin.storage
      .from("data-exports")
      .createSignedUrl(filename, 60 * 60 * 24);
    if (signErr || !signed) {
      return new Response(
        JSON.stringify({ error: `Sign failed: ${signErr?.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tableSummary = Object.fromEntries(
      Object.entries(
        dump.tables as Record<string, { row_count: number; rows: unknown[] }>,
      ).map(([k, v]) => [k, v.row_count]),
    );

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        size_bytes: bytes.length,
        download_url: signed.signedUrl,
        expires_in_seconds: 60 * 60 * 24,
        table_summary: tableSummary,
        errors: dump.errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
