/**
 * NLA Data Import Script
 *
 * Run this after Lovable gives you the export download link.
 *
 * Usage:
 *   node scripts/import-data.mjs path/to/export.json
 *
 * Or if Lovable gives separate files per table:
 *   node scripts/import-data.mjs path/to/export-folder/
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

// ── NEW Supabase credentials ──────────────────────────────────────────────────
const SUPABASE_URL = "https://rkdkmzjontaufbyjbcku.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""; // set via env, never hardcode
// ─────────────────────────────────────────────────────────────────────────────

// Tables inserted in dependency order (parent tables before child tables)
const TABLE_ORDER = [
  // No foreign key dependencies
  "user_roles",
  "calendar_verses",
  "verse_library",
  "admin_allowlist",
  "service_types",
  "upcoming_events",
  "vault_categories",
  "focus_areas",

  // Depend on nothing or simple refs
  "supporters",
  "clients",
  "drivers",
  "routes",
  "staff_profiles",
  "staff_permissions",

  // Depend on supporters / clients
  "engagements",
  "tasks",
  "revenue",
  "donations",
  "deposit_batches",
  "client_services",
  "invoices",

  // Depend on invoices / clients
  "service_logs",
  "invoice_approvals",
  "invoice_sends",

  // Youth
  "youth_registrations",
  "youth_profiles",
  "attendance_records",
  "registration_form_fields",
  "callouts",
  "excursions",

  // Transport
  "runs",
  "transport_attendance",
  "incidents",
  "run_approvals",
  "driver_pay_periods",
  "transport_impact_reports",

  // Meals
  "meal_events",
  "meal_items",
  "meal_checkins",

  // Finance / CSBG
  "csbg_budget_actuals",
  "csbg_invoices",
  "csbg_monthly_checklists",
  "csbg_submissions",

  // Vault
  "vault_folders",
  "vault_documents",

  // Signals / Tasks
  "signals",
  "dashboard_tiles",
  "vision_cloud_items",
  "practice_days",
  "weather_data",

  // Message board
  "mb_conversations",
  "mb_conversation_members",
  "mb_messages",
  "mb_tasks",
  "mb_calendar_events",
];

async function importTable(supabase, tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  ⏭  ${tableName}: empty, skipping`);
    return;
  }

  // Insert in batches of 500 to avoid request size limits
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      console.error(`  ✗ ${tableName} batch ${i / BATCH + 1} failed:`, error.message);
      return;
    }
    inserted += batch.length;
  }

  console.log(`  ✓ ${tableName}: ${inserted} rows`);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/import-data.mjs <path-to-export.json or folder>");
    process.exit(1);
  }

  if (SERVICE_ROLE_KEY === "PASTE_YOUR_SERVICE_ROLE_KEY_HERE") {
    console.error("Edit import-data.mjs and paste your service role key on line 16 first.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("\n🚀 NLA Data Import Starting...\n");

  // Load export data — handle single JSON file or folder of JSON files
  let exportData = {};

  const isDir = statSync(inputPath).isDirectory();

  if (isDir) {
    const files = readdirSync(inputPath).filter(f => extname(f) === ".json");
    for (const file of files) {
      const tableName = file.replace(".json", "");
      const content = JSON.parse(readFileSync(join(inputPath, file), "utf8"));
      exportData[tableName] = Array.isArray(content) ? content : content.rows ?? content.data ?? [];
    }
  } else {
    const raw = JSON.parse(readFileSync(inputPath, "utf8"));
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        exportData[entry.table] = entry.rows ?? entry.data ?? [];
      }
    } else if (raw.tables) {
      // Lovable export format: { tables: { tableName: { row_count, rows } } }
      for (const [tableName, tableData] of Object.entries(raw.tables)) {
        exportData[tableName] = tableData.rows ?? tableData.data ?? tableData ?? [];
      }
    } else {
      exportData = raw;
    }
  }

  const foundTables = Object.keys(exportData);
  console.log(`Found ${foundTables.length} tables in export: ${foundTables.join(", ")}\n`);

  // Insert in dependency order, then any extras not in our list
  const ordered = [
    ...TABLE_ORDER.filter(t => foundTables.includes(t)),
    ...foundTables.filter(t => !TABLE_ORDER.includes(t)),
  ];

  for (const table of ordered) {
    await importTable(supabase, table, exportData[table]);
  }

  console.log("\n✅ Import complete. Verify your data at:");
  console.log("   https://supabase.com/dashboard/project/rkdkmzjontaufbyjbcku\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
